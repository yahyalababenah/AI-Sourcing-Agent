import React, { useState, useMemo, useEffect } from "react";

/* ============================================================
   حاسبة التكلفة الواصلة — AI-Sourcing Hub
   الآن مربوطة بقاعدة رموز جمركية (HS-Code) يديرها المندوب فعلياً
   وتُحفظ بشكل دائم ومشترك بين كل من يفتح هذا الرابط (window.storage).

   ⚠️ القيم الافتراضية إرشادية فقط، وليست من مصدر جمركي رسمي حي —
   يجب على المندوب تحديثها من بوابة الجمارك الأردنية (JCAP) فعلياً.
   ============================================================ */

const COLORS = {
  bg: "#0E1B2B",
  panel: "#132840",
  panelAlt: "#0F2135",
  border: "#22405E",
  gold: "#D4A24C",
  goldDim: "#8A6C34",
  teal: "#2F9E8F",
  tealDim: "#1F6B62",
  paper: "#EDEAE0",
  paperDim: "#9FB0C0",
  danger: "#C1440E",
};

const STORAGE_KEY = "hs_code_database_v1";

const DEFAULT_HS_DB = [
  { code: "94051010", label: "ثريات وتركيبات إنارة سقفية/جدارية LED", duty: 20 },
  { code: "94051090", label: "تركيبات إنارة سقفية/جدارية أخرى", duty: 20 },
  { code: "94052010", label: "كشافات مكتبية/طاولة LED", duty: 20 },
  { code: "94054010", label: "كشافات إنارة صناعية عامة LED", duty: 20 },
  { code: "94054090", label: "كشافات إنارة صناعية أخرى", duty: 20 },
  { code: "94061000", label: "مباني جاهزة (أكشاك إنارة/عرض)", duty: 10 },
  { code: "85044090", label: "محولات ومغذيات كهربائية (Drivers)", duty: 15 },
  { code: "85391000", label: "مصابيح Sealed Beam", duty: 20 },
];

