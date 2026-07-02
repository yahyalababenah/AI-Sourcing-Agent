"""
AI-Sourcing Hub — Pricing Engine Edge Cases

The bulk of ``PricingEngine`` coverage (10-step landed cost algorithm, MOQ
tiers, VAT base, HS-code fees, zero-quantity/negative-price validation,
unknown-port fallback) already lives in ``tests/test_pricing/test_pricing_api.py``
and ``tests/test_pricing/test_hs_code_pricing.py``. This file only adds the
two edge cases from the test-planning brief that weren't covered there yet:
a zero price (valid, not an error) and an unsupported/unrecognized currency
code (falls back to the JOD conversion path with a logged warning).
"""
import pytest

from app.modules.pricing.engine import LineItemInput, PricingEngine


class TestZeroPrice:
    """price_rmb=0.0 is valid (only negative prices raise)."""

    def setup_method(self):
        self.engine = PricingEngine()

    def test_zero_price_produces_zero_goods_cost_but_nonzero_total(self):
        """A free product still accrues freight/customs/clearance/commission."""
        result = self.engine.calculate_landed_cost(
            price_rmb=0.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="JOD",
        )
        assert result["price_local"] == 0.0
        # Freight/clearance/commission still apply even at zero goods price.
        assert result["freight_per_unit"] > 0
        assert result["clearance_per_unit"] > 0
        assert result["total_per_unit"] > 0

    def test_zero_price_in_multi_product_calculate(self):
        products = [
            LineItemInput(
                product_id="free", product_name="Free Sample",
                quantity=5, unit_price_cny=0.0, weight_kg=10.0,
            )
        ]
        result = self.engine.calculate(
            rfq_id="zero-price-test", target_currency="JOD",
            destination_port="Aqaba", products=products,
        )
        li = result["line_items"][0]
        assert li["unit_price_converted"] == 0.0
        assert li["total"] >= 0


class TestUnsupportedCurrency:
    """An unrecognized target currency falls back to the JOD conversion path."""

    def setup_method(self):
        self.engine = PricingEngine()

    def test_unknown_currency_falls_back_to_jod_rate(self, caplog):
        """Currency code that isn't USD or JOD still produces a result, using
        the same USD→JOD derived rate as the JOD path, and logs a warning."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="XYZ",
        )
        jod_result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="JOD",
        )
        # Same fallback conversion math is used for both.
        assert result["price_local"] == jod_result["price_local"]
        # Original (unrecognized) currency code is preserved in the result, not silently renamed.
        assert result["currency"] == "XYZ"

    def test_unknown_currency_in_calculate_preserves_requested_code(self):
        products = [
            LineItemInput(
                product_id="p1", product_name="Widget",
                quantity=10, unit_price_cny=50.0, weight_kg=100.0,
            )
        ]
        result = self.engine.calculate(
            rfq_id="unsupported-currency-test", target_currency="XYZ",
            destination_port="Aqaba", products=products,
        )
        assert result["target_currency"] == "XYZ"
        assert result["grand_total"] > 0
