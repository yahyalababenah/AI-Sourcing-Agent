# PaddleOCR PP-Structure Replacement Plan

## Goal

Replace the expensive external Vision LLM API (OpenRouter/Qwen-VL) pipeline with a local, free, offline PaddleOCR PP-Structure table extraction pipeline. This removes all external API costs and network dependency from document processing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Document Processing Pipeline          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Upload ──► MinIO ──► process_document_vision()        │
│                             │                           │
│                    ┌────────┴────────┐                  │
│                    │   Old (VLM)     │   New (OCR)      │
│                    │                 │                  │
│                    │ vision_client   │  ocr_client       │
│                    │ extract_from_   │  extract_table_   │
│                    │ image()         │  local()          │
│                    │                 │                  │
│                    │ OpenRouter/     │  PPStructure      │
│                    │ Together AI API │  (CPU-local)      │
│                    │ $ per call      │  free             │
│                    │ network dep.    │  offline          │
│                    │ 1 page only     │  all pages        │
│                    └────────┬────────┘                  │
│                             │                           │
│                    ┌────────┴────────┐                  │
│                    │  json_repair.py  │  ← stays         │
│                    │  (edge cases)   │                  │
│                    └────────┬────────┘                  │
│                             │                           │
│                    ┌────────┴────────┐                  │
│                    │ sync_document_   │  ← stays         │
│                    │ products()      │                  │
│                    │ (catalog sync)  │                  │
│                    └─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

## Pipeline Comparison

| Aspect | Current VLM Pipeline | New PaddleOCR Pipeline |
|--------|---------------------|----------------------|
| Cost | ~$0.01-0.05 per page | $0 (free, local CPU) |
| Speed | ~3-8s per page (network + API) | ~0.5-2s per page (local) |
| PDF pages | First page only | All pages (configurable limit) |
| Output format | Raw JSON string (often malformed) | Structured HTML table |
| Dependencies | httpx, external API keys | paddlepaddle, paddleocr, pdf2image |
| Network required | Yes | No (fully offline) |
| Language support | Prompt-driven (CN/EN) | Built-in CN/EN recognition |

## Files to Create

### 1. `app/modules/documents/ocr_client.py` — New Local OCR Module

Core logic wrapping PaddleOCR PP-Structure engine.

**Key design decisions:**
- **Lazy initialization**: PPStructure engine loaded on first call (not at import time)
- **`run_in_executor`**: PP-Structure is CPU-bound sync code; wrap with `asyncio.get_event_loop().run_in_executor()` for async compatibility
- **Multi-page PDF**: Process all pages via `pdf2image.convert_from_bytes()`, max 20 pages default
- **HTML table parsing**: Use Python stdlib `html.parser` to extract cell data from PP-Structure's HTML output
- **Column mapping**: Heuristic column detection — match table columns to expected fields (product_name, model_number, unit_price_rmb, etc.) by position or header text
- **Empty result safety**: Return `[]` always, never `None` or raise on empty tables

**Function signature:**
```python
async def extract_table_local(
    file_bytes: bytes,
    file_name: str,
    max_pages: int = 20,
) -> list[dict]:
```

**Internal flow:**
1. Determine file type from extension
2. If PDF: `convert_from_bytes()` → list of PIL images (up to `max_pages`)
3. If image: treat single image as one page
4. For each page image:
   - Save to temp file (PP-Structure reads from disk)
   - Call `engine(img_path)` via `run_in_executor`
   - For each `region` where `type == 'table'`:
     - Parse `res['html']` into column-structured data
     - Match columns to known field names
     - Build product dicts
5. Aggregate all product dicts across all pages
6. Clean up temp files
7. Return `list[dict]`

**HTML table parser strategy:**
```python
_KNOWN_FIELDS = ["product_name", "model_number", "unit_price_rmb", 
                 "moq", "weight_kg", "dimensions", "material"]
_CHINESE_HEADER_MAP = {
    "产品名称": "product_name", "型号": "model_number", 
    "单价": "unit_price_rmb", "MOQ": "moq", "起订量": "moq",
    "重量": "weight_kg", "尺寸": "dimensions", "材料": "material",
    "材质": "material",
}
```

Two strategies for column mapping:
1. **Header-based**: If first row contains known Chinese headers, map by name
2. **Position-based**: If no headers match, assume standard column order `[product_name, model_number, unit_price_rmb, moq, weight_kg, dimensions, material]`

## Files to Modify

### 2. `app/modules/documents/service.py` — Refactor `process_document_vision()`

**Changes:**
- **Line 30**: Remove `from app.modules.documents.vision_client import extract_from_image`
- **Line 31**: Add `from app.modules.documents.ocr_client import extract_table_local`
- **Lines 237-253**: Replace VLM call with local OCR call:

