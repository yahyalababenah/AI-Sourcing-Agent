"""
AI-Sourcing Hub — OCR Output Parsing Tests

``app.modules.documents.json_repair`` (LLM/VLM JSON-repair layer) already has
thorough coverage in ``tests/test_documents/test_documents_api.py``. What's
untested is the layer beneath it: ``app.modules.documents.ocr_client._ocr_image_to_text()``,
which takes PaddleOCR's raw box/text output and reconstructs it into ordered
text lines (top-to-bottom, left-to-right within a row) before it ever reaches
the LLM. Per the brief, PaddleOCR itself is never invoked here — these tests
feed pre-built fixture objects shaped like real PaddleOCR output directly to
the parsing logic, with the engine itself mocked out.
"""
import app.modules.documents.ocr_client as ocr_client


class _FakePageResult:
    """Mimics PaddleOCR's modern result object (rec_texts / dt_boxes attrs)."""

    def __init__(self, rec_texts, dt_boxes):
        self.rec_texts = rec_texts
        self.dt_boxes = dt_boxes


def _box(x, y, w=50, h=20):
    """A simple axis-aligned quadrilateral box: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]."""
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


def _reset_ocr_globals(monkeypatch):
    monkeypatch.setattr(ocr_client, "_ocr_engine", None)
    monkeypatch.setattr(ocr_client, "_ocr_unavailable", False)


class TestOcrImageToTextModernFormat:
    """PaddleOCR's rec_texts/dt_boxes attribute-based result format."""

    def test_single_row_sorted_left_to_right(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        page = _FakePageResult(
            rec_texts=["价格", "型号", "产品名称"],
            dt_boxes=[_box(x=300, y=10), _box(x=150, y=10), _box(x=0, y=10)],
        )
        fake_engine = _stub_engine([page])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)

        text = ocr_client._ocr_image_to_text("fake.jpg")
        assert text == "产品名称  型号  价格"

    def test_multiple_rows_sorted_top_to_bottom(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        page = _FakePageResult(
            rec_texts=["Row2Col1", "Row1Col1", "Row1Col2"],
            dt_boxes=[_box(x=0, y=100), _box(x=0, y=0), _box(x=60, y=0)],
        )
        fake_engine = _stub_engine([page])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)

        text = ocr_client._ocr_image_to_text("fake.jpg")
        lines = text.split("\n")
        assert lines == ["Row1Col1  Row1Col2", "Row2Col1"]

    def test_boxes_within_y_threshold_grouped_into_one_row(self, monkeypatch):
        """Boxes within Y_THRESHOLD=15px of each other belong to the same row
        even if their y-coordinates aren't identical (real OCR boxes rarely
        align perfectly)."""
        _reset_ocr_globals(monkeypatch)
        page = _FakePageResult(
            rec_texts=["A", "B"],
            dt_boxes=[_box(x=0, y=0), _box(x=60, y=10)],  # 10px apart, under threshold
        )
        fake_engine = _stub_engine([page])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)

        text = ocr_client._ocr_image_to_text("fake.jpg")
        assert text == "A  B"

    def test_boxes_beyond_y_threshold_become_separate_rows(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        page = _FakePageResult(
            rec_texts=["A", "B"],
            dt_boxes=[_box(x=0, y=0), _box(x=0, y=30)],  # 30px apart, over threshold
        )
        fake_engine = _stub_engine([page])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)

        text = ocr_client._ocr_image_to_text("fake.jpg")
        assert text.split("\n") == ["A", "B"]


class TestOcrImageToTextLegacyFormat:
    """Paddle 2.x list-of-(box, (text, score)) tuple fallback format."""

    def test_legacy_tuple_format_parsed(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        # A "page_result" here is itself an iterable of (box, (text, score)) items,
        # and rec_texts/dt_boxes lookups on it must fail to trigger this fallback.
        page = [
            (_box(x=100, y=0), ("Second", 0.99)),
            (_box(x=0, y=0), ("First", 0.98)),
        ]
        fake_engine = _stub_engine([page])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)

        text = ocr_client._ocr_image_to_text("fake.jpg")
        assert text == "First  Second"


class TestOcrImageToTextEdgeCases:
    def test_no_engine_available_returns_empty_string(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: None)
        assert ocr_client._ocr_image_to_text("fake.jpg") == ""

    def test_empty_results_returns_empty_string(self, monkeypatch):
        _reset_ocr_globals(monkeypatch)
        fake_engine = _stub_engine([])
        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: fake_engine)
        assert ocr_client._ocr_image_to_text("fake.jpg") == ""

    def test_predict_failure_returns_empty_and_marks_unavailable(self, monkeypatch):
        """PaddleOCR runtime errors must degrade gracefully (empty string) and
        permanently disable further OCR attempts (module docstring: 'skipped
        gracefully if runtime broken'), not crash the extraction pipeline."""
        _reset_ocr_globals(monkeypatch)

        class _BrokenEngine:
            def predict(self, *args, **kwargs):
                raise RuntimeError("paddle runtime crashed")

        monkeypatch.setattr(ocr_client, "_get_ocr_engine", lambda: _BrokenEngine())

        text = ocr_client._ocr_image_to_text("fake.jpg")
        assert text == ""
        assert ocr_client._ocr_unavailable is True

    def test_get_ocr_engine_import_failure_marks_permanently_unavailable(self, monkeypatch):
        """If PaddleOCR can't even be imported (missing/broken install),
        _get_ocr_engine() must return None without raising, and remember
        that fact so it doesn't retry the (expensive) import on every call."""
        _reset_ocr_globals(monkeypatch)

        import builtins

        real_import = builtins.__import__

        def _raise_on_paddleocr(name, *args, **kwargs):
            if name == "paddleocr":
                raise ImportError("no module named paddleocr")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", _raise_on_paddleocr)

        engine = ocr_client._get_ocr_engine()
        assert engine is None
        assert ocr_client._ocr_unavailable is True

        # Second call must short-circuit (no repeated ``paddleocr`` import
        # attempt) purely via the ``_ocr_unavailable`` flag.
        assert ocr_client._get_ocr_engine() is None


def _stub_engine(predict_return):
    class _StubEngine:
        def predict(self, *args, **kwargs):
            return predict_return

    return _StubEngine()
