"""
AI-Sourcing Hub — Safe Formula Evaluator for Custom Pricing Rules

Evaluates small arithmetic expressions entered by admins for "formula"-type
pricing rules (e.g. `max(50, cif * 0.02)`), without using `eval()`. Parses to
an AST and walks it against a strict whitelist of node types, function names,
and variable names.
"""
from __future__ import annotations

import ast
import math
from typing import Mapping

MAX_FORMULA_LENGTH = 300

# Variables made available to a formula, evaluated per shipment line.
FORMULA_VARIABLES: frozenset[str] = frozenset({
    "unit_price_cny",
    "unit_price_usd",
    "unit_price_local",
    "quantity",
    "weight_kg",
    "total_weight_kg",
    "cbm",
    "freight",
    "insurance",
    "cif",
    "customs",
    "clearance",
    "commission",
    "exchange_rate",
    "subtotal",
    "line_total",
})

_ALLOWED_FUNCS: dict[str, object] = {
    "min": min,
    "max": max,
    "round": round,
    "abs": abs,
}

_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow)
_ALLOWED_UNARYOPS = (ast.UAdd, ast.USub)
_ALLOWED_CMPOPS = (ast.Gt, ast.GtE, ast.Lt, ast.LtE, ast.Eq, ast.NotEq)
_ALLOWED_BOOLOPS = (ast.And, ast.Or)


class FormulaError(ValueError):
    """Raised when a formula is malformed, unsafe, or fails to evaluate."""


def _check_node(node: ast.AST) -> list[str]:
    """Recursively validate a single AST node, returning a list of error strings."""
    errors: list[str] = []

    if isinstance(node, ast.Expression):
        errors += _check_node(node.body)
    elif isinstance(node, ast.Constant):
        if not isinstance(node.value, (int, float)) or isinstance(node.value, bool):
            errors.append("القيم المسموحة أرقام فقط")
    elif isinstance(node, ast.Name):
        if node.id not in FORMULA_VARIABLES:
            errors.append(f"متغير غير معروف: {node.id}")
    elif isinstance(node, ast.BinOp):
        if not isinstance(node.op, _ALLOWED_BINOPS):
            errors.append("عملية حسابية غير مسموحة")
        if isinstance(node.op, ast.Pow):
            base, exp = node.left, node.right
            if isinstance(exp, ast.Constant) and isinstance(exp.value, (int, float)):
                if abs(exp.value) > 6:
                    errors.append("الأس الأسّي كبير جداً (الحد الأقصى 6)")
            errors += _check_node(base)
            errors += _check_node(exp)
            return errors
        errors += _check_node(node.left)
        errors += _check_node(node.right)
    elif isinstance(node, ast.UnaryOp):
        if not isinstance(node.op, _ALLOWED_UNARYOPS):
            errors.append("عملية أحادية غير مسموحة")
        errors += _check_node(node.operand)
    elif isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCS:
            errors.append("دالة غير مسموحة — المسموح: min, max, round, abs")
        else:
            for arg in node.args:
                errors += _check_node(arg)
        if node.keywords:
            errors.append("لا يُسمح بمعاملات مسمّاة في الدوال")
    elif isinstance(node, ast.IfExp):
        errors += _check_node(node.test)
        errors += _check_node(node.body)
        errors += _check_node(node.orelse)
    elif isinstance(node, ast.Compare):
        for op in node.ops:
            if not isinstance(op, _ALLOWED_CMPOPS):
                errors.append("عملية مقارنة غير مسموحة")
        errors += _check_node(node.left)
        for comparator in node.comparators:
            errors += _check_node(comparator)
    elif isinstance(node, ast.BoolOp):
        if not isinstance(node.op, _ALLOWED_BOOLOPS):
            errors.append("عملية منطقية غير مسموحة")
        for value in node.values:
            errors += _check_node(value)
    else:
        errors.append(f"عنصر غير مسموح في المعادلة: {type(node).__name__}")

    return errors


