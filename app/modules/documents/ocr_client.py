"""
AI-Sourcing Hub — Document Extraction Pipeline

Two-phase pipeline:

Phase 1 — Raw text extraction:
    • PDF  → pypdfium2 (instant, no ML, handles text-based PDFs)
    • Image / scanned PDF → PaddleOCR (skipped gracefully if runtime broken)

Phase 2 — LLM structuring:
    • Raw text is sent to the LLM with a dynamic extraction prompt.
    • The LLM reads whatever columns/headers exist in this specific document
      and returns a JSON array where each object has the fields found in that
      document (not a hardcoded set of columns).
    • Falls back to empty list if no API key is configured or all calls fail.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import threading
from typing import Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)

MAX_PDF_PAGES = 20

# ═══════════════════════════════════════════════════════════
# Phase 1A — pypdfium2 text extraction (PDFs)
# ═══════════════════════════════════════════════════════════


def _pdf_to_text(file_bytes: bytes) -> str:
    """Extract all text from a PDF using pypdfium2.

    Returns the raw multi-line text string, or '' if extraction fails.
    """
    try:
        import pypdfium2 as pdfium
    except ImportError:
        logger.warning("pypdfium2 not installed — skipping PDF text extraction")
        return ""

    try:
        pdf = pdfium.PdfDocument(file_bytes)
    except Exception as exc:
        logger.warning("pypdfium2 could not open PDF: %s", exc)
        return ""

    pages_text: list[str] = []
    for page_idx in range(min(len(pdf), MAX_PDF_PAGES)):
        try:
            page = pdf[page_idx]
            text_page = page.get_textpage()
            try:
                text = "".join(text_page.get_text_bounded())
            except (AttributeError, TypeError):
                text = text_page.get_text_range()
            if text.strip():
                pages_text.append(text.strip())
        except Exception as exc:
            logger.debug("pypdfium2 page %d error: %s", page_idx, exc)

    return "\n\n".join(pages_text)


# ═══════════════════════════════════════════════════════════
# Phase 1B — PaddleOCR (images / scanned PDFs)
# ═══════════════════════════════════════════════════════════

_ocr_engine = None
_ocr_lock = threading.Lock()
_ocr_unavailable = False  # set True permanently on first runtime failure


def _get_ocr_engine():
    global _ocr_engine, _ocr_unavailable
    if _ocr_unavailable:
        return None
    if _ocr_engine is not None:
        return _ocr_engine
    with _ocr_lock:
        if _ocr_engine is not None:
            return _ocr_engine
        if _ocr_unavailable:
            return None
        try:
            from paddleocr import PaddleOCR
            _ocr_engine = PaddleOCR(
                lang="ch",
                use_textline_orientation=False,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
            )
            logger.info("PaddleOCR engine ready")
        except Exception as exc:
            logger.warning("PaddleOCR unavailable (%s) — will skip OCR step", exc)
            _ocr_unavailable = True
    return _ocr_engine


def _ocr_image_to_text(img_path: str) -> str:
    """Run PaddleOCR on an image and return extracted text as a string."""
    engine = _get_ocr_engine()
    if engine is None:
        return ""

    try:
        results = engine.predict(
            img_path,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    except Exception as exc:
        logger.warning("PaddleOCR predict failed: %s", exc)
        global _ocr_unavailable
        _ocr_unavailable = True
        return ""

    # Collect (y_center, x_left, text) then sort top→bottom, left→right
    boxes: list[tuple[float, float, str]] = []
    for page_result in (results or []):
        try:
            rec_texts = getattr(page_result, "rec_texts", None) or []
            dt_boxes  = getattr(page_result, "dt_boxes",  None) or []
            if rec_texts and dt_boxes:
                for box, text in zip(dt_boxes, rec_texts):
                    ys = [p[1] for p in box]; xs = [p[0] for p in box]
                    boxes.append((sum(ys)/len(ys), min(xs), text))
                continue
        except Exception:
            pass
        # Paddle 2.x list-of-tuple fallback
        try:
            for item in page_result:
                box, (text, _) = item
                ys = [p[1] for p in box]; xs = [p[0] for p in box]
                boxes.append((sum(ys)/len(ys), min(xs), text))
        except Exception:
            pass

    if not boxes:
        return ""

    boxes.sort(key=lambda t: t[0])
    lines: list[str] = []
    current_row: list[tuple[float, str]] = []
    y0 = boxes[0][0]
    Y_THRESHOLD = 15.0

    for y, x, text in boxes:
        if abs(y - y0) <= Y_THRESHOLD:
            current_row.append((x, text))
        else:
            if current_row:
                lines.append("  ".join(t for _, t in sorted(current_row)))
            current_row = [(x, text)]
            y0 = y
    if current_row:
        lines.append("  ".join(t for _, t in sorted(current_row)))

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════
# Phase 2 — LLM structuring
# ═══════════════════════════════════════════════════════════

_SYSTEM_PROMPT = """\
You are a universal product data extractor for B2B supplier catalogs.
You work with ANY type of catalog: electronics, furniture, textiles, clothing, food, \
chemicals, machinery, lighting, construction materials, cosmetics, medical supplies, \
or anything else. Never assume what industry you are in — read the document and adapt.

