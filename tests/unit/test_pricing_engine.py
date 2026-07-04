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

from app.modules.pricing.engine import CustomRule, LineItemInput, PricingEngine


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


class TestCustomRules:
    """Admin-created rules whose name isn't a canonical DEFAULTS key.

    Previously any such rule was persisted but silently ignored by every
    calculation, since the engine only ever looked rules up by exact name
    against its hardcoded DEFAULTS keys. These tests cover the new
    _apply_custom_rules() path added to fix that.
    """

    def _products(self):
        return [
            LineItemInput(
                product_id="p1", product_name="Widget A",
                quantity=10, unit_price_cny=50.0, weight_kg=100.0,
            ),
            LineItemInput(
                product_id="p2", product_name="Widget B",
                quantity=5, unit_price_cny=80.0, weight_kg=50.0,
            ),
        ]

    def test_canonical_rule_name_is_not_treated_as_custom(self):
        """A rule named after a canonical DEFAULTS key must still only act as
        a plain override — CustomRule filters these out in __init__.
        """
        engine = PricingEngine(
            custom_rules=[CustomRule(name="clearance_fee", rule_type="fixed", value=999.0)]
        )
        assert engine.custom_rules == []

    def test_percentage_custom_rule_applies_to_goods_subtotal(self):
        engine = PricingEngine(
            custom_rules=[CustomRule(name="handling_fee", rule_type="percentage", value=5.0, priority=0)]
        )
        with_rule = engine.calculate(
            rfq_id="custom-pct", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        baseline = PricingEngine().calculate(
            rfq_id="custom-pct-baseline", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        goods_subtotal = sum(li["subtotal"] for li in with_rule["line_items"])
        expected_fee = goods_subtotal * 0.05
        assert with_rule["custom_fees_total"] == pytest.approx(expected_fee, rel=0.01)
        assert with_rule["grand_total"] > baseline["grand_total"]
        assert any("custom:handling_fee" in r for r in with_rule["rules_applied"])

    def test_fixed_custom_rule_charged_once_per_shipment(self):
        """A fixed custom fee must not multiply with the number of line items."""
        engine = PricingEngine(
            custom_rules=[CustomRule(name="doc_fee", rule_type="fixed", value=20.0)]
        )
        result = engine.calculate(
            rfq_id="custom-fixed", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        assert result["custom_fees_total"] == pytest.approx(20.0)

    def test_formula_custom_rule_evaluated_per_line(self):
        engine = PricingEngine(
            custom_rules=[
                CustomRule(name="per_line_fee", rule_type="formula", formula="max(1, quantity * 0.1)")
            ]
        )
        result = engine.calculate(
            rfq_id="custom-formula", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        # quantities are 10 and 5 → max(1, 1.0) + max(1, 0.5) = 1.0 + 1.0
        assert result["custom_fees_total"] == pytest.approx(2.0)
        applied = {r["name"]: r for r in result["custom_rules_applied"]}
        assert applied["per_line_fee"]["rule_type"] == "formula"

    def test_broken_formula_rule_is_skipped_not_fatal(self):
        """An invalid/unsafe formula must not crash the calculation — it
        contributes 0 and is flagged in rules_applied instead.
        """
        engine = PricingEngine(
            custom_rules=[
                CustomRule(name="bad_rule", rule_type="formula", formula="unknown_var * 2")
            ]
        )
        result = engine.calculate(
            rfq_id="custom-formula-broken", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        assert result["custom_fees_total"] == 0.0
        assert any("custom:bad_rule:error" in r for r in result["rules_applied"])

    def test_priority_order_does_not_affect_total_but_all_rules_apply(self):
        engine = PricingEngine(
            custom_rules=[
                CustomRule(name="fee_b", rule_type="fixed", value=10.0, priority=5),
                CustomRule(name="fee_a", rule_type="fixed", value=15.0, priority=1),
            ]
        )
        result = engine.calculate(
            rfq_id="custom-priority", target_currency="JOD",
            destination_port="Aqaba", products=self._products(),
        )
        assert result["custom_fees_total"] == pytest.approx(25.0)
        names = [r["name"] for r in result["custom_rules_applied"]]
        assert names == ["fee_a", "fee_b"]  # sorted by priority
