"""
AI-Sourcing Hub — Local OCR Client using PaddleOCR PP-Structure

Replaces the expensive external Vision LLM API (OpenRouter/Qwen-VL)
with a free, local, offline PaddleOCR PP-Structure table extraction engine.

Pipeline:
    1. Accept raw file bytes (PDF or image)
    2. If PDF: convert all pages to images via pdf2image
    3. For each page: run PP-Structure engine (CPU) to detect tables
    4. Parse PP-Structure HTML table output into structured product dicts
    5. Aggregate all products across all pages
    6. Return list[dict] matching the same format as the old VLM pipeline

Key design decisions:
    - Lazy engine initialisation (first-call init) to avoid import-time cost
    - CPU-bound sync engine wrapped via run_in_executor() for async callers
    - Multi-page PDF support (old VLM pipeline only processed first page)
    - HTML table parsing via Python stdlib html.parser (no extra deps)
    - Heuristic column mapping: Chinese headers → English field names
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import os
import tempfile
import threading
from html.parser import HTMLParser
from typing import Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════

MAX_PDF_PAGES = 20
PDF_DPI = 200

# Expected output field names (matches catalog/service.py sync_document_products)
KNOWN_FIELDS = [
    "product_name",
    "model_number",
    "unit_price_rmb",
    "moq",
    "weight_kg",
    "dimensions",
    "material",
]

# Minimum ratio of confidently mapped columns to accept heuristic fallback
MIN_CONFIDENT_COLUMN_RATIO = 0.5

# Chinese-to-English column header mapping for PP-Structure table output
CHINESE_HEADER_MAP: dict[str, str] = {
    "产品名称": "product_name",
    "产品名": "product_name",
    "名称": "product_name",
    "型号": "model_number",
    "规格型号": "model_number",
    "编号": "model_number",
    "货号": "model_number",
    "单价": "unit_price_rmb",
    "价格": "unit_price_rmb",
    "零售价": "unit_price_rmb",
    "出厂价": "unit_price_rmb",
    "moq": "moq",
    "起订量": "moq",
    "最小起订量": "moq",
    "数量": "moq",
    "重量": "weight_kg",
    "毛重": "weight_kg",
    "净重": "weight_kg",
    "尺寸": "dimensions",
    "规格": "dimensions",
    "外形尺寸": "dimensions",
    "材料": "material",
    "材质": "material",
    "物料": "material",
}

# English header aliases (covers common PP-Structure/CSV output in English)
ENGLISH_HEADER_MAP: dict[str, str] = {
    "product name": "product_name",
    "product": "product_name",
    "item": "product_name",
    "description": "product_name",
    "name": "product_name",
    "product description": "product_name",
    "model": "model_number",
    "model no": "model_number",
    "model number": "model_number",
    "part number": "model_number",
    "part no": "model_number",
    "sku": "model_number",
    "unit price": "unit_price_rmb",
    "unit price (rmb)": "unit_price_rmb",
    "price": "unit_price_rmb",
    "price (rmb)": "unit_price_rmb",
    "rmb": "unit_price_rmb",
    "unit price (usd)": "unit_price_rmb",
    "moq": "moq",
    "min order qty": "moq",
    "minimum order quantity": "moq",
    "min qty": "moq",
    "weight": "weight_kg",
    "weight (kg)": "weight_kg",
    "gross weight": "weight_kg",
    "net weight": "weight_kg",
    "kg": "weight_kg",
    "dimensions": "dimensions",
    "size": "dimensions",
    "dimension": "dimensions",
    "measurement": "dimensions",
    "material": "material",
    "materials": "material",
    "specification": "material",
    "spec": "material",
}

# Material-specific keywords for content-based heuristic scoring
MATERIAL_KEYWORDS: set[str] = {
    "steel", "stainless", "plastic", "wood", "glass", "iron", "copper",
    "aluminum", "aluminium", "fabric", "leather", "ceramic", "rubber",
    "silicone", "carbon", "fiber", "nylon", "polyester", "cotton",
    "acrylic", "brass", "bronze", "zinc", "alloy",
}

# ═══════════════════════════════════════════════════════════
# Lazy Engine Singleton
# ═══════════════════════════════════════════════════════════

_table_engine = None
_engine_lock = threading.Lock()


def _get_engine():
    """Get or initialise the PP-Structure engine singleton.

    The engine is initialised lazily on the first call to avoid
    importing heavy PaddleOCR modules at application startup.

    Returns:
        PPStructure engine instance.
    """
    global _table_engine
    if _table_engine is None:
        with _engine_lock:
            # Double-check after acquiring lock — another thread may have
            # already initialised the engine while we were waiting.
            if _table_engine is not None:
                return _table_engine
            logger.info("Initialising PaddleOCR PP-Structure engine (lazy load)...")
            try:
                from paddleocr import PPStructure

                _table_engine = PPStructure(show_log=False, lang="ch")
                logger.info("PP-Structure engine initialised successfully.")
            except ImportError as exc:
                logger.error(
                    "Failed to import PaddleOCR. "
                    "Install it with: pip install paddlepaddle paddleocr",
                    extra={"error": str(exc)},
                )
                raise
            except Exception as exc:
                logger.error(
                    "Failed to initialise PP-Structure engine",
                    extra={"error": str(exc)},
                )
                raise
    return _table_engine


# ═══════════════════════════════════════════════════════════
# HTML Table Parser
# ═══════════════════════════════════════════════════════════


class _TableHtmlParser(HTMLParser):
    """Minimal HTML table parser extracting rows of cell texts.

    Parses PP-Structure HTML output into a list of rows, where each
    row is a list of cell text strings.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._current_row: list[str] = []
        self._current_cell: list[str] = []
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag == "tr":
            self._current_row = []
        elif tag in ("td", "th"):
            self._in_cell = True
            self._current_cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "tr":
            if self._current_row:
                self.rows.append(self._current_row)
            self._current_row = []
        elif tag in ("td", "th"):
            self._in_cell = False
            cell_text = "".join(self._current_cell).strip()
            self._current_row.append(cell_text)
            self._current_cell = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_cell.append(data)