Your job:
1. Read the supplier document text provided by the user.
2. Identify ALL distinct products or items in the document.
3. For each product, extract EVERY field that appears in the document for that product.
   - Use the document's own column headers / labels as field names (translate to English).
   - Do NOT map to a fixed schema — every catalog is different.
4. Return ONLY a valid JSON array. No markdown fences, no explanation, nothing else.

Field naming rules:
- Translate any non-English field name to English (snake_case, e.g. "unit_price").
- Always include "product_name" (or the closest equivalent in the document).
- Common label mappings (not exhaustive — use whatever the document actually has):
    产品名称 / اسم المنتج / Item Name → product_name
    型号 / رقم الموديل / Model / SKU / Article → model_number
    颜色 / Color / Colour / اللون → color
    尺寸 / Size / Dimension / المقاس → size
    材质 / Material / الخامة / الخامات → material
    重量 / Weight / الوزن → weight
    起订量 / MOQ / الحد الأدنى → moq
    出厂单价 / Unit Price / السعر → unit_price
    سعر الجملة / Wholesale Price → wholesale_price
    سعر التجزئة / Retail Price → retail_price
    الكمية / Quantity / Stock → quantity
    الكود / Code / Ref / Reference → code
    الوصف / Description / Notes → description
    الفئة / Category / Type / نوع → category
    العلامة التجارية / Brand / ماركة → brand
    Origin / Country of Origin / بلد المنشأ → origin
    Voltage / Wattage / Power → voltage / wattage / power
    Expiry / Shelf Life / تاريخ الانتهاء → shelf_life
    Fabric / Composition / التركيب → fabric_composition
    Season / الموسم → season
    Gender / الجنس → gender
    Packaging / التعبئة → packaging
    Certification / شهادة → certification

Numeric values: store as numbers, not strings (e.g. 12.5 not "12.5").
Missing field for a product: omit the key entirely — do NOT use null.
If the document has sections or categories, add a "category" field to each product.

