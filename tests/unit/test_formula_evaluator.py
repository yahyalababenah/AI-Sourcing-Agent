"""
AI-Sourcing Hub — Safe Formula Evaluator Tests

Covers app.modules.pricing.formula: the AST-based evaluator used by
"formula"-type custom pricing rules. No eval()/exec() is used in the
implementation — these tests confirm the whitelist actually holds.
"""
import math

import pytest

from app.modules.pricing.formula import (
    FormulaError,
    evaluate_formula,
    validate_formula,
)

CTX = {
    "unit_price_cny": 100.0,
    "unit_price_usd": 14.0,
    "unit_price_local": 10.47,
    "quantity": 50.0,
    "weight_kg": 2.0,
    "total_weight_kg": 100.0,
    "cbm": 0.2,
    "freight": 15.0,
    "insurance": 1.0,
    "cif": 120.0,
    "customs": 12.0,
    "clearance": 5.0,
    "commission": 3.0,
    "exchange_rate": 0.1047,
    "subtotal": 500.0,
    "line_total": 550.0,
}


class TestArithmetic:
    def test_basic_arithmetic(self):
        assert evaluate_formula("2 + 3 * 4", CTX) == 14

    def test_variables_and_arithmetic(self):
        assert evaluate_formula("cif * 0.02", CTX) == pytest.approx(2.4)

    def test_min_max_round_abs(self):
        assert evaluate_formula("max(50, cif * 0.02)", CTX) == 50
        assert evaluate_formula("min(50, cif * 0.02)", CTX) == pytest.approx(2.4)
        assert evaluate_formula("round(cif / 7, 2)", CTX) == round(120.0 / 7, 2)
        assert evaluate_formula("abs(-5)", CTX) == 5

    def test_conditional_expression(self):
        assert evaluate_formula("50 if quantity > 10 else 10", CTX) == 50
        assert evaluate_formula("50 if quantity > 1000 else 10", CTX) == 10

    def test_comparison_and_boolop(self):
        assert evaluate_formula("1 if (quantity > 10 and cif > 100) else 0", CTX) == 1
        assert evaluate_formula("1 if (quantity > 1000 or cif > 100) else 0", CTX) == 1

    def test_floor_div_and_mod(self):
        assert evaluate_formula("quantity // 7", CTX) == 50 // 7
        assert evaluate_formula("quantity % 7", CTX) == 50 % 7


class TestSafetyRejections:
    """The evaluator must reject anything beyond arithmetic on known variables."""

    def test_rejects_dunder_import(self):
        with pytest.raises(FormulaError):
            evaluate_formula("__import__('os').system('echo hi')", CTX)

    def test_rejects_attribute_access(self):
        with pytest.raises(FormulaError):
            evaluate_formula("cif.__class__", CTX)

    def test_rejects_unknown_function(self):
        with pytest.raises(FormulaError):
            evaluate_formula("open('/etc/passwd')", CTX)

    def test_rejects_unknown_variable(self):
        with pytest.raises(FormulaError):
            evaluate_formula("unknown_var * 2", CTX)

    def test_rejects_string_literals(self):
        with pytest.raises(FormulaError):
            evaluate_formula("'hello'", CTX)

    def test_rejects_list_or_comprehension(self):
        with pytest.raises(FormulaError):
            evaluate_formula("[x for x in range(10)]", CTX)

    def test_rejects_subscript(self):
        with pytest.raises(FormulaError):
            evaluate_formula("cif[0]", CTX)

    def test_rejects_oversized_exponent(self):
        with pytest.raises(FormulaError):
            evaluate_formula("cif ** 50", CTX)

    def test_rejects_division_by_zero(self):
        with pytest.raises(FormulaError):
            evaluate_formula("cif / 0", CTX)

    def test_rejects_syntax_errors(self):
        with pytest.raises(FormulaError):
            evaluate_formula("cif * ", CTX)

    def test_rejects_non_finite_result(self):
        with pytest.raises(FormulaError):
            evaluate_formula("1e308 * 1e308", CTX)


class TestValidateFormula:
    def test_valid_formula_returns_no_errors(self):
        assert validate_formula("max(50, cif * 0.02)") == []

    def test_empty_formula_returns_error(self):
        assert validate_formula("") != []
        assert validate_formula("   ") != []

    def test_invalid_formula_returns_errors(self):
        errors = validate_formula("__import__('os')")
        assert errors != []

    def test_too_long_formula_returns_error(self):
        errors = validate_formula("cif + " * 200)
        assert errors != []

    def test_unknown_variable_reported_by_name(self):
        errors = validate_formula("totally_unknown * 2")
        assert any("totally_unknown" in e for e in errors)