def _parse_table_html(html: str) -> list[list[str]]:
    """Parse an HTML table string into a list of rows (list of cell texts).

    Args:
        html: Raw HTML table string from PP-Structure.

    Returns:
        List of rows, where each row is a list of cell text strings.
    """
    parser = _TableHtmlParser()
    parser.feed(html)
    return parser.rows


def _score_column_content(values: list[str]) -> dict[str, float]:
    """Score each KNOWN_FIELD for how likely it matches column values.

    Analyses the actual cell content across all data rows to infer
    the most likely column type using numeric patterns, units, and keywords.

    Args:
        values: All non-header cell values for one column.

    Returns:
        Dict mapping field name → confidence score (0.0 – 1.0).
    """
    scores: dict[str, float] = {f: 0.0 for f in KNOWN_FIELDS}
    non_empty = [v for v in values if v and v.strip()]
    if not non_empty:
        return scores

    n = len(non_empty)
    numeric_count = 0
    integer_count = 0
    currency_count = 0
    weight_unit_count = 0
    dim_char_count = 0
    material_hits = 0
    total_length = 0

    for v in non_empty:
        cleaned = v.strip()
        total_length += len(cleaned)

        # Check for currency symbols / price indicators
        if any(c in cleaned for c in ("¥", "$", "USD", "RMB", "CNY")):
            currency_count += 1

        # Check for weight units
        cleaned_lower = cleaned.lower()
        if any(unit in cleaned_lower for unit in ("kg", "g ", "gram", "kilogram", "lbs", "pound")):
            weight_unit_count += 1

        # Check for dimension characters
        if any(c in cleaned for c in ("*", "×", "x")) and any(
            unit in cleaned_lower for unit in ("cm", "mm", "inch", "ft")
        ):
            dim_char_count += 1
        elif any(c in cleaned for c in ("*", "×", "x")) and not any(
            c.isalpha() for c in cleaned
        ):
            dim_char_count += 1

        # Check for material keywords
        if any(kw in cleaned_lower for kw in MATERIAL_KEYWORDS):
            material_hits += 1

        # Try numeric parsing
        cleaned_num = (
            cleaned.replace(",", "")
            .replace("¥", "")
            .replace("$", "")
            .replace(" ", "")
            .strip()
        )
        try:
            f_val = float(cleaned_num)
            numeric_count += 1
            # Integers (small enough to be MOQ) vs decimals (likely price/weight)
            if f_val == int(f_val) and abs(f_val) < 100_000:
                integer_count += 1
        except (ValueError, TypeError):
            pass

    numeric_ratio = numeric_count / n
    integer_ratio = integer_count / n
    currency_ratio = currency_count / n
    weight_ratio = weight_unit_count / n
    dim_ratio = dim_char_count / n
    material_ratio = material_hits / n
    avg_len = total_length / n

    # ── Score each field based on column characteristics ──────
    # unit_price_rmb: mostly numeric (decimals), often with currency symbols
    if currency_ratio > 0.3:
        scores["unit_price_rmb"] = 0.5 * currency_ratio + 0.3 * numeric_ratio + 0.2
    elif numeric_ratio > 0.7 and integer_ratio / max(numeric_ratio, 0.01) < 0.6:
        scores["unit_price_rmb"] = 0.6 * numeric_ratio

    # moq: small integers, no currency/weight indicators
    if integer_ratio > 0.7 and currency_ratio < 0.1 and weight_ratio < 0.1:
        scores["moq"] = 0.7 * integer_ratio + 0.3 * (1 - weight_ratio)

    # weight_kg: has weight units, or mostly numeric with decimal
    if weight_ratio > 0.2:
        scores["weight_kg"] = 0.8 * weight_ratio + 0.2 * numeric_ratio
    elif numeric_ratio > 0.5 and avg_len < 15 and integer_ratio < 0.4:
        scores["weight_kg"] = 0.4 * numeric_ratio

    # dimensions: contains * or ×, or has unit suffixes
    if dim_ratio > 0.2:
        scores["dimensions"] = 0.8 * dim_ratio + 0.2 * (1 - numeric_ratio)

    # product_name: longer text, low numeric ratio, may contain Chinese
    if numeric_ratio < 0.3 and avg_len > 5:
        scores["product_name"] = (
            0.4 * (1 - numeric_ratio)
            + 0.4 * min(avg_len / 30, 1.0)
            + 0.2 * (1 - weight_ratio)
        )

    # model_number: short alphanumeric, moderate numeric mix
    if 0.2 < numeric_ratio < 0.8 and avg_len < 20 and dim_ratio < 0.1:
        scores["model_number"] = (
            0.5 * (1 - abs(numeric_ratio - 0.5) * 2)
            + 0.3 * (1 - min(avg_len / 20, 1.0))
            + 0.2 * (1 - dim_ratio)
        )

    # material: contains material keywords, not numeric
    if material_ratio > 0.2:
        scores["material"] = 0.8 * material_ratio + 0.2 * (1 - numeric_ratio)
    elif numeric_ratio < 0.2 and avg_len > 8 and dim_ratio < 0.1:
        scores["material"] = 0.3 * (1 - numeric_ratio)

    return scores


