# AI-Sourcing Hub — Project Instructions for Claude Code

> اقرأ هذا الملف كاملاً قبل أن تلمس أي كود.
> هو مرجعك الوحيد للروح، القرارات التصميمية، والقواعد التقنية.

---

## من نحن وماذا نبني

AI-Sourcing Hub منصة B2B تقنية تربط المستوردين الأردنيين بالموردين
الصينيين. نبدأ بمندوبي المبيعات كمستخدمين أساسيين — هم من يحسبون
التكلفة الواصلة الحقيقية للبضاعة (شحن + جمارك + ضريبة) ويعرضونها
بثقة للمستوردين.

الطموح أكبر من "حاسبة تكلفة": نريد بناء مجتمع تجاري حي، فيه محتوى
مرئي حقيقي من المصانع الصينية، ومستوردون يكتشفون فرصاً، ومندوبون
يديرون علاقات عمل — كل هذا داخل منصة واحدة تشعر وكأنها مبنية لهم
تحديداً.

---

## الطابع (Vibe) — اللغة الثالثة

المنصة لا تنسخ LinkedIn ولا Instagram — تصنع **لغة تصميم ثالثة** تأخذ
روح الاثنين:

- **من LinkedIn**: الجدية المهنية، الثقة، الشفافية (من هو هذا
  المستخدم؟ كم صفقاته؟ هل موثّق؟). كل حساب يمثل عملاً حقيقياً.
- **من Instagram**: البساطة في التنقل، المتعة البصرية، الاعتماد على
  الصورة/الفيديو كلغة أساسية، سلاسة تخلي المستخدم يتصفح بلا تعب ذهني.

التوازن يختلف حسب الشاشة:
- شاشات الأدمن → LinkedIn بحت (أبسط وأوضح)
- شاشات الريلز والمنتجات → Instagram غالب
- رئيسية المورد/المندوب → LinkedIn غالب (لوحة عمل)
- رئيسية المستورد → متوازن

---

## المستخدمون والأدوار

| الدور | الـroute | اللون | الجرعة |
|-------|---------|-------|--------|
| مندوب مبيعات (Agent) | `/agent/*` | `supplier-*` زمردي | LinkedIn غالب |
| مستورد (Client) | `/client/*` | `importer-*` نيلي | متوازن |
| أدمن (Admin) | `/admin/*` | slate محايد | LinkedIn بحت |

---

## قواعد ثابتة — غير قابلة للتفاوض

1. **RTL أساسي**: العربية هي اللغة الافتراضية. استخدم `dir="rtl"` على
   `<html>`. استخدم `text-start`/`text-end` بدل `text-right`/`text-left`.

2. **الأرقام المالية**: وضوح مطلق، بلا تنازل للزخرفة. `tabular-nums`
   للأرقام. slate/black للبنود. الأخضر للإجمالي النهائي فقط.

3. **RFQ-per-View**: المقياس الوحيد للمحتوى المرئي هو عدد طلبات عروض
   الأسعار الناتجة — ليس المشاهدات ولا اللايكات. أي تفاعل اجتماعي
   يُعاد تفسيره تجارياً.

4. **الملفين**: كل شاشة = ملف ديسكتوب + ملف موبايل منفصلَين. لا
   صفحة responsive وحيدة تخفي/تظهر بـ `hidden md:block`.

5. **B2B جادة**: حتى أكثر الأجزاء "اجتماعية" (الريلز) تخدم هدفاً
   تجارياً واضحاً، ليس ترفيهاً بحتاً.

---

## نظام الألوان — لا تغيّر هذه القيم

```ts
// lib/tokens.ts — المرجع الوحيد للألوان
export const colors = {
  supplier: {          // المورد والمندوب
    50:  "#E1F5EE",
    100: "#9FE1CB",
    400: "#1D9E75",
    500: "#10B981",   // CTA الأساسي
    600: "#0F6E56",   // hover
    900: "#04342C",   // cover/header
  },
  importer: {          // المستورد
    50:  "#E0E7FF",
    100: "#C7D2FE",
    400: "#6366F1",
    500: "#4F46E5",   // CTA الأساسي
    600: "#4338CA",   // hover
    900: "#312E81",   // cover/header
  },
  brand: {             // هوية المنصة — سايد بار، لوجو، عناصر مشتركة
    50:  "#ECFDF5",
    100: "#D1FAE5",
    500: "#10B981",
    600: "#0F6E56",
    900: "#065F46",
  },
}
```

