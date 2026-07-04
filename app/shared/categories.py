"""
AI-Sourcing Hub — Canonical Product Categories

Single source of truth for the broad product-category buckets used across
the catalog (CatalogProduct.category), supplier profiles
(SupplierProfile.product_categories), and RFQ-to-supplier matching
(app.modules.intake.matcher). Previously this keyword map lived only inside
matcher.py and nothing normalized CatalogProduct.category to the same
buckets at write time, so AI-extracted or manually-edited category text
routinely never matched a real supplier during matching.
"""
import re

# Canonical category buckets. Order is display order in category pickers.
CANONICAL_CATEGORIES: list[str] = [
    "personal care",
    "food & beverage",
    "textiles",
    "plastic & rubber",
    "electronics",
    "machinery",
    "metal & hardware",
    "furniture",
    "paper & packaging",
    "chemicals",
    "glass & ceramics",
]

# Keyword → canonical category, used to infer a bucket from free-text
# product names/specifications. Matched with word-boundary regex to avoid
# false positives (e.g. "rice" inside "price", "oil" inside "soil").
CATEGORY_KEYWORD_MAP: dict[str, str] = {
    "soap": "personal care",
    "shampoo": "personal care",
    "cosmetic": "personal care",
    "cream": "personal care",
    "oil": "personal care",
    "food": "food & beverage",
    "beverage": "food & beverage",
    "snack": "food & beverage",
    "rice": "food & beverage",
    "tea": "food & beverage",
    "spice": "food & beverage",
    "textile": "textiles",
    "fabric": "textiles",
    "cloth": "textiles",
    "garment": "textiles",
    "clothing": "textiles",
    "plastic": "plastic & rubber",
    "rubber": "plastic & rubber",
    "pipe": "plastic & rubber",
    "electronic": "electronics",
    "appliance": "electronics",
    "battery": "electronics",
    "cable": "electronics",
    "machine": "machinery",
    "equipment": "machinery",
    "tool": "machinery",
    "parts": "machinery",
    "metal": "metal & hardware",
    "steel": "metal & hardware",
    "hardware": "metal & hardware",
    "furniture": "furniture",
    "chair": "furniture",
    "table": "furniture",
    "paper": "paper & packaging",
    "packaging": "paper & packaging",
    "box": "paper & packaging",
    "chemical": "chemicals",
    "cleaner": "chemicals",
    "detergent": "chemicals",
    "glass": "glass & ceramics",
    "ceramic": "glass & ceramics",
    "tile": "glass & ceramics",
}


def normalize_category(text: str | None) -> str | None:
    """Map free text to a canonical category bucket, or None if no match.

    Checks for an exact (case-insensitive) canonical bucket name first,
    then falls back to word-boundary keyword scanning.

    Args:
        text: Free text such as an AI-extracted category, product name, or
            product specifications string.

    Returns:
        A canonical category from CANONICAL_CATEGORIES, or None.
    """
    if not text:
        return None
    lowered = text.strip().lower()
    if not lowered:
        return None

    if lowered in CANONICAL_CATEGORIES:
        return lowered

    for keyword, category in CATEGORY_KEYWORD_MAP.items():
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return category

    return None
