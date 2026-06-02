"""
AI-Sourcing Hub — JSON Repair Utilities for Vision VLM Output

Attempts to repair and validate malformed JSON from Vision VLM responses.
Uses the `json-repair` library if available, with manual fallbacks.

Strategy (6 steps):
    1. Strip markdown code fences
    2. Attempt direct json.loads() (fast path)
    3. Use json-repair library (handles 90% of corruption)
    4. Regex extraction of JSON array + repair
    5. Partial salvage via regex field extraction
    6. Return None for complete failure
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import json
import re
from typing import Any, Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)

# Expected fields in a vision extraction result item
REQUIRED_KEYS = {"product_name", "model_number", "unit_price_rmb"}
ALL_KEYS = {
    "product_name", "model_number", "unit_price_rmb",
    "moq", "weight_kg", "dimensions", "material",
}


# ═══════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════


def repair_vision_json(raw: str) -> Optional[list[dict]]:
    """Repair and validate JSON output from Vision VLM.

    Uses json-repair library as the primary repair mechanism,
    with manual fallbacks for edge cases the library cannot handle.

    Args:
        raw: Raw text output from the Vision VLM.

    Returns:
        List of validated product dicts, or None if all repair strategies fail.
    """
    if not raw or not raw.strip():
        return None

    # Step 1: Strip markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Remove opening ```json or ``` and closing ```
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned[3:]
        # Remove trailing ```
        idx = cleaned.rfind("```")
        if idx != -1:
            cleaned = cleaned[:idx].strip()

    # Also strip leading "json" tag
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()

    # Step 2: Attempt direct parse first (fast path)
    try:
        result = json.loads(cleaned)
        validated = _validate_result(result)
        if validated:
            return validated
    except json.JSONDecodeError:
        pass

    # Step 3: Use json-repair library (handles 90% of corruption cases)
    try:
        from json_repair import repair_json as repair_lib

        repaired = repair_lib(cleaned)
        if repaired:
            result = json.loads(repaired) if isinstance(repaired, str) else repaired
            validated = _validate_result(result)
            if validated:
                return validated
    except (ImportError, json.JSONDecodeError, ValueError, Exception) as exc:
        logger.debug("json-repair library failed", extra={"error": str(exc)})

    # Step 4: Manual regex extraction fallback
    # Try to find JSON array pattern
    array_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if array_match:
        try:
            from json_repair import repair_json as repair_lib

            repaired = repair_lib(array_match.group())
            if repaired:
                result = json.loads(repaired) if isinstance(repaired, str) else repaired
                validated = _validate_result(result)
                if validated:
                    return validated
        except (ImportError, json.JSONDecodeError, ValueError, Exception) as exc:
            logger.debug("Regex + json-repair fallback failed", extra={"error": str(exc)})

    # Step 5: Partial salvage — extract individual fields
    partial_items = _salvage_partial_data(cleaned)
    if partial_items:
        return partial_items

    # Step 6: Complete failure
    logger.warning(
        "All JSON repair strategies failed",
        extra={"raw_preview": raw[:300]},
    )
    return None


# ═══════════════════════════════════════════════════════════
# Validation
# ═══════════════════════════════════════════════════════════


def _validate_result(result: Any) -> Optional[list[dict]]:
    """Validate that result is a list of dicts with required keys.

    Args:
        result: Parsed JSON (could be list, dict, or other).

    Returns:
        List of validated product dicts, or None if validation fails.
    """
    if not isinstance(result, list):
        return None

    validated: list[dict] = []
    for item in result:
        if not isinstance(item, dict):
            continue
        # Must have at least product_name or model_number
        if "product_name" not in item and "model_number" not in item:
            continue
        # Ensure numeric fields are proper types
        if "unit_price_rmb" in item and item["unit_price_rmb"] is not None:
            try:
                item["unit_price_rmb"] = float(item["unit_price_rmb"])
            except (ValueError, TypeError):
                item["unit_price_rmb"] = None
        if "moq" in item and item["moq"] is not None:
            try:
                item["moq"] = int(float(item["moq"]))
            except (ValueError, TypeError):
                item["moq"] = None
        if "weight_kg" in item and item["weight_kg"] is not None:
            try:
                item["weight_kg"] = float(item["weight_kg"])
            except (ValueError, TypeError):
                item["weight_kg"] = None
        validated.append(item)

    return validated if validated else None


# ═══════════════════════════════════════════════════════════
# Partial Salvage
# ═══════════════════════════════════════════════════════════


def _salvage_partial_data(text: str) -> Optional[list[dict]]:
    """Last-resort: regex-scan for product_name + price pairs.

    Used when structured JSON parsing fails completely, but the text
    still contains recognizable field:value patterns.

    Args:
        text: Raw or partially cleaned VLM output.

    Returns:
        List of partial product dicts, or None if nothing salvageable.
    """
    # Try to find 'product_name' : "value" patterns
    products = re.findall(r'"product_name"\s*:\s*"([^"]+)"', text)
    prices = re.findall(r'"unit_price_rmb"\s*:\s*([\d.]+)', text)
    models = re.findall(r'"model_number"\s*:\s*"([^"]*)"', text)

    if not products:
        return None

    items: list[dict] = []
    for i, name in enumerate(products):
        item: dict[str, Any] = {
            "product_name": name,
            "unit_price_rmb": float(prices[i]) if i < len(prices) else None,
            "model_number": models[i] if i < len(models) else None,
        }
        items.append(item)

    return items if items else None


# ═══════════════════════════════════════════════════════════
# Legacy Alias
# ═══════════════════════════════════════════════════════════


def repair_json(raw: str) -> Optional[dict[str, Any]]:
    """Legacy wrapper — repairs JSON and returns a dict.

    This is maintained for backward compatibility with existing callers.
    For new code, prefer repair_vision_json() which returns list[dict].

    Args:
        raw: Raw string potentially containing JSON.

    Returns:
        Parsed dict, or None if all strategies fail.
    """
    result = repair_vision_json(raw)
    if result:
        return {"products": result, "confidence": 0.8}
    return None
