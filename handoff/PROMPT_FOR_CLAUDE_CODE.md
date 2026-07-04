# Prompt لـClaude Code — انسخه كما هو

أنت تعمل على مشروع **AI-Sourcing Hub** وقد قرأت ملف `CLAUDE.md` في
جذر هذا المشروع. هذا الملف هو مرجعك الوحيد لقرارات التصميم.

## مهمتك بالترتيب:

### 1. إعداد نظام التصميم (لا تبدأ بالصفحات قبل هذا)
- أضف ألوان `supplier`, `importer`, `brand` إلى `tailwind.config.ts`
  من ملف `lib/tokens.ts` المرفق
- أضف خط Cairo (Google Fonts) إلى `app/layout.tsx`
- اضبط `<html dir="rtl" lang="ar">` كافتراضي
- ثبّت `next-intl` وأعدّه للغات: ar، en، zh

### 2. المكوّنات المشتركة (قبل أي صفحة)
ابنِ هذه المكوّنات أولاً لأن كل الصفحات تحتاجها:
- `components/layout/Sidebar.tsx` — يأخذ prop `role: 'agent'|'client'|'admin'`
  ويعرض القائمة المناسبة من `CLAUDE.md` قسم 7
- `components/layout/MobileDrawer.tsx` — نفس المحتوى، ينزلق من اليمين
- `components/layout/BottomNav.tsx` — يأخذ `role` ويعرض أهم 5 روابط
- `components/layout/TopBar.tsx` — شريط علوي موبايل (☰ + العنوان + الأفاتار)

### 3. استبدال الصفحات الحالية بالتصميم الجديد
لكل صفحة: **لا تحذف منطق الـAPI والبيانات، فقط استبدل JSX**

| الصفحة الحالية | المرجع الجديد |
|----------------|---------------|
| صفحة رئيسية المورد/المندوب | `CLAUDE.md` قسم 7 — Agent nav |
| صفحة رئيسية المستورد | `CLAUDE.md` قسم 7 — Client nav |
| حاسبة التسعير | `CLAUDE.md` قسم 6 — LineRow component |
| شاشة الريلز | `CLAUDE.md` قسم 8 — منطق RFQ-per-View |

### 4. ربط الـAPI
استبدل كل البيانات الوهمية (mock/hardcoded) بـcalls حقيقية من
`CLAUDE.md` قسم 10. استخدم `NEXT_PUBLIC_API_URL` من `.env`.

### 5. الموبايل
لكل صفحة: تأكد من وجود نسخة موبايل منفصلة بـ Drawer + BottomNav
حسب `CLAUDE.md` قسم 4.

## ملاحظات مهمة:
- اقرأ `CLAUDE.md` أولاً ثم ابدأ — لا تخترع أنماطاً
- الألوان من `tokens.ts` فقط — لا hex مكتوبة يدوياً
- `text-start`/`text-end` بدل `text-right`/`text-left`
- RFQ-per-View هو المقياس الوحيد للريلز
- أي سؤال عن قرار تصميمي → الجواب في `CLAUDE.md`