Output format (example — your actual fields will differ):
[
  {"product_name": "...", "model_number": "...", "unit_price": 12.5, "moq": 500, "color": "red", ...},
  {"product_name": "...", ...}
]
"""


async def _llm_extract(raw_text: str) -> list[dict]:
    """Send raw document text to the LLM and return structured product list.

    Tries OpenRouter then Together AI. Returns [] if unavailable.
    """
    try:
        from app.config import settings
    except Exception:
        return []

    openrouter_key = getattr(settings, "OPENROUTER_API_KEY", "") or ""
    together_key   = getattr(settings, "TOGETHER_API_KEY",   "") or ""

    if not openrouter_key and not together_key:
        logger.warning("No LLM API key configured — skipping LLM extraction")
        return []

    # Trim to ~8 000 chars so we stay well inside free-tier context limits
    trimmed = raw_text[:8000]
    if len(raw_text) > 8000:
        logger.debug("Document text trimmed from %d to 8 000 chars for LLM", len(raw_text))

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user",   "content": f"Extract all products from this document:\n\n{trimmed}"},
    ]

    # Free OpenRouter models — tried in order (verified available as of 2026-06).
    # On rate limit (429), immediately falls through to the next model.
    OPENROUTER_MODELS = [
        "meta-llama/llama-3.3-70b-instruct:free",       # primary
        "google/gemma-4-31b-it:free",                    # Google Gemma 4
        "qwen/qwen3-next-80b-a3b-instruct:free",         # Qwen3 — good for Chinese
        "openai/gpt-oss-120b:free",                      # OpenAI OSS
        "openai/gpt-oss-20b:free",                       # smaller fallback
        "meta-llama/llama-3.2-3b-instruct:free",         # tiny but works
    ]

    endpoints = []
    if openrouter_key:
        for model in OPENROUTER_MODELS:
            endpoints.append({
                "url":   "https://openrouter.ai/api/v1/chat/completions",
                "key":   openrouter_key,
                "model": model,
            })
    if together_key:
        endpoints.append({
            "url":   "https://api.together.xyz/v1/chat/completions",
            "key":   together_key,
            "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        })

    import httpx

    for ep in endpoints:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    ep["url"],
                    headers={
                        "Authorization": f"Bearer {ep['key']}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model":       ep["model"],
                        "messages":    messages,
                        "temperature": 0.1,
                        "max_tokens":  4096,
                    },
                )

            if resp.status_code == 429:
                logger.warning(
                    "Rate limited by %s model=%s — trying next model",
                    ep["url"], ep["model"],
                )
                continue  # next model immediately, no sleep

            if resp.status_code in (401, 403):
                logger.warning("Auth error for %s model=%s — skipping", ep["url"], ep["model"])
                continue

            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"].strip()

            # Strip markdown fences if the model wrapped the JSON
            content = re.sub(r"^```[a-z]*\s*", "", content, flags=re.IGNORECASE)
            content = re.sub(r"\s*```$",        "", content)
            content = content.strip()

            # Find the JSON array (handle preamble text from chatty models)
            array_start = content.find("[")
            if array_start != -1:
                content = content[array_start:]

            data = json.loads(content)

            if isinstance(data, dict) and "products" in data:
                data = data["products"]

            if isinstance(data, list) and data:
                logger.info(
                    "LLM extracted %d products — model=%s", len(data), ep["model"]
                )
                return data

            logger.warning("LLM returned empty list — model=%s", ep["model"])

        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON from model=%s: %s", ep["model"], exc)
        except Exception as exc:
            logger.warning("LLM call error model=%s: %s", ep["model"], exc)

    return []


# ═══════════════════════════════════════════════════════════
# Public async interface (called by Celery task)
# ═══════════════════════════════════════════════════════════


async def extract_table_local(
    file_bytes: bytes,
    file_name: str,
    max_pages: int = MAX_PDF_PAGES,
) -> list[dict]:
    """Extract structured product data from a document file.

    Pipeline:
        1. Extract raw text (pypdfium2 for PDFs, PaddleOCR for images).
        2. Send raw text to LLM → get back dynamic JSON product list.
        3. If LLM unavailable → return [].

    Args:
        file_bytes: Raw file bytes (PDF or image).
        file_name:  Original file name (used to detect type).
        max_pages:  Max PDF pages to read (default 20).

    Returns:
        List of product dicts with whatever fields the LLM found in the doc.
    """
    import tempfile

    ext = os.path.splitext(file_name)[1].lower()
    is_pdf = ext == ".pdf"

    raw_text = ""

    # ── Phase 1: Extract raw text ──────────────────────────────
    if is_pdf:
        raw_text = await asyncio.get_event_loop().run_in_executor(
            None, _pdf_to_text, file_bytes
        )
        if raw_text.strip():
            logger.info(
                "pypdfium2 extracted %d chars from %s", len(raw_text), file_name
            )
        else:
            logger.info(
                "PDF has no embedded text (%s) — trying PaddleOCR on page images",
                file_name,
            )

    # For images OR scanned PDFs with no embedded text → use PaddleOCR
    if not raw_text.strip():
        image_paths: list[str] = []
        try:
            if is_pdf:
                try:
                    from pdf2image import convert_from_bytes
                    pages = convert_from_bytes(file_bytes, dpi=200)
                    for i, page in enumerate(pages[:max_pages]):
                        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                        page.save(tmp.name, "JPEG")
                        image_paths.append(tmp.name)
                except Exception as exc:
                    logger.warning("pdf2image failed: %s", exc)
            elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"):
                tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
                tmp.write(file_bytes)
                tmp.close()
                image_paths.append(tmp.name)

            ocr_parts: list[str] = []
            for img_path in image_paths:
                page_text = await asyncio.get_event_loop().run_in_executor(
                    None, _ocr_image_to_text, img_path
                )
                if page_text.strip():
                    ocr_parts.append(page_text.strip())

            raw_text = "\n\n".join(ocr_parts)
            if raw_text.strip():
                logger.info(
                    "PaddleOCR extracted %d chars from %s", len(raw_text), file_name
                )

        finally:
            for p in image_paths:
                try:
                    os.unlink(p)
                except OSError:
                    pass

    if not raw_text.strip():
        logger.warning(
            "Could not extract any text from %s — returning empty product list",
            file_name,
        )
        return []

    # ── Phase 2: LLM structuring ───────────────────────────────
    products = await _llm_extract(raw_text)

    if not products:
        logger.warning(
            "LLM returned no products for %s — document marked extracted with 0 items",
            file_name,
        )

    return products
