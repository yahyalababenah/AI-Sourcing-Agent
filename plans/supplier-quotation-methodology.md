# 🏗️ دليل إنشاء وإرسال عرض السعر (Supplier Quotation Methodology)

<div dir="rtl">

---

## 📋 فهرس المحتويات

1. [البداية: كيف يرى المورّد طلبات عروض الأسعار (RFQs)](#1-البداية-كيف-يرى-المورّد-طلبات-عروض-الأسعار-rfqs)
2. [حساب التكلفة: محرك التسعير ثلاثي المراحل (3-Phase Pricing Engine)](#2-حساب-التكلفة-محرك-التسعير-ثلاثي-المراحل-3-phase-pricing-engine)
3. [إنشاء عرض السعر (Quotation Creation)](#3-إنشاء-عرض-السعر-quotation-creation)
4. [إرسال عرض السعر (Sending the Quotation)](#4-إرسال-عرض-السعر-sending-the-quotation)
5. [دورة الحياة الكاملة (Full Lifecycle)](#5-دورة-الحياة-الكاملة-full-lifecycle)
6. [تأثير الـ JCAP Refactor على العملية](#6-تأثير-الـ-jcap-refactor-على-العملية)
7. [ملحق: خريطة API الكاملة](#7-ملحق-خريطة-api-الكاملة)

---

## 1. البداية: كيف يرى المورّد طلبات عروض الأسعار (RFQs)

### 1.1 قنوات رؤية الـ RFQ

عندما يقوم عميل (Client) بإنشاء طلب عرض سعر جديد عبر نقطة النهاية [`POST /api/v1/rfqs`](app/modules/intake/router.py:103)، يمر الـ RFQ بالمراحل التالية:

1. **إنشاء الـ RFQ** — يتم تسجيله في جدول [`rfqs`](app/modules/intake/models.py:42) مع حالة `OPEN` وبيانات الاستخراج والترجمة.
2. **التشغيل الآلي للمطابقة** — يتم استدعاء [`run_matching()`](app/modules/intake/service.py:438) والذي يشغّل [`match_rfq_to_suppliers()`](app/modules/intake/service.py:466) لمطابقة الـ RFQ مع المورّدين المناسبين بناءً على فئة المنتج، الوجهة، والشرائح الأخرى.
3. **نافذة الحصرية (Exclusive Window)** — يتم إنشاء سجلات [`RFQMatch`](app/modules/intake/models.py:112) مع [`MatchStatus.PENDING`](app/modules/intake/models.py:36) للمورّدين المتطابقين، مع مهلة استجابة مدتها **3 ساعات** (حقل `exclusive_deadline` + `is_public=False`).
4. **بعد انتهاء المهلة** — يتحوّل الـ RFQ إلى [`is_public=True`](app/modules/intake/models.py:75) وينتقل إلى **المجمع العام (public pool)** حيث يصبح مرئيًا لجميع المورّدين.

### 1.2 صندوق وارد المورّد (Supplier Inbox)

يرى المورّد طلبات عروض الأسعار عبر مسارين منفصلين:

#### أ. المطابقات الحصرية — [`GET /api/v1/rfqs/matched`](app/modules/intake/router.py:208)

```python
# app/modules/intake/router.py:213
async def list_matched_rfqs_endpoint(
    # ...
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
```

- يُرجع فقط طلبات الـ RFQ المطابقة للمورّد الحالي (Agent).
- يتضمّن [`MatchStatus`](app/modules/intake/models.py:34) (Pending / Responded / Expired / Declined).
- يُظهر مهلة الاستجابة المتبقية (3 ساعات من `response_deadline`).
- مسار الواجهة الأمامية: [`/rfq/supplier-inbox`](frontend/src/router/routeFactories.tsx:162).

#### ب. المجمع العام — [`GET /api/v1/rfqs/public`](app/modules/intake/router.py:236)

```python
# app/modules/intake/service.py:528
async def list_public_rfqs(
    db: AsyncSession,
    pagination: PaginationParams,
    status: Optional[RFQStatus] = None,
) -> RFQListResponse:
```

- يُرجع جميع الـ RFQs ذات `is_public=True` والحالة `OPEN`.
- مرئية لجميع المورّدين (Agent) دون الحاجة لمطابقة مسبقة.
- يمكن لأي مورّد الدخول على الـ RFQ مباشرة واستخدام زر "بناء عرض سعر".

### 1.3 الرد على المطابقة الحصرية

عندما يريد المورّد الرد على مطابقة حصرية، يستخدم نقطة النهاية [`POST /api/v1/matches/{match_id}/claim`](app/modules/intake/router.py:482):

```python
# app/modules/intake/service.py:577
async def claim_match(
    db: AsyncSession,
    match_id: str,
    supplier_id: str,
    action: str,
) -> RFQMatch:
```

التحقّقات التي تتم:
1. **التحقّق من الملكية** — هل هذا المورّد هو صاحب المطابقة؟
2. **التحقّق من الحالة** — هل المطابقة لا تزال `PENDING`؟
3. **التحقّق من المهلة** — هل انتهت الـ 3 ساعات؟
   - إذا انتهت المهلة ← يتم تعيين `EXPIRED` تلقائيًا.
4. إذا كان `action="respond"` ← `RESPONDED`.
   إذا كان `action="decline"` ← `DECLINED`.

### 1.4 الانتقال إلى بناء عرض السعر

بعد أن يجد المورّد RFQ مناسب (عبر المطابقة أو المجمع العام)، ينتقل إلى واجهة حاسبة التسعير عبر المسار [`/pricing/calculate?rfq_id={id}`](frontend/src/router/routeFactories.tsx:199):

```typescript
// frontend/src/router/routeFactories.tsx:200
{
  path: ROUTES.PRICING.CALCULATE,
  element: (
    <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
      <PricingCalcPage />
    </RoleGuard>
  ),
},
```

---

## 2. حساب التكلفة: محرك التسعير ثلاثي المراحل (3-Phase Pricing Engine)

### 2.1 نظرة عامة على الـ Pipeline

محرك التسعير [`PricingEngine`](app/modules/pricing/engine.py:145) هو قلب عملية حساب التكلفة. يطبّق خوارزمية **JCAP/ASYCUDA** المكوّنة من 3 مراحل:

```
المرحلة 1: Port Arrival (CIF)
    ↓
المرحلة 2: JCAP Customs & Tax
    ↓
المرحلة 3: Commercial Pricing (هامش الربح + الخصومات + العمولات)
```

### 2.2 قواعد التسعير (Pricing Rules)

يبدأ المحرك بقيم افتراضية ثابتة في [`PricingEngine.DEFAULTS`](app/modules/pricing/engine.py:148)، ثم يُدمج معها القواعد المحمّلة من قاعدة البيانات عبر [`_load_rules_for_engine()`](app/modules/pricing/service.py:392):

```python
# app/modules/pricing/engine.py:148
DEFAULTS = {
    "exchange_rate_cny_jod": 0.1047,
    "exchange_rate_cny_usd": 0.14,
    "sea_freight_aqaba": 75.0,       # $75 / CBM
    "sea_freight_jeddah": 60.0,
    "sea_freight_default": 80.0,
    "insurance_rate": 0.01,          # 1%
    "customs_duty_rate_general": 0.05,
    "clearance_fee": 150.0,          # 150 JOD
    "commission_rate_standard": 0.03,
    "commission_rate_premium": 0.05,
    "moq_discount_1000_plus": 0.02,
    "moq_discount_5000_plus": 0.05,
    "moq_discount_10000_plus": 0.08,
    "vat_rate": 0.16,
    "target_margin": 0.15,
    "early_payment_discount": 0.02,
}
```

يتم تحميل القواعد من Redis (ذاكرة تخزين مؤقت مع حماية الانهيار `stampede protection`) أو قاعدة البيانات، ثم تقسيمها إلى:
- **قواعد قانونية (Canonical)** — أسماء تطابق مفاتيح `DEFAULTS` ← used as override dict.
- **قواعد مخصصة (Custom)** — يتم تطبيقها عبر [`_apply_custom_rules()`](app/modules/pricing/engine.py:705) بالأنواع: `percentage / fixed / formula`.

### 2.3 المرحلة 1: Port Arrival Cost (CIF)

يتم حساب تكلفة الوصول إلى الميناء لكل منتج عبر [`calculate_landed_cost()`](app/modules/pricing/engine.py:253):

```
الخطوة 1: تحويل RMB → USD → العملة المحلية
    price_usd  = price_rmb × exchange_rate_cny_usd
    price_jod  = price_usd × (cny_jod / cny_usd)

الخطوة 2: حساب الحجم الفعّال (CBM) — إصلاح الخلل رقم 5
    effective_cbm = max(volume_cbm_explicit, weight_kg × quantity / 500)

الخطوة 3: الشحن البحري (Sea Freight)
    total_freight = sea_freight_rate[port] × effective_cbm
    freight_per_unit = total_freight / quantity

الخطوة 4: التأمين (Insurance) — إصلاح الخلل رقم 3
    insurance_per_unit = (price_local + freight_per_unit) × insurance_rate

الخطوة 5: CIF (Cost + Insurance + Freight)
    cif_per_unit = price_local + freight_per_unit + insurance_per_unit
```

**آلية حساب CBM** — تستخدم الدالة [`_compute_effective_volume_cbm()`](app/modules/pricing/engine.py:224):
- إذا وُجد `volume_cbm` صريح: `max(volume_cbm, weight_based_cbm)`.
- إذا لم يوجد: `weight_kg × quantity / 500` (بحد أدنى 0.1 CBM).

**معدلات الشحن حسب الميناء** — تبحث عن قاعدة باسم `sea_freight_{port_name}`. إذا لم توجد، تستخدم القيمة الافتراضية (`sea_freight_default`).

### 2.4 المرحلة 2: JCAP Customs & Tax

تُطبّق رسوم الجمارك والضرائب وفقًا لنظام JCAP/ASYCUDA الأردني:

```
الخطوة 6: الرسوم الجمركية (Duty 001)
    customs_per_unit = cif_per_unit × duty_rate_001 (من HS Code)

الخطوة 7: رسوم الخدمة (Service Fee 070)
    service_percent_per_unit = cif_per_unit × service_percent_070

الخطوة 8: الغرامة (Penalty 018) — شرطية
    penalty_per_unit = (requires_license AND NOT has_license)
                       ? cif_per_unit × penalty_rate_018
                       : 0

الخطوة 9: الرسوم الثابتة (Flat Fee 301) — على مستوى الشحنة
    service_flat_301_line = hs_entry.service_flat_fee_301 (JOD flat)

الخطوة 10: أساس ضريبة القيمة المضافة (VAT Base)
    vat_base_per_unit = CIF + Duty(001) + 070 + 018
    (301 تضاف لاحقًا على مستوى الشحنة)

الخطوة 11: ضريبة القيمة المضافة (VAT 020) — إصلاح الخلل رقم 1
    vat_per_unit = vat_base_per_unit × vat_rate_020
    (تستخدم vat_rate_020 من HS Code إن وُجد، أو vat_rate العام)

الخطوة 12: التكلفة الإجمالية للمرحلة 2
    landed_cost_per_unit = CIF + Duty + 070 + 018 + VAT
```

**مصادر بيانات HS Code** — يتم تحميل جداول رسوم الـ HS Code عبر [`_load_hs_code_schedule()`](app/modules/pricing/service.py:356) من جدول `hs_code_fee_schedules` في قاعدة البيانات.

### 2.5 المرحلة 3: Commercial Pricing

بعد حساب المرحلتين 1 و2 لكل منتج، يقوم [`calculate()`](app/modules/pricing/engine.py:463) بتجميع النتائج وتطبيق التسعير التجاري:

```
الخطوة 13: تجميع المرحلتين 1 و2
    grand_total_phase2  = Σ landed_cost_per_unit × quantity
    service_flat_301_total = max(service_flat_301 عبر جميع المنتجات)
    VAT على 301 = 301 × vat_rate

الخطوة 14: المصاريف المحلية (Clearance)
    clearance_fee_total = 150 JOD (قابلة للتعديل)

الخطوة 15: خصم MOQ (Minimum Order Quantity)
    moq_rate  = 2%  (≥1,000 وحدة)
    moq_rate  = 5%  (≥5,000 وحدة)
    moq_rate  = 8%  (≥10,000 وحدة)
    moq_discount = total_price_jod × moq_rate

الخطوة 16: العمولة (Commission)
    commission_total = (grand_total_phase2 + clearance - moq) × commission_pct

الخطوة 17: القواعد المخصصة (Custom Rules)
    تُطبّق القواعد غير القانونية (percentage/fixed/formula).

الخطوة 18: خصم الدفع المبكر (Early Payment Discount)
    early_discount = grand_total × 2%

الخطوة 19: السعر النهائي
    final_total = grand_total - early_discount + custom_fees
```

**توزيع القيم على المنتجات** — يتم توزيع `clearance_fee` و `moq_discount` و `commission` نسبيًا على كل منتج بناءً على حصته من التكلفة الإجمالية.

### 2.6 معالجة الأخطاء

1. **فشل API الخارجي** — إذا تعذّر الاتصال بالـ Backend، يستخدم [`calculateLocalFallback()`](frontend/src/pages/pricing/localPricingFallback.ts) لحساب تقدير محلي تقريبي.
2. **فشل صيغة القواعد المخصصة** — يتم تخطي القاعدة (contributes 0) بدلاً من إفشال العملية بأكملها.
3. **خطأ في تحميل سعر الصرف** — يُستخدم سعر الصرف من قاعدة البيانات أو القيمة الافتراضية.

### 2.7 دمج مع API التمويل (Financing API)

يمكن دمج نتائج التسعير مع [`POST /api/v1/pricing/estimate`](app/modules/pricing/router.py:270) الذي يُقدّم:

- عرض تمويل مقسّط للعميل بناءً على `grand_total`.
- خطط سداد (3، 6، 12 شهرًا) مع نسب ربح متغيرة.
- تقدير الأهلية التمويلية (eligibility) بناءً على سجل العميل.

---

## 3. إنشاء عرض السعر (Quotation Creation)

### 3.1 من نتائج التسعير إلى عرض السعر

بعد أن يحسب المورّد السعر ويطلع على النتائج في واجهة [`PricingCalcPage`](frontend/src/pages/pricing/PricingCalcPage.tsx)، ينقر زر **"إنشاء عرض سعر"** الذي يشغّل [`createQuoteMutation`](frontend/src/pages/pricing/usePricingCalculator.ts:155):

```typescript
// frontend/src/pages/pricing/usePricingCalculator.ts:155
const createQuoteMutation = useMutation({
  mutationFn: () => {
    return quotationService.create({
      rfq_id: result.rfq_id,
      target_currency: result.target_currency,
      exchange_rate_used: result.exchange_rate_used,
      line_items: result.line_items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price_cny: item.unit_price_cny,
        unit_price_converted: item.unit_price_converted,
        exchange_rate: item.exchange_rate,
        freight_cost: item.freight_cost,
        customs_duty: item.customs_duty,
        commission: item.commission,
        subtotal: item.subtotal,
        discount: item.discount,
        total: item.total,
      })),
      subtotal: result.subtotal_before_vat,
      vat_total: result.vat,
      discount_total: result.discount_total,
      grand_total: result.grand_total,
    });
  },
  onSuccess: (quote) => {
    navigate(ROUTES.QUOTES.DETAIL(quote.id));
  },
});
```

### 3.2 نقطة النهاية الخلفية — [`POST /api/v1/quotes/generate`](app/modules/output/router.py:103)

```python
# app/modules/output/router.py:109
async def generate_async(
    data: QuotationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
```

**الـ Flow داخل الـ Endpoint:**

1. **تحويل البيانات** — يتم تحويل `QuotationGenerateRequest` → `QuotationCreate`.
2. **إنشاء عرض السعر** — استدعاء [`create_quotation()`](app/modules/output/service.py:94):
   - التحقّق من وجود الـ RFQ.
   - التحقّق من MOQ عبر [`_validate_moq()`](app/modules/output/service.py:43).
   - إنشاء سجل [`Quotation`](app/modules/output/models.py:47) بحالة `DRAFT` مع رقم عرض فريد بتنسيق `Q-YYYYMMDD-XXXX`.
   - إنشاء سجلات [`QuotationLineItem`](app/modules/pricing/models.py) لكل منتج.
3. **إنشاء PDF** — استدعاء [`generate_quotation_pdf()`](app/modules/output/service.py:300) بشكل **متزامن** (حاليًا كحل مؤقت بسبب عدم استقرار Celery).
4. **إرسال إشعار SSE** — إعلام العميل بأن عرض السعر جاهز عبر [`notify_user()`](app/modules/output/router.py:169):
   ```python
   await notify_user(str(rfq_obj.client_id), {
       "type": "quote_ready",
       "title": "عرض سعر جديد",
       "body": f"وصلك عرض سعر جديد — {quotation.quotation_number}",
       "quotation_id": str(quotation.id),
       "rfq_id": str(quotation.rfq_id),
   })
   ```
5. **الاستجابة** — `QuotationGenerateAcceptedResponse` مع `quotation_id` و `status` (completed/pdf_failed) و `pdf_url`.

### 3.3 حقل `QuotationStatus` — حالات عرض السعر

يتبع عرض السعر [`QuotationStatus`](app/modules/output/models.py:21) الدورة التالية:

```
DRAFT → FINALIZED → SENT → ACCEPTED
                          → REJECTED
                          → EXPIRED (تلقائي بعد validity_days)
```

- **DRAFT** — الحالة الابتدائية بعد الإنشاء.
- **FINALIZED** — بعد توليد PDF وتأكيد المورّد.
- **SENT** — بعد إرسال العرض للعميل يدويًا.
- **ACCEPTED** — بعد قبول العميل.
- **REJECTED** — بعد رفض العميل.
- **EXPIRED** — بعد انتهاء صلاحية العرض.

### 3.4 هيكل عرض السعر في قاعدة البيانات

يُخزَّن عرض السعر في جدول [`quotations`](app/modules/output/models.py:47) مع الحقول الرئيسية:

```python
# app/modules/output/models.py:52
id            = UUID (PK)
rfq_id        = FK → rfqs.id
agent_id      = FK → users.id
quotation_number = VARCHAR(50) UNIQUE
status        = Enum(QuotationStatus)
tracking_status = Enum(TrackingStatus) NULL

# ملخص التسعير (منسوخ من line_items للسرعة)
target_currency = VARCHAR(10)
exchange_rate_used = Float
subtotal      = Float
freight_total = Float
customs_total = Float
commission_total = Float
discount_total = Float
vat_total     = Float
grand_total   = Float

# الشروط
payment_terms = Text
delivery_terms = Text
validity_days = Integer
notes         = Text

# PDF
pdf_path      = VARCHAR(1000)  # مفتاح MinIO
pdf_generated_at = DateTime
```

---

## 4. إرسال عرض السعر (Sending the Quotation)

### 4.1 تدفق إرسال عرض السعر خطوة بخطوة

#### الخطوة 1: إنهاء (Finalize) عرض السعر

يستخدم المورّد زر **"إنهاء عرض السعر"** الذي يستدعي [`POST /api/v1/quotes/{id}/finalize`](app/modules/output/router.py:374):

```python
# app/modules/output/router.py:379
async def finalize(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    quotation = await finalize_quotation(db, quotation_id)
    return QuotationResponse.model_validate(quotation)
```

تقوم دالة [`finalize_quotation()`](app/modules/output/service.py:463) بما يلي:

1. **توليد PDF** — استدعاء [`generate_quotation_pdf()`](app/modules/output/service.py:300).
2. **تحديث الحالة إلى FINALIZED** — استدعاء [`update_quotation_status()`](app/modules/output/service.py:265).
3. **تحديث حالة الـ RFQ إلى QUOTED** — إصلاح خلل: الآن يتقدّم الـ RFQ من `OPEN` أو `PROCESSING` (وليس فقط `PROCESSING`).

```python
# app/modules/output/service.py:491
if rfq and rfq.status in (RFQStatus.OPEN, RFQStatus.PROCESSING):
    rfq.status = RFQStatus.QUOTED
```

**توليد PDF بالتفصيل** — [`generate_quotation_pdf()`](app/modules/output/service.py:300):

1. تحميل قالب Jinja2 (`quotation.html`) مع دعم الخط العربي Noto Sans Arabic.
2. تعبئة القالب ببيانات عرض السعر (رقم العرض، العملة، سعر الصرف، اسم العميل، الميناء، المنتجات).
3. تحويل HTML → PDF باستخدام `WeasyPrint`.
4. رفع PDF إلى **MinIO** (bucket: `quotes`) بالمفتاح `{rfq_id}/{quotation_id}/quotation_{number}.pdf`.
5. إنشاء رابط مؤقت (Presigned URL) صالح لـ **ساعة واحدة**.
6. حفظ مسار PDF في قاعدة البيانات (`pdf_path`, `pdf_generated_at`).

#### الخطوة 2: إرسال العرض للعميل

بعد التحديث إلى `FINALIZED`، يضغط المورّد زر **"إرسال العرض للعميل"** الذي يستدعي [`PUT /api/v1/quotes/{id}/status`](app/modules/output/router.py:200) مع `new_status="sent"`:

```python
# app/modules/output/router.py:205
async def update_status(
    quotation_id: str,
    new_status: QuotationStatus,
    # ...
):
```

عند تعيين الحالة إلى `SENT`:
- يصبح عرض السعر مرئيًا للعميل في واجهة [`QuotationDetailPage`](frontend/src/pages/quotes/QuotationDetailPage.tsx).
- تظهر للعميل أزرار **قبول** و **رفض** عرض السعر.
- يتم إرسال إشعار SSE إلى العميل (لكن هذا يتم بالفعل في خطوة الإنشاء).

#### الخطوة 3: العميل يقبل أو يرفض

**القبول** — [`POST /api/v1/quotes/{id}/accept`](app/modules/output/router.py:285):

```python
# app/modules/output/router.py:290
async def client_accept(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

التحقّقات:
1. هل المستخدم الحالي هو **عميل** (ليس وكيل أو مشرف)؟
2. هل الـ RFQ الخاص بعرض السعر يخص هذا العميل؟
3. هل عرض السعر بحالة `FINALIZED` أو `SENT`؟

عند القبول الناجح:
1. تحديث الحالة إلى `ACCEPTED`.
2. إنشاء **أول حدث تتبع** (Tracking Event) تلقائيًا: `awaiting_payment` مع ملاحظة "العميل وافق على عرض السعر".
3. إرسال إشعار SSE إلى المورّد:
   ```python
   await notify_user(str(quotation.agent_id), {
       "type": "quote_accepted",
       "title": "تم قبول عرض السعر",
       "body": f"العميل وافق على العرض {quotation.quotation_number}",
       "quotation_id": str(quotation.id),
   })
   ```

**الرفض** — [`POST /api/v1/quotes/{id}/reject`](app/modules/output/router.py:348):

```python
# app/modules/output/router.py:353
async def client_reject(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

- تحديث الحالة إلى `REJECTED`.
- إلغاء الوصول إلى PDF (يرجع `403 Forbidden` عند محاولة تحميله).

### 4.2 واجهة المستخدم لعرض السعر

#### صفحة تفاصيل عرض السعر — [`QuotationDetailPage`](frontend/src/pages/quotes/QuotationDetailPage.tsx)

تعرض الصفحة:
- **شريط الحالة** — مع لون مناسب وخيار عرض التتبع للمقبول.
- **ملخص السعر** — الإجمالي قبل الضريبة، ضريبة القيمة المضافة، المبلغ النهائي.
- **جدول المنتجات** — مع تفاصيل التكلفة لكل منتج (الشحن، الجمارك، العمولة، الخصم).
- **أزرار الإجراءات**:
  - **العميل**: `canRespond` عندما تكون الحالة `sent` أو `finalized` ← أزرار قبول/رفض مع خطوة تأكيد.
  - **المورّد**: `canSend` عندما تكون الحالة `draft` أو `finalized` ← زر إرسال.
- **رابط تحميل PDF** — يُعيد توجيه المتصفح إلى الرابط الموقّع من MinIO.

#### قائمة عروض الأسعار — [`QuotationListPage`](frontend/src/pages/quotes/QuotationListPage.tsx)

تعرض جدولًا بالأعمدة:
- رقم العرض (`Q-20260602-XXXX`)
- اسم العميل
- المبلغ الإجمالي
- **الحالة** مع شارة ملونة ونص عربي
- **تتبع الشحنة** (للمقبولة فقط مع أيقونة 🚚)
- التاريخ
- إجراءات (عرض + تتبع)

### 4.3 التعامل مع PDF

- **توليد PDF** — يتم بشكل متزامن حاليًا (حل مؤقت). إذا فشل، يُعاد `status="pdf_failed"` ويمكن إعادة المحاولة عبر [`POST /api/v1/quotes/{id}/pdf`](app/modules/output/router.py:224).
- **تحميل PDF** — [`GET /api/v1/quotes/{id}/pdf`](app/modules/output/router.py:239) يُعيد توجيه 302 إلى رابط MinIO موقّع صالح لمدة 15 دقيقة.
- **إلغاء الوصول** — إذا كانت الحالة `REJECTED` أو `EXPIRED`، يُعاد `403 Forbidden`.

---

## 5. دورة الحياة الكاملة (Full Lifecycle)

### 5.1 التدفق الكامل من RFQ إلى التتبع

```
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 1: استلام الـ RFQ                                       │
│                                                                  │
│  Client → POST /rfqs (create RFQ)                                │
│         → Matching Algorithm → RFQMatch (PENDING, 3h window)    │
│         → Supplier sees in /rfqs/matched (exclusive)            │
│           OR  /rfqs/public (public pool after 3h)               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 2: حساب السعر                                          │
│                                                                  │
│  Supplier → /pricing/calculate?rfq_id=X                         │
│           → Select RFQ → Fill product prices                    │
│           → Click "Calculate" → POST /pricing/calculate         │
│           → PricingEngine.calculate() → 3-Phase Pipeline        │
│           → عرض النتائج (جمرك، شحن، عمولة، ضريبة، إجمالي)       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 3: إنشاء عرض السعر                                      │
│                                                                  │
│  Supplier → Click "Create Quote"                                │
│           → POST /quotes/generate                               │
│           → create_quotation() → DRAFT                          │
│           → generate_quotation_pdf() → MinIO                    │
│           → SSE notification to Client ("وصلك عرض سعر جديد")    │
│           → Navigate to /quotes/:id                             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 4: إرسال عرض السعر                                      │
│                                                                  │
│  Supplier → Click "Finalize" → POST /quotes/{id}/finalize      │
│           → توليد PDF + تحديث الحالة إلى FINALIZED              │
│           → تحديث RFQ إلى QUOTED                                │
│           → Click "Send to Client"                             │
│           → PUT /quotes/{id}/status → SENT                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 5: قبول/رفض العميل                                      │
│                                                                  │
│  Client → Opens /quotes/:id                                     │
│         → Click "قبول عرض السعر" → POST /quotes/{id}/accept    │
│           → Status = ACCEPTED                                   │
│           → Create TrackingEvent (awaiting_payment)             │
│           → SSE to Supplier ("تم قبول عرض السعر")               │
│                                                                  │
│         OR Click "رفض" → POST /quotes/{id}/reject              │
│           → Status = REJECTED                                    │
│           → PDF access revoked                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  المرحلة 6: تتبع الشحنة (6 مراحل)                                │
│                                                                  │
│  Supplier → PUT /quotes/{id}/tracking                           │
│           → يتقدّم عبر TRACKING_PIPELINE:                       │
│                                                                  │
│  awaiting_payment → production → inland_freight                 │
│  → sea_freight → customs → delivered                            │
│                                                                  │
│  - لا يمكن الرجوع إلى مرحلة سابقة                               │
│  - كل تغيير يُسجَّل كـ TrackingEvent (سجل تدقيق)                │
│  - Client و Supplier يمكنهما عرض حالة التتبع                    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 تتبع الشحنة (Order Tracking)

#### مسار التتبع — [`TRACKING_PIPELINE`](app/modules/output/service.py:506)

```python
TRACKING_PIPELINE: list[str] = [
    "awaiting_payment",   # في انتظار الدفع
    "production",         # قيد التصنيع
    "inland_freight",     # الشحن الداخلي (في الصين)
    "sea_freight",        # الشحن البحري
    "customs",            # التخليص الجمركي
    "delivered",          # تم التسليم
]
```

#### نقاط النهاية

- **عرض التتبع** — [`GET /api/v1/quotes/{id}/tracking`](app/modules/output/router.py:397): يُعيد الحالة الحالية وتاريخ الأحداث الكامل.
- **تحديث التتبع** — [`PUT /api/v1/quotes/{id}/tracking`](app/modules/output/router.py:414): متاح للمورّد والمشرف فقط.

#### التحقّق من صحة التقدّم — [`_validate_tracking_transition()`](app/modules/output/service.py:516)

- الحالة الأولى يجب أن تكون `awaiting_payment` (تُنشأ تلقائيًا عند القبول).
- كل حالة جديدة يجب أن تلي الحالة الحالية في الـ pipeline (لا رجوع للخلف).
- إذا كانت الحالية `None` (لم يُبدأ التتبع بعد) ← يجب أن تكون الجديدة `awaiting_payment`.

#### سجل التدقيق — [`TrackingEvent`](app/modules/output/models.py:126)

كل تغيير في `tracking_status` يُسجَّل في جدول `tracking_events` مع:
- `from_status` ← الحالة السابقة (nullable للحالة الأولى).
- `to_status` ← الحالة الجديدة.
- `notes` ← ملاحظات المورّد (اختياري).
- `changed_by_id` ← معرف المستخدم الذي أجرى التغيير.
- `created_at` ← وقت التغيير.

### 5.3 إشعارات SSE (Real-time Notifications)

| الحدث | النوع | المرسل | المستلم | التوقيت |
|-------|-------|--------|---------|---------|
| عرض سعر جديد | `quote_ready` | Backend | Client | بعد إنشاء عرض السعر |
| تم قبول العرض | `quote_accepted` | Backend | Supplier | بعد قبول العميل |

يتم الإشعار عبر [`notify_user()`](app/modules/shared/notifications.py) باستخدام Server-Sent Events.

### 5.4 حالات الـ RFQ عبر الدورة

يتطوّر [`RFQStatus`](app/modules/intake/models.py:21) خلال الدورة:

```
OPEN ─→ PROCESSING ─→ QUOTED ─→ CLOSED
  │                                      │
  └──→ CANCELLED (بواسطة المشرف) ────────┘
```

- **OPEN** — بعد الإنشاء، متاح للمطابقة والظهور في المجمع العام.
- **PROCESSING** — عندما يبدأ المورّد بمعالجة الـ RFQ (اختياري).
- **QUOTED** — بعد إنهاء عرض السعر (تحديث تلقائي من `finalize_quotation`).
- **CLOSED** — بعد قبول العرض أو إغلاقه يدويًا.
- **CANCELLED** — إلغاء الـ RFQ.

### 5.5 إحصائيات واستعلامات

- **قائمة عروض الأسعار** — [`GET /api/v1/quotes`](app/modules/output/router.py:71): تدعم التصفية حسب الـ RFQ والحالة والدور مع عزل البيانات:
  - **المشرف (Admin)**: يرى الكل.
  - **المورّد (Agent)**: يرى عروضه فقط.
  - **العميل (Client)**: يرى عروض RFQs التي يملكها.
- **تفاصيل عرض السعر** — [`GET /api/v1/quotes/{id}`](app/modules/output/router.py:185).
- **تحديث الحالة** — [`PUT /api/v1/quotes/{id}/status`](app/modules/output/router.py:200): متاح للمورّد (عروضه فقط) والمشرف (الكل).

---

## 6. تأثير الـ JCAP Refactor على العملية

### 6.1 نظرة عامة على الـ Refactor

خطة إعادة هيكلة محرك التسعير في [`plans/jcap-pricing-refactor-plan.md`](plans/jcap-pricing-refactor-plan.md) تهدف إلى فصل المراحل الثلاثة إلى وحدات مستقلة قابلة للاختبار والصيانة.

### 6.2 التغييرات المقترحة

#### أ. فصل المحرك إلى 3 وحدات مستقلة

**الوضع الحالي**: جميع المراحل الثلاث في [`PricingEngine`](app/modules/pricing/engine.py:145).

**الوضع بعد الـ Refactor**:

1. **[`PortArrivalCalculator`](plans/jcap-pricing-refactor-plan.md:243)** — وحدة مخصصة للمرحلة 1 (تحويل العملات، CBM، الشحن، التأمين، CIF).
2. **[`JCAPTaxEngine`](plans/jcap-pricing-refactor-plan.md:263)** — وحدة مخصصة للمرحلة 2 (الجمارك، الضرائب، رسوم JCAP).
3. **[`CommercialPricingEngine`](plans/jcap-pricing-refactor-plan.md:286)** — وحدة مخصصة للمرحلة 3 (العمولة، الخصومات، القواعد المخصصة، هامش الربح).

منسّق الـ Pipeline يقوم باستدعاء الوحدات الثلاث بالتسلسل.

#### ب. إصلاح الأخطاء الخمسة

| الخلل | الوصف | التأثير | الحل |
|-------|-------|---------|------|
| **Bug 1** | رسوم 301 الثابتة تستخدم معدل VAT العام بدلاً من `vat_rate_020` الخاص بـ HS Code | ضريبة غير دقيقة | استخدام `vat_rate_020` من HS Code لحساب VAT على 301 |
| **Bug 2** | العمولة تُحسب على أساس خاطئ (تستثني VAT و 301) | عمولة غير دقيقة | حساب العمولة بعد إضافة جميع رسوم المرحلتين 1 و2 |
| **Bug 3** | عقوبة 018 تُتخطى عندما تكون `requires_license = None` | لا تُطبّق العقوبة | معاملة `None` كـ `True` (يتطلّب ترخيصًا) |
| **Bug 4** | تبديل `vat_base_includes_fees` يسبب معاملة غير متناسقة لـ VAT | عدم تناسق في الحساب | توحيد: VAT base يشمل دائمًا جميع الرسوم (CIF + duty + 070 + 018 + 301) |
| **Bug 5** | لا يوجد مسار إدخال CIF نظيف (يفترض دائمًا RMB → USD → JOD) | عدم المرونة | السماح بإدخال CIF مباشرة عند توفّر فاتورة الشراء الفعلية |

#### ج. حقول قاعدة بيانات جديدة

سيتم إضافة حقول جديدة إلى جدول [`quotations`](app/modules/output/models.py:47) في الـ Migration `017`:

```python
# جداول تسعير 3-Phase
phase1_total      = Column(Float, default=0.0)  # CIF total
phase2_total      = Column(Float, default=0.0)  # Customs & Tax total
phase3_total      = Column(Float, default=0.0)  # Commercial adjustments
cif_value_total   = Column(Float, default=0.0)  # Total CIF value
insurance_total   = Column(Float, default=0.0)  # Total insurance
service_fee_301   = Column(Float, default=0.0)  # 301 flat fee
service_fee_070   = Column(Float, default=0.0)  # 070 service fee
penalty_018       = Column(Float, default=0.0)  # 018 penalty
vat_rate_020_used = Column(Float, default=0.16) # VAT rate actually used
```

#### د. تحديث واجهة المستخدم

ستظهر في صفحة تفاصيل عرض السعر [`QuotationDetailPage`](frontend/src/pages/quotes/QuotationDetailPage.tsx) أقسام جديدة:

1. **قسم تفصيل النفقات الجمركية**:
   - رسم جمركي (001) — `customs_duty`.
   - رسوم خدمات (070) — `service_percent_070`.
   - غرامة (018) — `penalty_018` (إذا وُجدت).
   - رسم ثابت (301) — `service_flat_301`.
   - ضريبة قيمة مضافة (020) — `vat_cost`.

2. **قسم تفصيل المراحل الثلاث**:
   - المرحلة 1 (CIF): سعر الوحدة، الشحن، التأمين.
   - المرحلة 2 (Customs): الجمارك، الرسوم، الضرائب.
   - المرحلة 3 (Commercial): الخصومات، العمولة، القواعد المخصصة.

3. **موجز القواعد المُطبَّقة**:
   - عرض القواعد القانونية والمخصصة التي أثّرت على السعر.
   - معدلات الصرف المستخدمة (CNY → USD → JOD).

### 6.3 التأثير على تدفق إنشاء عرض السعر

مع الـ JCAP Refactor، سيتغير [`usePricingCalculator`](frontend/src/pages/pricing/usePricingCalculator.ts) ليشمل:

1. **اختيار طريقة حساب CIF**:
   - الطريقة الحالية (RMB → USD → JOD).
   - إدخال CIF مباشر (عند توفّر فاتورة الشراء الفعلية).

2. **عرض تفصيل المراحل الثلاث** في النتائج:
   ```
   المرحلة 1: CIF = ¥1,000 → $140 → 104.70 JOD
   المرحلة 2: Duty(50) + 070(10) + 018(0) + 301(20) + VAT(28.8) = 108.80 JOD
   المرحلة 3: Commission(8.60) - MOQ(0) + Custom(0) = 8.60 JOD
   الإجمالي: 222.10 JOD
   ```

3. **عرض `ThreePhaseBreakdown`** لكل منتج:
   ```typescript
   interface PhaseBreakdown {
     phase_1_duty: number;       // الجمارك من المرحلة 1
     phase_2_service: number;    // رسوم الخدمة من المرحلة 2
     phase_3_vat_penalty: number; // VAT والعقوبات من المرحلة 3
   }
   ```

### 6.4 الجدول الزمني للهجرة

| المرحلة | الوصف | المدة المتوقعة |
|---------|-------|----------------|
| **Phase A** | فصل المراحل في الـ Backend + إضافة الحقول الجديدة | 3-5 أيام |
| **Phase B** | طبقة التوافق العكسي (Backward Compatibility) | 1-2 يوم |
| **Phase C** | تحديث واجهة المستخدم | 2-3 أيام |
| **Phase D** | الاختبارات والتحقّق | 2-3 أيام |

---

## 7. ملحق: خريطة API الكاملة

### 7.1 نقاط نهاية الـ Intake (RFQ)

| الطريقة | المسار | الوصف | الأدوار المسموحة |
|--------|--------|-------|------------------|
| `POST` | `/api/v1/rfqs` | إنشاء RFQ | client, agent, admin |
| `GET` | `/api/v1/rfqs` | قائمة RFQs | كل الأدوار |
| `GET` | `/api/v1/rfqs/matched` | المطابقات الحصرية للمورّد | agent, admin |
| `GET` | `/api/v1/rfqs/public` | المجمع العام | agent, admin |
| `GET` | `/api/v1/rfqs/{id}` | تفاصيل RFQ | كل الأدوار |
| `PUT` | `/api/v1/rfqs/{id}/status` | تحديث حالة RFQ | agent, admin |
| `POST` | `/api/v1/rfqs/{id}/products` | إضافة منتجات | كل الأدوار |
| `POST` | `/api/v1/matches/{id}/claim` | الرد على مطابقة | agent, admin |

### 7.2 نقاط نهاية التسعير (Pricing)

| الطريقة | المسار | الوصف | الأدوار المسموحة |
|--------|--------|-------|------------------|
| `POST` | `/api/v1/pricing/calculate` | حساب السعر الكامل | agent, admin |
| `POST` | `/api/v1/pricing/estimate` | تقدير سريع | كل الأدوار |
| `GET` | `/api/v1/pricing/rules` | قائمة قواعد التسعير | admin |
| `POST` | `/api/v1/pricing/rules` | إنشاء قاعدة تسعير | admin |
| `PUT` | `/api/v1/pricing/rules/{id}` | تحديث قاعدة تسعير | admin |
| `DELETE` | `/api/v1/pricing/rules/{id}` | حذف قاعدة تسعير | admin |
| `GET` | `/api/v1/pricing/hs-codes` | قائمة رموز HS | admin |
| `POST` | `/api/v1/pricing/hs-codes` | إنشاء رمز HS | admin |
| `POST` | `/api/v1/pricing/exchange-rates/refresh` | تحديث أسعار الصرف | admin |

### 7.3 نقاط نهاية عروض الأسعار (Quotations)

| الطريقة | المسار | الوصف | الأدوار المسموحة |
|--------|--------|-------|------------------|
| `POST` | `/api/v1/quotes` | إنشاء عرض سعر (بدون PDF) | agent, admin |
| `GET` | `/api/v1/quotes` | قائمة عروض الأسعار | كل الأدوار |
| `POST` | `/api/v1/quotes/generate` | إنشاء عرض سعر + PDF | agent, admin |
| `GET` | `/api/v1/quotes/{id}` | تفاصيل عرض السعر | كل الأدوار |
| `PUT` | `/api/v1/quotes/{id}/status` | تحديث حالة عرض السعر | agent, admin |
| `POST` | `/api/v1/quotes/{id}/finalize` | إنهاء عرض السعر | agent, admin |
| `POST` | `/api/v1/quotes/{id}/pdf` | توليد PDF | agent, admin |
| `GET` | `/api/v1/quotes/{id}/pdf` | تحميل PDF (توجيه) | كل الأدوار |
| `POST` | `/api/v1/quotes/{id}/accept` | قبول عرض السعر | client |
| `POST` | `/api/v1/quotes/{id}/reject` | رفض عرض السعر | client |
| `GET` | `/api/v1/quotes/{id}/tracking` | عرض حالة التتبع | كل الأدوار |
| `PUT` | `/api/v1/quotes/{id}/tracking` | تحديث حالة التتبع | agent, admin |

### 7.4 مسارات الواجهة الأمامية

| المسار | الصفحة | الأدوار المسموحة |
|--------|--------|------------------|
| `/pricing/calculate` | حاسبة التسعير | agent, admin |
| `/quotes` | قائمة عروض الأسعار | كل الأدوار |
| `/quotes/:id` | تفاصيل عرض السعر | كل الأدوار |
| `/rfq/supplier-inbox` | صندوق وارد المورّد | agent, admin |
| `/rfq/list` | قائمة RFQs | كل الأدوار |
| `/rfq/:id` | تفاصيل RFQ | كل الأدوار |
| `/orders` | قائمة الطلبات | كل الأدوار |
| `/orders/:id/tracking` | تتبع الشحنة | كل الأدوار |

---

## خلاصة

تم توثيق دورة إنشاء وإرسال عرض السعر بالكامل بدءًا من رؤية المورّد لطلبات عروض الأسعار (عبر المطابقات الحصرية والمجمع العام)، مرورًا بحساب التكلفة باستخدام محرك التسعير ثلاثي المراحل (JCAP/ASYCUDA)، وإنشاء عرض السعر مع PDF، وصولًا إلى إرساله للعميل وقبوله/رفضه وتتبع الشحنة.

**النقاط الرئيسية**:
- 🚚 المورّد يرى RFQs عبر قناتين: **حصري (3 ساعات)** و **عام (بعد انتهاء المهلة)**.
- 💰 محرك التسعير يطبق 3 مراحل: **Port Arrival → JCAP Customs → Commercial Pricing**.
- 📄 PDF يولَّد باستخدام **Jinja2 + WeasyPrint** ويُرفع إلى **MinIO**.
- 🔔 الإشعارات ترسل عبر **SSE** باللغة العربية.
- 📦 التتبع يمر بـ **6 مراحل** مع سجل تدقيق كامل.
- 🛠️ الـ JCAP Refactor سيفصل المحرك إلى 3 وحدات مستقلة ويصلح 5 أخطاء معروفة.

</div>
