import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { documentService } from "@/services/documentService";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";

// ── Demo extracted fields ─────────────────────────────────────────────────────
const DEMO_FIELDS = [
  { key: "اسم المنتج",     value: "جهاز إلكتروني - موديل 2025",   conf: 98, low: false },
  { key: "الشركة المصنّعة", value: "Shenzhen Manufacturing Co., Ltd.", conf: 99, low: false },
  { key: "نطاق السعر",     value: "$8.50 – $15.00",               conf: 94, low: false },
  { key: "MOQ",             value: "500 pcs",                      conf: 96, low: false },
  { key: "الشهادات",       value: "CE · ISO 9001",                 conf: 95, low: false },
  { key: "وقت التسليم",    value: "20–30 days",                    conf: 91, low: false },
  { key: "كود النموذج",    value: "MD-2025-001",                   conf: 87, low: true  },
];

export function DocumentUploadPage() {
  const navigate      = useNavigate();
  const [rfqId,       setRfqId]       = useState("");
  const [file,        setFile]        = useState<File | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["rfqs-for-upload"],
    queryFn:  () => intakeService.list({ limit: 50 }),
  });

  const rfqs = rfqsData?.items ?? [];

  const uploadMutation = useMutation({
    mutationFn: ({ rfqId, file }: { rfqId: string; file: File }) =>
      documentService.upload(rfqId, file),
    onSuccess: (doc) => navigate(ROUTES.DOCUMENTS.DETAIL(doc.id)),
    onError:   (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!rfqId) return setError("يرجى اختيار طلب عرض السعر");
    if (!file)  return setError("يرجى اختيار ملف للرفع");
    uploadMutation.mutate({ rfqId, file });
  };

  const panelStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as React.CSSProperties;

  return (
    <div className="space-y-4" dir="rtl" style={{ color: "var(--text-1)" }}>
      {/* ── Page Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 rounded-lg"
        style={panelStyle}
      >
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ color: "var(--text-1)" }}>
            <path d="M14 6l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <h1 className="text-[18px] font-bold" style={{ color: "var(--text-1)" }}>استيراد الكتالوج</h1>
            <p className="text-[11px]" style={{ color: "var(--text-2)" }}>
              رفع PDF / Excel واستخراج البيانات بالذكاء الاصطناعي
            </p>
          </div>
        </div>
        {(showPreview || file) && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-md"
            style={{ background: "var(--accent-surface)", border: "1px solid var(--accent-border)" }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: "#10b981", animation: "dotPulse 1.5s ease infinite" }} />
            <span className="text-[12px] font-bold" style={{ color: "#10b981" }}>تم استخراج 8 حقول · دقة 96.4%</span>
          </div>
        )}
      </div>

      {/* ── Main split: upload left / fields right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upload Panel */}
        <div className="rounded-lg p-5 space-y-5" style={panelStyle}>
          <h3 className="text-[14px] font-bold" style={{ color: "var(--text-1)" }}>رفع كتالوج المورّد</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* RFQ picker */}
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-4)" }}>
                ربط بطلب عرض سعر
              </label>
              {rfqsLoading ? (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  جاري التحميل...
                </div>
              ) : rfqs.length === 0 ? (
                <div
                  className="text-[12px] px-3 py-2 rounded-lg"
                  style={{ background: "var(--amber-surface)", border: "1px solid var(--amber-border)", color: "#d97706" }}
                >
                  لا توجد طلبات —{" "}
                  <Link to={ROUTES.RFQ.CREATE} className="underline" style={{ color: "#d97706" }}>
                    أنشئ طلباً أولاً
                  </Link>
                </div>
              ) : (
                <select
                  value={rfqId}
                  onChange={(e) => setRfqId(e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] rounded-lg outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
                >
                  <option value="">-- اختر طلباً --</option>
                  {rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.client_name} — {(r.client_request_arabic || "").slice(0, 40)}...
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* File dropzone */}
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-4)" }}>
                الملف (PDF · Excel · Word · CSV · نص · صورة)
              </label>
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-xl py-10 cursor-pointer transition-all"
                style={{ border: "2px dashed var(--border)", background: "var(--surface-2)" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) { setFile(f); setShowPreview(true); }
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.4">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                {file ? (
                  <div className="text-center">
                    <div className="text-[13px] font-bold" style={{ color: "#10b981" }}>{file.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-2)" }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ) : (
                  <>
                    <div className="text-[13px] font-medium" style={{ color: "var(--text-4)" }}>اسحب الملف هنا أو</div>
                    <div
                      className="px-4 py-2 text-[12px] font-bold rounded-lg"
                      style={{ background: "var(--accent-surface)", border: "1px solid var(--accent-border)", color: "#10b981" }}
                    >
                      اختر من جهازك
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-3)" }}>PDF · XLSX · XLS · CSV · DOCX · TXT · JPG · PNG</div>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.csv,.tsv,.docx,.txt"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    if (f) setShowPreview(true);
                  }}
                />
              </label>
            </div>

            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: "var(--error-surface)", border: "1px solid var(--error-border)", color: "#dc2626" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={uploadMutation.isPending || !file || !rfqId}
              className="w-full py-3 text-[14px] font-bold text-white rounded-lg transition-all hover:brightness-110 disabled:opacity-40"
              style={{ background: "#059669" }}
            >
              {uploadMutation.isPending ? "جاري الرفع والمعالجة..." : "رفع الملف واستخراج البيانات"}
            </button>
          </form>
        </div>

        {/* Extracted Fields Panel */}
        <div className="rounded-lg p-5 space-y-4" style={panelStyle}>
          <div>
            <div className="text-[14px] font-bold mb-0.5" style={{ color: "var(--text-1)" }}>الحقول المستخرجة</div>
            <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
              {showPreview || file
                ? "راجع وعدّل الحقول ثم استورد إلى قاعدة الموردين"
                : "ارفع ملفاً لرؤية الحقول المستخرجة هنا"}
            </div>
          </div>

          {(showPreview || file) ? (
            <div className="space-y-3">
              {DEMO_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="rounded-lg px-3.5 py-3"
                  style={{
                    background: "var(--surface-2)",
                    border: f.low ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-semibold" style={{ color: "var(--text-4)" }}>{f.key}</span>
                    <div
                      className="text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                      style={
                        f.low
                          ? { background: "var(--amber-surface)", border: "1px solid var(--amber-border)", color: "#d97706" }
                          : { background: "var(--accent-surface)", color: "#10b981" }
                      }
                    >
                      {f.conf}%{f.low && " ⚠"}
                    </div>
                  </div>
                  <div
                    className="px-3 py-2 rounded-md text-[12px] font-semibold font-mono"
                    style={{
                      background: f.low ? "var(--amber-surface-2)" : "var(--surface-3)",
                      border: f.low ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                      color: f.low ? "#d97706" : "var(--text-1)",
                    }}
                    dir="ltr"
                  >
                    {f.value}
                  </div>
                  {f.low && (
                    <div className="text-[9.5px] mt-1.5" style={{ color: "#d97706" }}>تحقق من المستند الأصلي</div>
                  )}
                </div>
              ))}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
                  className="flex-[2] py-3.5 text-[14px] font-bold text-white rounded-lg transition-all hover:brightness-110"
                  style={{ background: "#059669" }}
                >
                  استيراد إلى قاعدة الموردين
                </button>
                <button
                  onClick={() => { setFile(null); setShowPreview(false); }}
                  className="flex-1 py-3.5 text-[13px] font-semibold rounded-lg transition-all"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-4)" }}
                >
                  رفع ملف آخر
                </button>
              </div>
            </div>
          ) : (
            /* PDF preview skeleton */
            <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="text-[10px] font-mono mb-2" style={{ color: "var(--text-3)" }}>
                معاينة الملف · Supplier_Catalog_2025.pdf
              </div>
              {[98, 70, 50, 80, 60].map((w, i) => (
                <div key={i} className="rounded" style={{ background: "var(--surface-3)", height: "12px", width: `${w}%` }} />
              ))}
              <div className="text-[9px] text-center pt-2" style={{ color: "var(--text-3)" }}>
                ارفع ملفاً لرؤية المعاينة
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
