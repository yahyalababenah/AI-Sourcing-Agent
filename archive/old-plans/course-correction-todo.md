# خطة إعادة التوجيه — Course Correction Todo List

## الأولويات حسب ماتم الاتفاق

```
📱 WhatsApp API  +  🌐 Web App (يدوي)  +  👤 الوكيل (يدخل نيابة)
                        ↓
            🤖 AI Pipeline (NLP + Vision + تسعير)
                        ↓
                        📄 عرض سعر
```

---

## 🟢 P0 — Critical (يشتغل أولًا)

### 1. تفعيل AI Vision Pipeline
- [ ] تشغيل [`vision_client.py`](app/modules/documents/vision_client.py) — تأكيد أن OpenRouter/Together AI يعملان
- [ ] إضافة `OPENROUTER_API_KEY` و `TOGETHER_API_KEY` إلى `.env`
- [ ] اختبار معالجة مستند PDF → استخراج بيانات المنتجات
- [ ] التأكد من أن [`DocumentDetailPage`](frontend/src/pages/documents/DocumentDetailPage.tsx:68) يعرض النتائج بشكل صحيح

### 2. بناء Arabic NLP Pipeline
- [ ] إنشاء [`app/modules/intake/arabic_nlp.py`] — خدمة NLP جديدة
- [ ] استخدام LLM (Gemini/Qwen) لتحليل النصوص العربية غير المنظمة
- [ ] استخراج: `{ product_name, quantity, specs, destination_port, target_currency }`
- [ ] إنشاء API endpoint: `POST /api/v1/intake/parse-arabic`
- [ ] ربطها مع واجهة الوكيل (يدخل طلب العميل نصوصًا)

### 3. تكامل WhatsApp API
- [ ] إنشاء [`app/modules/whatsapp/`] — موديول جديد
- [ ] ربط [Meta WhatsApp Cloud API] أو Twilio
- [ ] Webhook لاستقبال الرسائل الواردة
- [ ] ربط الرسالة المستلمة → Arabic NLP → Vision → تسعير → رد
- [ ] إرسال عرض السعر كرد على واتساب

---

## 🟡 P1 — High Priority

### 4. تبسيط UX في Web App
- [ ] تقليل عدد الخطوات لإنشاء طلب (حاليًا 9 خطوات → 3 خطوات)
- [ ] دمج [`DocumentUploadPage`](frontend/src/pages/documents/DocumentUploadPage.tsx:8) و [`DocumentDetailPage`](frontend/src/pages/documents/DocumentDetailPage.tsx:68) في تدفق واحد
- [ ] ربط [`PricingCalcPage`](frontend/src/pages/pricing/PricingCalcPage.tsx:22) بالتسعير التلقائي (بدون تدخل يدوي)
- [ ] إضافة صفحة "الطلبات الواردة" للوكيل (Inbox-style)

### 5. تسعير تلقائي
- [ ] ربط Pricing Engine بالـ Pipeline بحيث يكون Background task
- [ ] إزالة الحاجة لفتح [`PricingCalcPage`](frontend/src/pages/pricing/PricingCalcPage.tsx:22) يدويًا
- [ ] إضافة قواعد تسعير افتراضية (من config) تشتغل تلقائيًا

---

## 🔵 P2 — Important

### 6. تحسين الـ Web App للعميل
- [ ] واجهة أبسط وبدون تسجيل (Guest mode)
- [ ] إنشاء طلب عبر [`ClientDashboard`](frontend/src/pages/dashboard/ClientDashboard.tsx:32) بخطوة واحدة
- [ ] متابعة الحالة عبر رابط (بدون تسجيل دخول)

### 7. تحسينات UX إضافية
- [ ] Skeleton loading بدلاً من spinner
- [ ] إشعارات نجاح/فشل لكل العمليات
- [ ] تنسيق الأرقام والعملات
- [ ] البحث في القوائم المنسدلة

---

## ⚪ P3 — Later

### 8. لوحة المشرف
- [ ] إخفاء [`PricingRulesPage`](frontend/src/pages/pricing/PricingRulesPage.tsx:1) من الـ MVP الحالي
- [ ] تبسيط [`AdminDashboard`](frontend/src/pages/dashboard/AdminDashboard.tsx:28)

---

## هيكل الموديولات الجديد

```
app/modules/
├── auth/              # Authentication (موجود)
├── intake/            # RFQ + Arabic NLP (إضافة NLP)
│   ├── arabic_nlp.py  # NEW — Arabic text parser
│   └── ...
├── documents/         # Document + Vision AI (موجود، يحتاج تفعيل)
├── pricing/           # Pricing Engine (موجود)
├── whatsapp/          # NEW — WhatsApp integration
│   ├── router.py
│   ├── service.py
│   ├── schemas.py
│   └── webhook.py
├── output/            # Quotations (موجود)
└── monitoring/        # Admin (موجود)
```