def _infer_column_mapping(
    headers: list[str],
    data_rows: Optional[list[list[str]]] = None,
) -> list[Optional[str]]:
    """Map table header names to known field names.

    Uses Chinese/English header matching first. Falls back to content-based
    heuristic analysis of the data rows. Last resort is positional mapping
    with a strong warning.

    Args:
        headers: List of header cell strings from the first table row.
        data_rows: Data rows (excluding header) for content-based analysis.

    Returns:
        List of field names (or None for unmapped columns) same length as headers.
    """
    mapping: list[Optional[str]] = []

    # ── Phase 1: Try Chinese header matching ─────────────────
    found_any = False
    for h in headers:
        stripped = h.strip().lower()
        if stripped in CHINESE_HEADER_MAP:
            mapping.append(CHINESE_HEADER_MAP[stripped])
            found_any = True
        else:
            mapping.append(None)

    if found_any:
        return mapping

    # ── Phase 2: Try English header matching ─────────────────
    found_any = False
    mapping = []
    for h in headers:
        stripped = h.strip().lower()
        if stripped in ENGLISH_HEADER_MAP:
            mapping.append(ENGLISH_HEADER_MAP[stripped])
            found_any = True
        else:
            mapping.append(None)

    if found_any:
        return mapping

    # ── Phase 3: Content-based heuristic (if data rows provided) ──
    if data_rows:
        # Transpose: collect all values per column across all data rows
        num_cols = len(headers)
        columns_values: list[list[str]] = [[] for _ in range(num_cols)]
        for row in data_rows:
            for col_idx, cell in enumerate(row):
                if col_idx < num_cols:
                    columns_values[col_idx].append(cell)

        # Score each column
        col_scores: list[dict[str, float]] = [
            _score_column_content(vals) for vals in columns_values
        ]

        # Greedy assignment: assign highest-scoring unused field per column
        used_fields: set[str] = set()
        heuristic_mapping: list[Optional[str]] = [None] * num_cols
        confident_count = 0

        # Sort columns by their max score (highest confidence first)
        col_order = sorted(
            range(num_cols),
            key=lambda i: max(col_scores[i].values(), default=0.0),
            reverse=True,
        )

        for col_idx in col_order:
            # Find best unused field for this column
            sorted_fields = sorted(
                col_scores[col_idx].items(),
                key=lambda kv: kv[1],
                reverse=True,
            )
            for field, score in sorted_fields:
                if field not in used_fields and score > 0.3:
                    heuristic_mapping[col_idx] = field
                    used_fields.add(field)
                    if score >= 0.5:
                        confident_count += 1
                    break

        # Accept heuristic mapping if enough columns are confidently mapped
        if num_cols > 0 and confident_count / num_cols >= MIN_CONFIDENT_COLUMN_RATIO:
            logger.info(
                "Content-based column mapping assigned %d/%d columns confidently",
                confident_count,
                num_cols,
            )
            return heuristic_mapping

        # If heuristic found at least a partial mapping, log what we got
        assigned = sum(1 for f in heuristic_mapping if f is not None)
        if assigned > 0:
            logger.warning(
                "Content-based heuristic only confident on %d/%d columns "
                "(%d partially assigned). Falling through to positional.",
                confident_count,
                num_cols,
                assigned,
            )

    # ── Phase 4: Positional fallback (last resort) ─────────────
    logger.warning(
        "No known headers matched and content analysis insufficient — "
        "falling back to positional mapping for %d columns. "
        "Extracted data may have incorrect field assignments.",
        len(headers),
    )
    mapping = []
    for i in range(len(headers)):
        if i < len(KNOWN_FIELDS):
            mapping.append(KNOWN_FIELDS[i])
        else:
            mapping.append(None)

    return mapping