function fmt(n, digits = 2) {
  if (!isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function LedgerRow({ label, value, currency = "JOD", strong = false, dim = false, hint }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="whitespace-nowrap text-[13px]" style={{ color: dim ? COLORS.paperDim : COLORS.paper, opacity: dim ? 0.75 : 1 }}>
        {label}
        {hint && <span className="block text-[10px]" style={{ color: COLORS.paperDim, opacity: 0.6 }}>{hint}</span>}
      </span>
      <span className="flex-1 border-b" style={{ borderBottomStyle: "dotted", borderColor: COLORS.border, marginBottom: 4 }} />
      <span dir="ltr" className="whitespace-nowrap font-mono" style={{ color: strong ? COLORS.gold : COLORS.paper, fontWeight: strong ? 700 : 500, fontSize: strong ? 16 : 13 }}>
        {fmt(value)} {currency !== "" && <span style={{ fontSize: 11, opacity: 0.7 }}>{currency}</span>}
      </span>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] mb-1" style={{ color: COLORS.paperDim }}>{label}</span>
      {children}
      {hint && <span className="block text-[10px] mt-1" style={{ color: COLORS.paperDim, opacity: 0.6 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: "8px 10px",
  color: COLORS.paper,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 14,
  outline: "none",
};

const btnStyle = {
  background: COLORS.tealDim,
  color: COLORS.paper,
  border: `1px solid ${COLORS.teal}`,
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};

export default function LandedCostCalculator() {
  const [tab, setTab] = useState("calc"); // "calc" | "admin"

  // ---- قاعدة رموز HS-Code (مشتركة ودائمة) ----
  const [hsDb, setHsDb] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) {
          setHsDb(JSON.parse(res.value));
        } else {
          setHsDb(DEFAULT_HS_DB);
        }
      } catch (e) {
        setHsDb(DEFAULT_HS_DB);
      } finally {
        setDbLoading(false);
      }
    })();
  }, []);

  async function persistDb(nextDb) {
    setHsDb(nextDb);
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(nextDb), true);
      setDbStatus(result ? "✓ تم الحفظ لكل من يفتح هذا الرابط" : "⚠️ فشل الحفظ، حاول مجدداً");
    } catch (e) {
      setDbStatus("⚠️ فشل الحفظ، تحقق من الاتصال");
    }
    setTimeout(() => setDbStatus(""), 3000);
  }

  // ---- نموذج إضافة رمز جديد ----
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDuty, setNewDuty] = useState(20);

  function addCode() {
    const code = newCode.trim();
    if (!code || !newLabel.trim()) return;
    const next = [...hsDb.filter((e) => e.code !== code), { code, label: newLabel.trim(), duty: Number(newDuty) || 0 }].sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    persistDb(next);
    setNewCode("");
    setNewLabel("");
    setNewDuty(20);
  }

  function removeCode(code) {
    persistDb(hsDb.filter((e) => e.code !== code));
  }

  // ---- بيانات المنتج والشحنة ----
  const [unitPriceCNY, setUnitPriceCNY] = useState(35);
  const [qty, setQty] = useState(500);
  const [totalCBM, setTotalCBM] = useState(5);
  const [hsCodeInput, setHsCodeInput] = useState("94054090");
  const [manualDuty, setManualDuty] = useState(20);
  const [cnyToJod, setCnyToJod] = useState(0.1047);
  const [lowValueMode, setLowValueMode] = useState(false);

  // ---- الشحن والتخليص ----
  const [freightRateUSD, setFreightRateUSD] = useState(45);
  const [minFreightUSD, setMinFreightUSD] = useState(60);
  const [insuranceRate, setInsuranceRate] = useState(1);
  const [clearanceFeeUSD, setClearanceFeeUSD] = useState(200);
  const [inlandFeeJOD, setInlandFeeJOD] = useState(50);
  const [usdToJod] = useState(0.709);
  const [platformFeeRate, setPlatformFeeRate] = useState(3);

  const matchedHs = hsDb.find((e) => e.code === hsCodeInput.trim());
  const dutyRate = matchedHs ? matchedHs.duty : manualDuty;

  const calc = useMemo(() => {
    const productValueJOD = unitPriceCNY * qty * cnyToJod;
    const freightUSD = Math.max(totalCBM * freightRateUSD, minFreightUSD);
    const freightJOD = freightUSD * usdToJod;
    const insuranceJOD = (productValueJOD + freightJOD) * (insuranceRate / 100);
    const cif = productValueJOD + freightJOD + insuranceJOD;

    let dutyJOD, gstJOD, isLowValue;
    isLowValue = lowValueMode && productValueJOD <= 200;
    if (isLowValue) {
      dutyJOD = cif * 0.1;
      gstJOD = 0;
    } else {
      dutyJOD = cif * (dutyRate / 100);
      gstJOD = (cif + dutyJOD) * 0.16;
    }

    const clearanceJOD = clearanceFeeUSD * usdToJod;
    const totalLandedCost = cif + dutyJOD + gstJOD + clearanceJOD + inlandFeeJOD;
    const platformFeeJOD = cif * (platformFeeRate / 100);
    const totalWithPlatformFee = totalLandedCost + platformFeeJOD;

    return {
      productValueJOD, freightUSD, freightJOD, insuranceJOD, cif, dutyJOD, gstJOD,
      clearanceJOD, inlandFeeJOD, totalLandedCost, platformFeeJOD, totalWithPlatformFee,
      perUnit: totalLandedCost / Math.max(qty, 1),
      perUnitWithFee: totalWithPlatformFee / Math.max(qty, 1),
      isLowValue,
    };
  }, [unitPriceCNY, qty, totalCBM, cnyToJod, freightRateUSD, minFreightUSD, insuranceRate, dutyRate, clearanceFeeUSD, inlandFeeJOD, usdToJod, lowValueMode, platformFeeRate]);

  const [showFormula, setShowFormula] = useState(false);

  return (
    <div dir="rtl" style={{ background: COLORS.bg, minHeight: "100%", color: COLORS.paper }} className="p-4 sm:p-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        * { font-family: 'IBM Plex Sans Arabic', sans-serif; box-sizing: border-box; }
        h1, h2, .display { font-family: 'Cairo', sans-serif; }
        input:focus, select:focus { border-color: ${COLORS.gold} !important; }
        @keyframes stampIn {
          0% { opacity: 0; transform: scale(2.4) rotate(-14deg); }
          55% { opacity: 1; transform: scale(0.92) rotate(-8deg); }
          75% { transform: scale(1.05) rotate(-10deg); }
          100% { opacity: 1; transform: scale(1) rotate(-9deg); }
        }
        .stamp { animation: stampIn 0.5s ease-out; }
        @media (prefers-reduced-motion: reduce) { .stamp { animation: none; } }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] tracking-wide mb-1" style={{ color: COLORS.teal }}>
              AI-SOURCING HUB · محرك التكلفة الواصلة
            </div>
            <h1 className="display text-2xl sm:text-3xl font-extrabold">حاسبة التكلفة الواصلة الكاملة</h1>
            <p className="text-[13px] mt-1" style={{ color: COLORS.paperDim, maxWidth: 540 }}>
              المندوب يُدخل رمز HS-Code مرة واحدة في قاعدة البيانات، وبعدها النسبة تُجلب تلقائياً لكل عملية حساب لاحقة.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab("calc")} style={{ ...btnStyle, background: tab === "calc" ? COLORS.gold : COLORS.panel, color: tab === "calc" ? COLORS.bg : COLORS.paperDim, borderColor: tab === "calc" ? COLORS.gold : COLORS.border, fontWeight: tab === "calc" ? 700 : 400 }}>
              الحاسبة
            </button>
            <button onClick={() => setTab("admin")} style={{ ...btnStyle, background: tab === "admin" ? COLORS.gold : COLORS.panel, color: tab === "admin" ? COLORS.bg : COLORS.paperDim, borderColor: tab === "admin" ? COLORS.gold : COLORS.border, fontWeight: tab === "admin" ? 700 : 400 }}>
              إدارة رموز HS-Code (للمندوب)
            </button>
          </div>
        </div>

        {dbLoading && (
          <div className="text-[12px] mb-4" style={{ color: COLORS.paperDim }}>
            جارِ تحميل قاعدة الرموز الجمركية...
          </div>
        )}

        {!dbLoading && tab === "admin" && (
          <div className="rounded-xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h2 className="display text-[15px] font-bold">قاعدة رموز HS-Code والجمارك</h2>
              {dbStatus && <span className="text-[11px]" style={{ color: COLORS.teal }}>{dbStatus}</span>}
            </div>
            <p className="text-[11px] mb-4" style={{ color: COLORS.paperDim, opacity: 0.7 }}>
              ⚠️ هذه القاعدة مشتركة ومرئية لكل من يفتح هذا الرابط (وليست خاصة بجهازك فقط). تحقق من كل نسبة عبر بوابة الجمارك
              الأردنية (JCAP) قبل حفظها.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_100px_auto] gap-2 mb-4 items-end">
              <Field label="رمز HS-Code">
                <input style={inputStyle} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="94054090" />
              </Field>
              <Field label="وصف المنتج">
                <input style={inputStyle} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="كشافات إنارة صناعية LED" />
              </Field>
              <Field label="الجمرك %">
                <input type="number" style={inputStyle} value={newDuty} onChange={(e) => setNewDuty(e.target.value)} />
              </Field>
              <button onClick={addCode} style={{ ...btnStyle, height: 38, background: COLORS.gold, color: COLORS.bg, border: "none", fontWeight: 700 }}>
                + إضافة / تحديث
              </button>
            </div>

            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
              <div className="grid grid-cols-[120px_1fr_80px_40px] gap-2 px-3 py-2 text-[11px]" style={{ background: COLORS.panelAlt, color: COLORS.paperDim }}>
                <span>الرمز</span><span>الوصف</span><span>الجمرك</span><span></span>
              </div>
              {hsDb.length === 0 && (
                <div className="px-3 py-4 text-[12px]" style={{ color: COLORS.paperDim }}>لا توجد رموز بعد — أضف أول رمز أعلاه.</div>
              )}
              {hsDb.map((e) => (
                <div key={e.code} className="grid grid-cols-[120px_1fr_80px_40px] gap-2 px-3 py-2 text-[12px] items-center" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <span dir="ltr" className="font-mono">{e.code}</span>
                  <span style={{ color: COLORS.paperDim }}>{e.label}</span>
                  <span dir="ltr" className="font-mono" style={{ color: COLORS.gold }}>{e.duty}%</span>
                  <button onClick={() => removeCode(e.code)} style={{ color: COLORS.danger, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!dbLoading && tab === "calc" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* ===== Form column ===== */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="rounded-xl p-4 sm:p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: COLORS.tealDim, color: COLORS.paper }}>١</span>
                  <h2 className="display text-[15px] font-bold">بيانات المنتج والشحنة</h2>
                </div>

                <div className="grid grid-cols-2 gap-x-4">
                  <Field label="سعر الوحدة (يوان صيني CNY)">
                    <input type="number" style={inputStyle} value={unitPriceCNY} onChange={(e) => setUnitPriceCNY(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="الكمية (عدد القطع)">
                    <input type="number" style={inputStyle} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="الحجم الكلي للشحنة (CBM)" hint="طول × عرض × ارتفاع بالمتر × عدد الكراتين">
                    <input type="number" style={inputStyle} value={totalCBM} onChange={(e) => setTotalCBM(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="سعر صرف: 1 يوان = ؟ دينار">
                    <input type="number" step="0.0001" style={inputStyle} value={cnyToJod} onChange={(e) => setCnyToJod(Number(e.target.value) || 0)} />
                  </Field>
                </div>

                <Field label="رمز HS-Code" hint={matchedHs ? `✓ موجود في القاعدة: ${matchedHs.label} — ${matchedHs.duty}%` : "⚠️ غير موجود بالقاعدة — أدخل النسبة يدوياً بالأسفل، أو أضف الرمز من تبويب الإدارة"}>
                  <input
                    list="hsSuggestions"
                    style={{ ...inputStyle, borderColor: matchedHs ? COLORS.teal : COLORS.border }}
                    value={hsCodeInput}
                    onChange={(e) => setHsCodeInput(e.target.value)}
                    dir="ltr"
                    placeholder="94054090"
                  />
                  <datalist id="hsSuggestions">
                    {hsDb.map((e) => (
                      <option key={e.code} value={e.code}>{e.label} — {e.duty}%</option>
                    ))}
                  </datalist>
                </Field>

                {!matchedHs && (
                  <Field label="نسبة الجمرك اليدوية (%) — بما أن الرمز غير موجود بالقاعدة">
                    <input type="number" style={inputStyle} value={manualDuty} onChange={(e) => setManualDuty(Number(e.target.value) || 0)} />
                  </Field>
                )}

                <label className="flex items-center gap-2 mt-2 text-[12px]" style={{ color: COLORS.paperDim }}>
                  <input type="checkbox" checked={lowValueMode} onChange={(e) => setLowValueMode(e.target.checked)} style={{ accentColor: COLORS.gold }} />
                  شحنة صغيرة القيمة (طرد شخصي ≤ 200 دينار) → رسم ثابت 10% بدل الجمارك والضريبة
                </label>
              </div>

              <div className="rounded-xl p-4 sm:p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: COLORS.tealDim, color: COLORS.paper }}>٢</span>
                  <h2 className="display text-[15px] font-bold">الشحن والتخليص الجمركي</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <Field label="سعر الشحن LCL ($/CBM)" hint="الصين → ميناء العقبة، عادة 30–90$">
                    <input type="number" style={inputStyle} value={freightRateUSD} onChange={(e) => setFreightRateUSD(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="الحد الأدنى لأجرة الشحن ($)">
                    <input type="number" style={inputStyle} value={minFreightUSD} onChange={(e) => setMinFreightUSD(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="نسبة التأمين (%)" hint="من قيمة البضاعة + الشحن">
                    <input type="number" step="0.1" style={inputStyle} value={insuranceRate} onChange={(e) => setInsuranceRate(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="أتعاب التخليص ورسوم الميناء ($)">
                    <input type="number" style={inputStyle} value={clearanceFeeUSD} onChange={(e) => setClearanceFeeUSD(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="النقل الداخلي (العقبة → مدينتك، JOD)">
                    <input type="number" style={inputStyle} value={inlandFeeJOD} onChange={(e) => setInlandFeeJOD(Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="عمولة منصتك على الصفقة (%)" hint="اختياري — من نموذج العمل">
                    <input type="number" step="0.5" style={inputStyle} value={platformFeeRate} onChange={(e) => setPlatformFeeRate(Number(e.target.value) || 0)} />
                  </Field>
                </div>
                <p className="text-[10px] mt-1" style={{ color: COLORS.paperDim, opacity: 0.6 }}>
                  سعر صرف الدولار الثابت المستخدم داخلياً: 1 USD = {usdToJod} JOD (ربط تاريخي للدينار الأردني).
                </p>
              </div>

              <button onClick={() => setShowFormula((s) => !s)} className="text-[12px] self-start px-3 py-2 rounded-md" style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.teal }}>
                {showFormula ? "إخفاء طريقة الحساب ▲" : "كيف تم حساب هذا الرقم؟ ▼"}
              </button>

              {showFormula && (
                <div className="rounded-xl p-4 text-[12px] leading-6" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, color: COLORS.paperDim }}>
                  <ol className="list-decimal pr-5 space-y-1">
                    <li>قيمة البضاعة (JOD) = سعر الوحدة (يوان) × الكمية × سعر الصرف</li>
                    <li>أجرة الشحن (JOD) = الأكبر بين (CBM × سعر الـCBM) أو الحد الأدنى، محوّلة من دولار</li>
                    <li>التأمين = (قيمة البضاعة + الشحن) × نسبة التأمين</li>
                    <li><b style={{ color: COLORS.gold }}>CIF</b> = قيمة البضاعة + الشحن + التأمين — أساس التقييم الجمركي في الأردن</li>
                    <li>الرسوم الجمركية = CIF × نسبة الجمرك المرتبطة برمز HS-Code</li>
                    <li>ضريبة المبيعات العامة (16%) = (CIF + الرسوم الجمركية) × 16%</li>
                    <li>التكلفة الواصلة الكلية = CIF + الرسوم الجمركية + الضريبة + أتعاب التخليص + النقل الداخلي</li>
                  </ol>
                </div>
              )}
            </div>

            {/* ===== Result column ===== */}
            <div className="lg:col-span-2">
              <div className="rounded-xl p-5 sticky top-4" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}` }}>
                <div className="text-[11px] mb-3 tracking-wide" style={{ color: COLORS.teal }}>كشف التكلفة الواصلة — CIF Landed Cost</div>

                <LedgerRow label="قيمة البضاعة" value={calc.productValueJOD} />
                <LedgerRow label="أجرة الشحن البحري" value={calc.freightJOD} hint={`≈ ${fmt(calc.freightUSD)} USD`} />
                <LedgerRow label="التأمين" value={calc.insuranceJOD} />
                <LedgerRow label="القيمة الجمركية (CIF)" value={calc.cif} strong />

                <div className="my-2" style={{ borderTop: `1px dashed ${COLORS.border}` }} />

                {calc.isLowValue ? (
                  <LedgerRow label="رسم الشحنات الصغيرة (10% ثابتة)" value={calc.dutyJOD} />
                ) : (
                  <>
                    <LedgerRow label={`الرسوم الجمركية (${fmt(dutyRate, 0)}%)`} value={calc.dutyJOD} hint={matchedHs ? `HS: ${matchedHs.code}` : "نسبة يدوية"} />
                    <LedgerRow label="ضريبة المبيعات العامة (16%)" value={calc.gstJOD} />
                  </>
                )}
                <LedgerRow label="أتعاب التخليص ورسوم الميناء" value={calc.clearanceJOD} />
                <LedgerRow label="النقل الداخلي" value={calc.inlandFeeJOD} />

                <div className="my-3" style={{ borderTop: `1px solid ${COLORS.border}` }} />

                <div key={Math.round(calc.totalLandedCost)} className="stamp flex items-center justify-between">
                  <div>
                    <div className="text-[12px]" style={{ color: COLORS.paperDim }}>إجمالي التكلفة الواصلة</div>
                    <div dir="ltr" className="font-mono text-2xl font-bold" style={{ color: COLORS.gold }}>
                      {fmt(calc.totalLandedCost)} <span className="text-sm">JOD</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-center border-2 shrink-0" style={{ borderColor: COLORS.gold, color: COLORS.gold, transform: "rotate(-9deg)" }}>
                    <span className="text-[9px] font-extrabold leading-tight">معتمد<br />CIF</span>
                  </div>
                </div>

                <div className="mt-3 text-[12px]" style={{ color: COLORS.paperDim }}>
                  تكلفة القطعة الواحدة الواصلة:{" "}
                  <span dir="ltr" className="font-mono" style={{ color: COLORS.paper }}>{fmt(calc.perUnit)} JOD</span>
                </div>

                {platformFeeRate > 0 && (
                  <div className="mt-4 rounded-lg p-3" style={{ background: COLORS.panel, border: `1px dashed ${COLORS.tealDim}` }}>
                    <div className="text-[11px] mb-2" style={{ color: COLORS.teal }}>مع عمولة المنصة ({fmt(platformFeeRate, 1)}%)</div>
                    <LedgerRow label="عمولة المنصة" value={calc.platformFeeJOD} dim />
                    <LedgerRow label="التكلفة النهائية للمستورد" value={calc.totalWithPlatformFee} strong />
                    <LedgerRow label="لكل قطعة" value={calc.perUnitWithFee} dim />
                  </div>
                )}

                <p className="text-[10px] mt-4 leading-5" style={{ color: COLORS.paperDim, opacity: 0.6 }}>
                  هذه الحاسبة نموذج أولي (Demo) لأغراض العرض. قاعدة رموز HS-Code مشتركة بين كل من يفتح هذا الرابط —
                  تحقق دائماً من النسب عبر الجمارك الأردنية (JCAP) قبل أي قرار مالي حقيقي.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
