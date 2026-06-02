"""
AI-Sourcing Hub — JSON Repair Utilities

Attempts to repair malformed JSON from LLM responses.
Uses the `json-repair` library if available, with a fallback heuristic.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import json
import re
from typing import Any, Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Repair
# ═══════════════════════════════════════════════════════════

def repair_json(raw: str) -> Optional[dict[str, Any]]:
    """Attempt to repair and parse a potentially malformed JSON string.

    Strategy:
        1. Try json.loads() directly.
        2. Try json-repair library (if installed).
        3. Fallback: extract JSON-like content with regex.

    Args:
        raw: Raw string potentially containing JSON.

    Returns:
        Parsed dict, or None if all strategies fail.
    """
    # Strategy 1: Direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strategy 2: json-repair library
    try:
        from json_repair import repair_json as repair

        repaired = repair(raw)
        if repaired:
            return json.loads(repaired)
    except (ImportError, json.JSONDecodeError, Exception) as exc:
        logger.debug("json-repair library failed", extra={"error": str(exc)})

    # Strategy 3: Regex fallback — extract first {…} block
    try:
        brace_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if brace_match:
            return json.loads(brace_match.group(0))
    except (json.JSONDecodeError, Exception):
        pass

    logger.warning("All JSON repair strategies failed", extra={"raw_preview": raw[:200]})
    return None