**قاعدة الاستخدام:**
- صفحات Agent → `supplier-*` حصراً
- صفحات Client → `importer-*` حصراً
- السايد بار والعناصر المشتركة → `brand-*`
- الأرقام المالية → slate بلا ألوان زخرفية

---

## الخطوط والاتجاه

```ts
// tailwind.config.ts
fontFamily: {
  cairo:  ["Cairo", "sans-serif"],       // العربية
  inter:  ["Inter", "sans-serif"],       // الإنجليزية
  noto:   ["Noto Sans SC", "sans-serif"],// الصينية
}
```

```tsx
// app/layout.tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
```

---

## بنية الشاشات

### ديسكتوب
```
┌──────────────┬─────────────────────────┐
│  sidebar     │  topbar (اسم + مستخدم) │
│  240px right ├─────────────────────────┤
│  (RTL)       │  page content           │
└──────────────┴─────────────────────────┘
```

### موبايل — نمط مزدوج إلزامي
```
┌─────────────────────┐
│  ☰  عنوان   avatar  │  top bar
├─────────────────────┤
│   page content      │
├─────────────────────┤
│  home|inbox|★|chat  │  bottom nav (5 items max)
└─────────────────────┘
```
- **☰** يفتح Drawer جانبي من اليمين (RTL) — يحتوي كل روابط السايد بار
  + الإعدادات + تسجيل الخروج
- **Bottom nav** = أكثر 5 أشياء استخداماً فقط
- هذا النمط إلزامي لكل شاشة موبايل بلا استثناء

---

## قوائم السايد بار حسب الدور

### Agent (مورد/مندوب)
```
الرئيسية | طلبات الشراء | طلبات العملاء الواردة
السوق العالمي | منتجاتي | حاسبة التسعير
عروض الأسعار | تتبّع الشحنات | المحادثات | أستوديو اللقطات
```

### Client (مستورد)
```
لوحة التحكم | السوق العالمي | طلب عرض سعر جديد
طلباتي | المحادثات | تتبّع الشحنات
```

### Admin
```
لوحة التحكم | مراقبة النظام | توثيق الموردين
قواعد التسعير | جداول رسوم HS | الكتالوج العالمي | إدارة المستخدمين
```

---

## مكوّنات جاهزة — استخدمها لا تعيد كتابتها

### StatCard
```tsx
<div className="bg-white rounded-xl border border-slate-200 p-4">
  <div className="text-2xl font-bold text-slate-900">{value}</div>
  <div className="text-xs text-slate-500 mt-1">{label}</div>
</div>
```

### LineRow (الحاسبة والفواتير)
```tsx
<div className="flex items-center justify-between py-2.5 border-b border-slate-100">
  <span className={`text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>{label}</span>
  <span className="text-sm font-medium text-slate-900 tabular-nums">${value}</span>
</div>
```

### ReelTile (بلاطة مقطع مرئي)
```tsx
<div className={`relative rounded-xl overflow-hidden aspect-[2/3] ${tint}`}>
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-7 h-7 rounded-full bg-white/85 flex items-center justify-center">
      <Play className={`w-3.5 h-3.5 ${playColor}`} fill="currentColor" />
    </div>
  </div>
  {/* overlay تجاري — دائماً موجود، لا يختفي */}
  <div className="absolute bottom-2 right-2 left-2 bg-slate-900/85 rounded-lg py-1 text-center">
    <span className="text-white text-[11px]">{price} · {product}</span>
  </div>
  {/* مقياس RFQ — بارز وأخضر */}
  <div className="absolute top-2 right-2 text-[10px] text-supplier-400 font-medium bg-black/30 rounded px-1">
    {rfqCount} طلب سعر
  </div>
</div>
```

### MobileDrawer
```tsx
{drawerOpen && (
  <>
    <div onClick={() => setDrawer(false)}
         className="fixed inset-0 bg-slate-900/40 z-10" />
    <div className="fixed top-0 right-0 bottom-0 w-[270px] bg-white z-20 flex flex-col">
      {/* header المنصة: لوجو + اسم */}
      {/* nav items حسب الدور */}
      {/* footer: إعدادات + تسجيل خروج */}
    </div>
  </>
)}
```

---

## منطق الريلز التجاري

### من جهة المورد (Publisher/Agent)
- مشغّل عمودي ملء الشاشة
- **طبقة تجارية دائمة لا تختفي**: اسم المصنع + توثيق + المنتج + السعر
  + زر "طلب عرض سعر"
- أزرار جانبية معاد تفسيرها: احفظ / اسأل / شارك / **الأداء**
- المقياس الرئيسي: عدد RFQ (أخضر بارز)، المشاهدات ثانوية وباهتة

### من جهة المستورد (Consumer/Client)
- نفس المشغّل بصرياً
- "إعجاب" = أضف للقائمة المختصرة
- "متابعة مصنع" = اشترك بتنبيهات منتجاته الجديدة
- "تعليق/سؤال" = يفتح محادثة تقود لـRFQ

---

## دعم تعدد اللغات

```ts
// i18n — استخدم next-intl
const locales = ['ar', 'en', 'zh'] as const
const defaultLocale = 'ar'