def _rows_to_products(rows: list[list[str]]) -> list[dict]:
    """Convert parsed HTML table rows to product dicts.

    Skips the header row (first row) after using it for column mapping.

    Args:
        rows: List of rows from _parse_table_html().

    Returns:
        List of product dicts with known field names.
    """
    if not rows:
        return []

    # Use first row as header for column mapping
    headers = rows[0] if rows else []
    data_rows = rows[1:]  # Skip header row
    column_map = _infer_column_mapping(headers, data_rows)

    products: list[dict] = []

    for row in data_rows:
        product: dict[str, Optional[str | float | int]] = {}
        has_product_name = False

        for idx, cell_text in enumerate(row):
            if idx >= len(column_map):
                break
            field = column_map[idx]
            if field is None:
                continue

            value: Optional[str | float | int] = cell_text.strip()
            if not value:
                value = None

            # Type conversion for numeric fields
            if value is not None and field in (
                "unit_price_rmb",
                "weight_kg",
            ):
                try:
                    value = float(value.replace(",", "").replace("¥", "").strip())
                except (ValueError, AttributeError):
                    value = None

            if value is not None and field in ("moq",):
                try:
                    value = int(
                        float(value.replace(",", "").replace(" ", "").strip())
                    )
                except (ValueError, AttributeError):
                    value = None

            product[field] = value

            if field == "product_name" and value is not None:
                has_product_name = True

        if has_product_name:
            products.append(product)
        else:
            # Check if row has valuable numeric data despite missing product name
            has_numeric_data = any(
                product.get(f) is not None
                for f in ("unit_price_rmb", "moq", "weight_kg")
            )
            if has_numeric_data:
                logger.warning(
                    "Row has numeric data but no product name — including with placeholder: %s",
                    product,
                )
                product["product_name"] = "(غير محدد)"
                products.append(product)
            else:
                logger.warning(
                    "Skipping row with no product name and no numeric data: %s",
                    product,
                )

    return products


