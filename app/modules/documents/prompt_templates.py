"""
AI-Sourcing Hub — Document OCR / Vision Prompt Templates

Prompts for Qwen2.5-VL-72B (or similar VLM) to extract structured table data
from Chinese factory PDFs/images, product spec sheets, and quotations.

Designed for industrial document parsing with focus on table extraction accuracy.
"""
# ═══════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════

# JSON schema hint embedded in the prompt to guide LLM output structure
TABLE_EXPECTED_FIELDS = [
    "product_name",      # Chinese product name
    "model_number",      # Model/SKU/Part number
    "unit_price_rmb",    # Unit price in RMB (number only)
    "moq",               # Minimum order quantity
    "weight_kg",         # Weight per unit in kg
    "dimensions",        # Dimensions (L×W×H in cm or mm)
    "material",          # Material composition
]

# ═══════════════════════════════════════════════════════════
# System Prompt — Chinese Industrial Table Extraction
# ═══════════════════════════════════════════════════════════

VISION_EXTRACT_SYSTEM_PROMPT = (
    "You are a Chinese industrial document parser. Extract all table rows "
    "from the provided document image.\n\n"
    "Rules:\n"
    "1. Extract ALL visible table rows — do not skip any\n"
    "2. Return ONLY a valid JSON array of objects — no extra text, no markdown\n"
    "3. ALWAYS include 'product_name' even if it's the only field you can read\n"
    "4. If a value is missing or illegible, use null — do NOT guess\n"
    "5. Numbers should be raw numeric values without currency symbols or commas\n"
    "6. Preserve Chinese text exactly as written (do not translate or simplify)\n"
    "7. If the document has multiple tables, concatenate all rows into one array\n\n"
    "IMPORTANT — Do NOT include:\n"
    '- Header rows (e.g., "产品名称", "型号", "单价") as data entries\n'
    '- Footer rows (totals, summaries, page numbers)\n'
    '- Any explanatory text before or after the JSON array\n\n'
    "Expected JSON structure:\n"
    "[\n"
    '    {\n'
    '        "product_name": "产品名称 (required)",\n'
    '        "model_number": "型号 (or null)",\n'
    '        "unit_price_rmb": 12.50,\n'
    '        "moq": 100,\n'
    '        "weight_kg": 0.5,\n'
    '        "dimensions": "10×5×3cm",\n'
    '        "material": "不锈钢 (or null)"\n'
    "    }\n"
    "]\n\n"
    "Examples of CORRECT output:\n"
    "[\n"
    '    {"product_name": "不锈钢水龙头", "model_number": "SL-2000", '
    '"unit_price_rmb": 35.00, "moq": 50, "weight_kg": 0.8, '
    '"dimensions": "25×8×12cm", "material": "304不锈钢"},\n'
    '    {"product_name": "铜球阀", "model_number": "QF-100", '
    '"unit_price_rmb": 18.50, "moq": 200, "weight_kg": 0.3, '
    '"dimensions": "10×10×5cm", "material": "黄铜"}\n'
    "]\n\n"
    "Examples of INCORRECT output (headers-as-data):\n"
    '❌ [{"product_name": "产品名称", "model_number": "型号", ...}] — '
    "This is a header row, DO NOT include it\n\n"
    "If the image contains no product table (e.g., it is a photo, not a document), "
    'return [] (empty array). Do not make up data.'
)

# ═══════════════════════════════════════════════════════════
# User Prompt
# ═══════════════════════════════════════════════════════════

VISION_EXTRACT_USER_PROMPT = (
    "Extract all product table rows from this document image. "
    "Return ONLY a valid JSON array of objects with fields: "
    "product_name, model_number, unit_price_rmb, moq, weight_kg, "
    "dimensions, material. Use null for missing values."
)