```python
# BEFORE (lines 237-253):
result = await extract_from_image(
    image_bytes=image_bytes,
    media_type=media_type,
    provider=provider,
)
# Try to repair if VLM returned malformed JSON
if isinstance(result, str):
    repaired = repair_json(result)
    ...

# AFTER:
result_list = await extract_table_local(
    file_bytes=file_bytes,
    file_name=doc.file_name,
)
result = {"products": result_list}
```

- Remove `provider` parameter from function signature (or accept but ignore for backward compat)
- Remove `_map_to_media_type()` call (no longer needed for local OCR)
- Remove PDF-to-image conversion for VLM (PP-Structure handles PDF via pages loop)
- Keep `repair_json()` for edge cases where parsing fails
- Update docstring

### 3. `app/modules/documents/tasks.py` — Refactor Celery Task

**Changes:**
- **Line 35**: Remove `from app.modules.documents.vision_client import extract_table_from_image`
- Add `from app.modules.documents.ocr_client import extract_table_local`
- **Lines 207-229**: Replace VLM call with local OCR:

```python
# BEFORE (lines 222-229):
raw_response: str = asyncio.run(
    extract_table_from_image(
        image_bytes=image_bytes,
        media_type=media_type,
        provider=provider,
    )
)

# AFTER:
result_list: list[dict] = asyncio.run(
    extract_table_local(
        file_bytes=file_bytes,
        file_name=doc.file_name,
    )
)
extracted = result_list  # No repair needed for structured output
```

- Remove PDF-to-image conversion (handled inside `extract_table_local`)
- Remove `_map_to_media_type()`, `_pdf_page_to_image()` helpers (no longer needed here)
- Keep `repair_vision_json()` for safety on edge cases

### 4. `app/modules/documents/vision_client.py` — Remove or Deprecate

Two options:
- **Option A (clean break)**: Delete the file entirely
- **Option B (soft deprecation)**: Add deprecation warning, keep file but mark unused

The user said "officially removing" — go with Option A.

### 5. `app/modules/documents/prompt_templates.py` — Remove

No longer referenced after VLM removal. Delete the file.

### 6. `app/config.py` — Update LLM Provider Config

- Make `TOGETHER_API_KEY` and `OPENROUTER_API_KEY` fully optional
- Modify `has_llm_provider` property — no longer required for document processing (still used by `intake/llm_client.py` for translation/RFQ extraction, so keep the fields but mark as document-processing-no-longer-requires)
- No field changes needed since they're already `""` defaults

### 7. `.env.example` — Update Comments

- Comment out `TOGETHER_API_KEY` and `OPENROUTER_API_KEY` as no longer required for document processing
- Add note that they're still used by RFQ extraction/translation

### 8. `requirements.txt` — Add Dependencies

Add these lines:
```
# Local OCR (replaces external Vision LLM API)
paddlepaddle>=3.0.0
paddleocr>=2.8.0
```

Note: `pdf2image` and `pillow` are already present.

## Data Flow Details

### PP-Structure Output → Product Dicts

PP-Structure returns:
```python
[
    {
        'type': 'table',
        'res': {
            'html': '<table><tr><td>产品名称</td><td>型号</td>...</tr>'
                    '<tr><td>不锈钢水龙头</td><td>SL-2000</td>...</tr></table>'
        }
    }
]
```

Parsed to:
```python
[
    {
        "product_name": "不锈钢水龙头",
        "model_number": "SL-2000",
        "unit_price_rmb": 35.0,
        "moq": 50,
        "weight_kg": 0.8,
        "dimensions": "25×8×12cm",
        "material": "304不锈钢"
    }
]
```

### Edge Case Handling

| Scenario | Handling |
|----------|----------|
| Empty document (no table) | Return `[]`, status → `extracted` with 0 products |
| Table with only headers | Return `[]` (skip header row) |
| Partially unreadable cells | Use `None` for missing values |
| Multi-page catalog | Process all pages, aggregate results |
| Very large catalog (>20 pages) | Process first 20 pages, log warning |
| Corrupted image/PDF | Raise ValueError, status → `failed` |
| PP-Structure fails to init | Raise ImportError with install instructions |

## Migration Safety

1. **Backward-compatible API**: The `POST /{id}/process` endpoint signature stays the same; `provider` param is accepted but ignored
2. **Same output format**: `extracted_entities` JSONB structure remains `{"products": [...]}`
3. **Same catalog sync**: `sync_document_products()` reads from `extracted_entities["products"]` — unchanged
4. **Same Status transitions**: `uploaded → processing → extracted | failed`

## Testing Plan

1. **Unit test**: Test `extract_table_local()` with a sample JPEG catalog image
2. **Unit test**: Test HTML table parser with various table structures
3. **Unit test**: Verify empty `[]` returns cleanly
4. **Integration test**: Upload a PDF catalog via API, trigger processing, verify products appear in catalog
5. **Edge case**: Upload an image without a table — verify `[]` and no 500 error
