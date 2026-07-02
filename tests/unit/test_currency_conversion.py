"""
AI-Sourcing Hub — Exchange Rate Refresh & Application Tests

``tests/test_pricing/test_pricing_api.py::TestCachedExchangeRate`` already
covers the low-level cache get/set/invalidate helpers with a mocked Redis.
This file covers what wasn't tested anywhere yet:
  1. ``app.modules.pricing.service.refresh_exchange_rates()`` — the Celery
     Beat-scheduled function that fetches live rates from exchangerate-api.com
     and caches them (success, partial failure, no API key, network error).
  2. A cached exchange rate actually round-trips through real Redis semantics
     (fakeredis) and gets applied to a live ``calculate_price()`` call.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.pricing.cache import get_exchange_rate, set_exchange_rate
from app.modules.pricing.schemas import CalculatePriceRequest, PriceProductInput
from app.modules.pricing.service import calculate_price, refresh_exchange_rates


def _mock_response(status_code: int, json_body: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body
    return resp


class TestRefreshExchangeRates:
    @pytest.mark.asyncio
    async def test_no_api_key_returns_empty_dict(self, db_session, redis_client, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "EXCHANGE_RATE_API_KEY", "")
        rates = await refresh_exchange_rates(db_session, redis=redis_client)
        assert rates == {}

    @pytest.mark.asyncio
    async def test_success_fetches_and_caches_both_pairs(self, db_session, redis_client, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "EXCHANGE_RATE_API_KEY", "fake-key")

        jod_response = _mock_response(200, {"result": "success", "conversion_rate": 0.105})
        usd_response = _mock_response(200, {"result": "success", "conversion_rate": 0.141})

        mock_client = AsyncMock()
        mock_client.get.side_effect = [jod_response, usd_response]
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            rates = await refresh_exchange_rates(db_session, redis=redis_client)

        assert rates == {"CNY_JOD": 0.105, "CNY_USD": 0.141}
        cached_jod = await get_exchange_rate(redis_client, "CNY", "JOD")
        assert cached_jod == pytest.approx(0.105)
        cached_usd = await get_exchange_rate(redis_client, "CNY", "USD")
        assert cached_usd == pytest.approx(0.141)

    @pytest.mark.asyncio
    async def test_partial_failure_caches_only_successful_pair(self, db_session, redis_client, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "EXCHANGE_RATE_API_KEY", "fake-key")

        jod_response = _mock_response(200, {"result": "success", "conversion_rate": 0.105})
        usd_response = _mock_response(500, {})

        mock_client = AsyncMock()
        mock_client.get.side_effect = [jod_response, usd_response]
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            rates = await refresh_exchange_rates(db_session, redis=redis_client)

        assert rates == {"CNY_JOD": 0.105}

    @pytest.mark.asyncio
    async def test_network_error_returns_empty_dict_without_raising(self, db_session, redis_client, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "EXCHANGE_RATE_API_KEY", "fake-key")

        mock_client = AsyncMock()
        mock_client.get.side_effect = ConnectionError("network down")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            rates = await refresh_exchange_rates(db_session, redis=redis_client)

        assert rates == {}


class TestExchangeRateAppliedToCalculation:
    @pytest.mark.asyncio
    async def test_cached_rate_round_trips_through_real_redis(self, redis_client):
        """set_exchange_rate → get_exchange_rate against fakeredis (real TTL/key
        semantics, not AsyncMock) returns the exact cached value."""
        await set_exchange_rate(redis_client, "CNY", "JOD", 0.099)
        rate = await get_exchange_rate(redis_client, "CNY", "JOD")
        assert rate == pytest.approx(0.099)

    @pytest.mark.asyncio
    async def test_calculate_price_uses_cached_exchange_rate_over_default(
        self, db_session, redis_client,
    ):
        """REGRESSION-style check: a cached CNY→JOD rate must actually change
        the calculated unit price, proving calculate_price() reads from cache
        rather than silently falling back to PricingEngine.DEFAULTS."""
        await set_exchange_rate(redis_client, "CNY", "JOD", 0.5)  # deliberately far from default 0.1047

        request = CalculatePriceRequest(
            rfq_id="currency-test",
            target_currency="JOD",
            destination_port="Aqaba",
            products=[
                PriceProductInput(
                    product_id="p1", name="Widget", quantity=10,
                    unit_price_cny=100.0, weight_kg=50.0,
                )
            ],
        )
        result = await calculate_price(db_session, request, redis=redis_client)
        li = result.line_items[0]
        # price_usd = 100 * 0.14 (default) = 14; with cached rate 0.5 used as
        # exchange_rate_cny_jod, price_local should be ~50 (100 * 0.5), not ~10.47.
        assert li.unit_price_converted == pytest.approx(50.0, rel=0.01)
        # exchange_rate_used is the derived USD→JOD rate (cny_jod / cny_usd), not
        # the raw cached CNY→JOD figure itself — engine.py's conversion chain.
        assert result.exchange_rate_used == pytest.approx(0.5 / 0.14, rel=0.01)