# ═══════════════════════════════════════════════════════════
# Core OCR Function
# ═══════════════════════════════════════════════════════════


async def extract_table_local(
    file_bytes: bytes,
    file_name: str,
    max_pages: int = MAX_PDF_PAGES,
) -> list[dict]:
    """Extract structured product table data using local PaddleOCR PP-Structure.

    Handles both single images and multi-page PDFs. Processes all pages
    up to ``max_pages`` and aggregates results.

    Args:
        file_bytes: Raw file bytes (PDF or image).
        file_name: Original file name (used to determine file type).
        max_pages: Maximum PDF pages to process (default: 20).

    Returns:
        List of product dicts with fields:
            product_name, model_number, unit_price_rmb, moq,
            weight_kg, dimensions, material.

        Returns an empty list if no tables are found.

    Raises:
        ImportError: If PaddleOCR is not installed.
        ValueError: If the file format is unsupported or conversion fails.
    """
    ext = os.path.splitext(file_name)[1].lower()

    # ── Step 1: Convert input to list of image paths ──────────
    image_paths: list[str] = []

    try:
        if ext in (".pdf",):
            # Multi-page PDF → convert all pages to temp images
            from pdf2image import convert_from_bytes

            pages = convert_from_bytes(file_bytes, dpi=PDF_DPI)
            logger.info(
                "PDF has %d pages, processing up to %d",
                len(pages),
                min(len(pages), max_pages),
            )

            for i, page in enumerate(pages):
                if i >= max_pages:
                    logger.warning(
                        "Reached max_pages limit (%d), stopping PDF processing",
                        max_pages,
                    )
                    break
                tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                page.save(tmp.name, "JPEG")
                image_paths.append(tmp.name)
        elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"):
            # Single image → write to temp file
            tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            tmp.write(file_bytes)
            tmp.close()
            image_paths.append(tmp.name)
        else:
            # Unknown type — try as PNG (or raise)
            if ext in (".png",):
                tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
                tmp.write(file_bytes)
                tmp.close()
                image_paths.append(tmp.name)
            else:
                raise ValueError(
                    f"Unsupported file extension '{ext}'. "
                    f"Supported: .pdf, .jpg, .jpeg, .png, .webp, .bmp, .tiff"
                )
    except ImportError:
        raise ImportError(
            "pdf2image is not installed. Install it with: pip install pdf2image"
        )
    except Exception as exc:
        raise ValueError(f"Failed to prepare images for OCR: {exc}")

    # ── Step 2: Run PP-Structure on each image ────────────────
    engine = _get_engine()
    all_products: list[dict] = []

    try:
        for img_path in image_paths:
            try:
                # PP-Structure is CPU-bound — run in thread pool
                result = await asyncio.get_event_loop().run_in_executor(
                    None, engine, img_path
                )

                for region in result:
                    if region.get("type") == "table":
                        html = region.get("res", {}).get("html", "")
                        if not html:
                            continue

                        rows = _parse_table_html(html)
                        products = _rows_to_products(rows)
                        all_products.extend(products)
                        logger.debug(
                            "Extracted %d products from page image %s",
                            len(products),
                            os.path.basename(img_path),
                        )

            except Exception as exc:
                logger.warning(
                    "PP-Structure failed on image %s: %s",
                    os.path.basename(img_path),
                    exc,
                )
                continue  # Skip problematic pages, continue with others
    finally:
        # ── Step 3: Clean up temp files ───────────────────────
        for img_path in image_paths:
            try:
                os.unlink(img_path)
            except OSError:
                pass

    logger.info(
        "Local OCR complete — extracted %d products total",
        len(all_products),
    )

    return all_products