def validate_formula(expr: str) -> list[str]:
    """Return a list of Arabic error messages; empty list means the formula is valid."""
    if not expr or not expr.strip():
        return ["المعادلة فارغة"]
    if len(expr) > MAX_FORMULA_LENGTH:
        return [f"المعادلة طويلة جداً (الحد الأقصى {MAX_FORMULA_LENGTH} حرفاً)"]

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        return ["صيغة المعادلة غير صحيحة"]

    errors = _check_node(tree)
    if errors:
        return errors

    # Trial-evaluate with all variables set to 1.0 to catch structural issues
    # (e.g. division by a zero constant) that only surface at evaluation time.
    try:
        evaluate_formula(expr, {name: 1.0 for name in FORMULA_VARIABLES})
    except FormulaError as exc:
        return [str(exc)]

    return []


def _eval_node(node: ast.AST, context: Mapping[str, float]) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, context)
    if isinstance(node, ast.Constant):
        return float(node.value)
    if isinstance(node, ast.Name):
        if node.id not in context:
            raise FormulaError(f"متغير غير معروف: {node.id}")
        return float(context[node.id])
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left, context)
        right = _eval_node(node.right, context)
        try:
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.FloorDiv):
                return left // right
            if isinstance(node.op, ast.Mod):
                return left % right
            if isinstance(node.op, ast.Pow):
                if abs(left) > 1e6 or abs(right) > 6:
                    raise FormulaError("قيمة الأس أو الأساس كبيرة جداً")
                return left ** right
        except ZeroDivisionError as exc:
            raise FormulaError("قسمة على صفر") from exc
        raise FormulaError("عملية حسابية غير مسموحة")
    if isinstance(node, ast.UnaryOp):
        val = _eval_node(node.operand, context)
        if isinstance(node.op, ast.USub):
            return -val
        if isinstance(node.op, ast.UAdd):
            return +val
        raise FormulaError("عملية أحادية غير مسموحة")
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCS:
            raise FormulaError("دالة غير مسموحة")
        func = _ALLOWED_FUNCS[node.func.id]
        args = [_eval_node(arg, context) for arg in node.args]
        # round()'s second argument (ndigits) must be an int in CPython —
        # every value flowing through this evaluator is otherwise a float.
        if node.func.id == "round" and len(args) == 2:
            args[1] = int(args[1])
        return float(func(*args))
    if isinstance(node, ast.IfExp):
        test = _eval_node(node.test, context)
        return _eval_node(node.body, context) if test else _eval_node(node.orelse, context)
    if isinstance(node, ast.Compare):
        left = _eval_node(node.left, context)
        result = True
        for op, comparator in zip(node.ops, node.comparators):
            right = _eval_node(comparator, context)
            if isinstance(op, ast.Gt):
                result = result and (left > right)
            elif isinstance(op, ast.GtE):
                result = result and (left >= right)
            elif isinstance(op, ast.Lt):
                result = result and (left < right)
            elif isinstance(op, ast.LtE):
                result = result and (left <= right)
            elif isinstance(op, ast.Eq):
                result = result and (left == right)
            elif isinstance(op, ast.NotEq):
                result = result and (left != right)
            else:
                raise FormulaError("عملية مقارنة غير مسموحة")
            left = right
        return 1.0 if result else 0.0
    if isinstance(node, ast.BoolOp):
        values = [_eval_node(v, context) for v in node.values]
        if isinstance(node.op, ast.And):
            return 1.0 if all(values) else 0.0
        if isinstance(node.op, ast.Or):
            return 1.0 if any(values) else 0.0
        raise FormulaError("عملية منطقية غير مسموحة")

    raise FormulaError(f"عنصر غير مسموح في المعادلة: {type(node).__name__}")


def evaluate_formula(expr: str, context: Mapping[str, float]) -> float:
    """Evaluate a validated formula string against a variable context.

    Raises FormulaError on any structural, unsafe, or numerical issue.
    """
    if len(expr) > MAX_FORMULA_LENGTH:
        raise FormulaError(f"المعادلة طويلة جداً (الحد الأقصى {MAX_FORMULA_LENGTH} حرفاً)")
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise FormulaError("صيغة المعادلة غير صحيحة") from exc

    errors = _check_node(tree)
    if errors:
        raise FormulaError("; ".join(errors))

    result = _eval_node(tree, context)
    if not math.isfinite(result):
        raise FormulaError("نتيجة المعادلة غير محدودة (لانهاية أو NaN)")
    return result