// الخط يتغيّر حسب اللغة
const fontMap = { ar: 'Cairo', en: 'Inter', zh: 'Noto Sans SC' }
```

- العربية: Cairo + dir="rtl"
- الإنجليزية: Inter + dir="ltr"
- الصينية: Noto Sans SC + dir="ltr"
- كل نص ثابت بالواجهة يحتاج ترجمة للثلاث لغات
- المحتوى المُدخل من المستخدم يُعرض كما هو (بلا ترجمة آلية)

---

## ربط الـAPI — نقاط النهاية الموجودة

```ts
// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL

// RFQs
GET  /api/v1/rfqs/
POST /api/v1/rfqs/
GET  /api/v1/rfqs/{id}/
POST /api/v1/rfqs/{id}/quotes/

// التسعير
GET  /api/v1/pricing/rules/
POST /api/v1/pricing/calculate/    // يعيد التكلفة الواصلة الكاملة

// الكتالوج
GET  /api/v1/catalog/products/
GET  /api/v1/catalog/products/{id}/

// المصادقة
GET  /api/v1/auth/me/              // role, name, company, avatar
POST /api/v1/auth/token/

// المحادثات
GET  /api/v1/chat/rooms/
POST /api/v1/chat/rooms/{id}/messages/

// الإدمن
GET  /api/v1/admin/stats/
GET  /api/v1/admin/users/
```

---

## ترتيب العمل المقترح

```
1. tailwind.config.ts       ← ألوان + خطوط من tokens.ts
2. app/layout.tsx            ← RTL + Cairo + i18n
3. components/layout/
   ├── Sidebar.tsx           ← prop: role → يعرض القائمة المناسبة
   ├── MobileDrawer.tsx      ← نفس محتوى السايد بار + Overlay
   ├── BottomNav.tsx         ← prop: role → أهم 5 روابط
   └── TopBar.tsx            ← ☰ + عنوان + أفاتار
4. ابدأ بالصفحات:
   /agent/dashboard          ← رئيسية المندوب
   /client/dashboard         ← رئيسية المستورد
   /agent/calculator         ← الحاسبة
   /agent/reels              ← أستوديو اللقطات
   /client/marketplace       ← السوق العالمي
```

---

## ما لا تفعله

- ❌ `text-right` أو `text-left` ثابتة → استخدم `text-start`/`text-end`
- ❌ ألوان `importer-*` على صفحات Agent والعكس
- ❌ hex مكتوبة يدوياً خارج `tokens.ts`
- ❌ أرقام مالية بألوان زخرفية (slate فقط، أخضر للإجمالي فقط)
- ❌ قياس الريلز بالمشاهدات — RFQ-per-View دائماً
- ❌ صفحة responsive واحدة بدل ملفَي desktop/mobile منفصلَين
- ❌ اختراع ألوان جديدة خارج supplier/importer/brand

---

## الملفات المرجعية المرفقة

في مجلد `handoff/` ستجد:
- `tokens.ts` — نظام الألوان، انسخه لـ `lib/tokens.ts`
- `tailwind.config.snippet.ts` — الإضافة المطلوبة لـ `tailwind.config.ts`
- `*.html` — شاشات مرجعية بصرية (افتحها بالمتصفح كمرجع)

الشاشات المرجعية:
| الملف | يمثّل |
|-------|--------|
| `supplier-home-desktop/mobile.html` | رئيسية المورد/المندوب |
| `importer-home-desktop/mobile.html` | رئيسية المستورد |
| `pricing-calculator-desktop/mobile.html` | حاسبة التسعير |
| `supplier-reels-desktop/mobile.html` | أستوديو الريلز |
| `importer-profile.html` | ملف المستورد (ديسكتوب) |
| `importer-profile-mobile.html` | ملف المستورد (موبايل) |
