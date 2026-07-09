# خطة الـ Interactive Onboarding — الجولة التعريفية التفاعلية

> الهدف: بعد تسجيل الدخول لأول مرة، يمر المستخدم بسلايدات ترحيبية تشرح ماذا
> يستطيع أن يفعل، ثم يُنقل إلى شاشته الرئيسية مع **دليل تفاعلي (Guided Tour)**
> يمسك بيده خطوة بخطوة، ويجرّب فعلياً الخدمات (رفع ملف، الحاسبة السريعة، طلب
> سعر...)، مع **متتبّع تقدّم (Progress Tracker)** يبدأ من ~25% حتى لا يشعر
> المستخدم أن الطريق طويل.
>
> الفلسفة: **مندوبو المبيعات والعملاء غالباً غير مؤلوفين للتكنولوجيا** —
> الجولة يجب أن تُشعرهم أن الموقع بسيط ويوفّر وقتهم، لا يعقّدهم. لغة بسيطة،
> خطوات قصيرة، إمكانية التخطي في أي لحظة، وبهجة بصرية خفيفة عند كل إنجاز.

---

## 0. تحديث بعد ملاحظات ما بعد النشر (2026-07-10)

بعد نشر النسخة الأولى وتجربتها فعلياً، وردت ثلاث ملاحظات نُفّذت جميعها:

1. **السلايدات كانت صغيرة وغير حيوية بصرياً** — أُضيف لكل سلايد أيقونة كبيرة
   ملوّنة بتدرّج (badge دائري/مربّع 80-96px) داخل `welcomeSlideIcons.ts`،
   وتكبير العنوان والفقرة، وإضافة "كتل توهّج" لونية زخرفية خلف البطاقة
   (`roleAccent.glow`)، مع أنيميشن bounce-in للأيقونة وpop-in للمحتوى عند
   كل تبديل سلايد.

2. **"لا تجعل العميل يتطلّع على الميزة من الخارج، خذه بداخلها"** — هذا غيّر
   بنية `TourStep` جوهرياً: **حُذف حقل `cta` بالكامل**. كل خطوة الآن
   `route` = الصفحة الحقيقية للميزة نفسها (لا لوحة التحكم)، والمستخدم
   يُنقل إليها **تلقائياً** فور تفعيل الخطوة (`GuidedTour` ينفّذ
   `navigate()` مرة واحدة لكل خطوة عبر ref guard). `target` بقي يشير لعنصر
   القائمة الجانبية (Sidebar تُعرض في كل الصفحات فتبقى صالحة كنقطة إبراز
   حتى والمستخدم واقف داخل الميزة نفسها). ونتيجة لذلك:
   - اختفت حالة "awaitingReturn" ورسالة "خذ وقتك وجرّبها" (`onboarding.resume.*`)
     بالكامل — لم تعد هناك حاجة لتمييز "زيارة CTA" عن الحالة الطبيعية.
   - "الفعل التجريبي المتساهل" (T11) للحاسبة يعمل الآن مباشرة على صفحة
     الحاسبة الحقيقية (`onSameRoute` بدل `onCtaRoute`/`awaitingReturn`).
   - `NavGuardToast` أصبحت لها حالة واحدة فقط: "ابتعدت عن الجولة!" (تظهر
     فعلياً حين يتصرّف المستخدم خارج أزرار الجولة نفسها).

3. **لا توجد أنيميشنز حيوية وممتعة** — أُضيفت في `index.css`:
   `onboardPopIn` (دخول بارتداد خفيف overshoot)، `onboardIconBounce`
   (ارتداد الأيقونة عند كل خطوة/سلايد)، و`onboardSpotlightPulse` (نبض
   مستمر خفيف لحلقة الـSpotlight بدل تجمّد ثابت). تُطبَّق على
   `TourPopover`/`TourBottomSheet`/`WelcomeCarousel*`/`Spotlight`، وتُحترَم
   عبر قاعدة `prefers-reduced-motion` العامة الموجودة أصلاً في `index.css`.

> **ملاحظة معمارية مهمة اكتُشفت أثناء النشر**: هذه الميزة مبنية فوق بنية
> RBAC ثلاثية المستويات ونظام ألوان supplier/importer/brand الموجودين فقط
> في فرع `fix/performance-optimization` (غير مدموج بـ`main` بعد). النشر
> الفعلي تم عبر دفع محتوى ذلك الفرع مباشرة لفرع `main` الخاص بـ Hugging
> Face Space، دون لمس `main` على GitHub — راجع سجل المحادثة لتفاصيل قرار
> النشر.

---

## 1. تحليل الوضع الحالي (Codebase Analysis)

### البنية القائمة ذات الصلة

| المكوّن | المسار | الدور في الجولة |
|--------|--------|-----------------|
| `authStore` (zustand) | `frontend/src/stores/authStore.ts` | مصدر `user` / `role` / `isAuthenticated` |
| `uiStore` (zustand) | `frontend/src/stores/uiStore.ts` | نموذج جاهز لإضافة حالة الجولة (drawer مثاله) |
| `useAuth` | `frontend/src/hooks/useAuth.ts` | نقطة `login()` — بعدها نقرّر تشغيل الجولة |
| `ProtectedRoute` | `frontend/src/components/auth/ProtectedRoute.tsx` | حارس + rehydrate من `/auth/me` — أفضل نقطة لحقن مشغّل الجولة |
| `AppLayout` | `frontend/src/components/layout/AppLayout.tsx` | يوزّع حسب الدور → Client/Agent/AdminLayout |
| `DashboardRouter` | `frontend/src/pages/dashboard/DashboardRouter.tsx` | البوابة إلى `/agent|client|admin/dashboard` |
| `Sidebar` / `BottomNav` | `frontend/src/components/layout/` | عناصر تنقّل نحتاج تعليمها (anchors للـtour) |
| `useMediaQuery` | `frontend/src/hooks/useMediaQuery.ts` | للتبديل بين نسخة الجولة ديسكتوب/موبايل |
| i18n | `frontend/src/lib/i18n.ts` + `locales/{ar,en,zh}/common.json` | كل نصوص الجولة تمر عبر الترجمة (3 لغات) |
| `lib/tokens.ts` + `constants/routes.ts` | — | الألوان (supplier/importer/brand) والمسارات للـanchors |

### ملاحظات مهمة استُخلصت من الكود

1. **لا توجد أي بنية onboarding حالياً** (بحث `onboard*` = صفر نتائج) — بناء من الصفر.
2. **`user.role`** يأخذ `"client" | "agent" | "admin"` — الجولة مختلفة لكل دور.
   - الأدمن: LinkedIn بحت، جولة مختصرة إشرافية (اختياري في المرحلة الأولى).
3. **نمط الملفين إلزامي** (CLAUDE.md): كل شاشة = ملف ديسكتوب + ملف موبايل.
   الجولة يجب أن تحترم هذا: منطق مشترك + طبقتا عرض (Popover ديسكتوب / BottomSheet موبايل).
4. **الألوان مقيّدة**: صفحات Agent → `supplier-*`، Client → `importer-*`، المشترك → `brand-*`.
   **ممنوع indigo/#4F46E5 نهائياً.**
5. **RTL أساسي**: كل تموضع للـpopover/spotlight يجب أن يعمل RTL (`start`/`end` لا `left`/`right`).
6. **لا مكتبة tour مثبّتة** (لا `react-joyride` ولا `driver.js`). القرار أدناه.
7. **حالة `user` في `authStore` في الذاكرة فقط**؛ التوكنات في `localStorage` عبر `lib/auth.ts`.
   → علم "أكمل الجولة" يجب أن يُخزَّن بشكل دائم (backend مفضّل، localStorage كحل مبدئي).

---

## 2. القرارات التصميمية والتقنية

### 2.1 مكتبة الجولة أم بناء مخصّص؟

**القرار: بناء مخصّص خفيف (custom)، بلا مكتبة خارجية.** الأسباب:
- تحكّم كامل بالـRTL والعربية (معظم المكتبات ضعيفة RTL).
- التزام بنمط الملفين وألوان `tokens.ts` والحركة (≤250ms) من CLAUDE.md.
- تجنّب وزن إضافي وCSP/host قيود.
- نحتاج ربط الخطوات بأفعال حقيقية (رفع ملف/حاسبة) وليس مجرد تلوين عناصر — منطق مخصّص أوضح.

المكوّنات الأساسية المخصّصة:
- `Spotlight` — طبقة overlay معتمة مع "ثقب" حول العنصر الهدف (عبر `getBoundingClientRect` + box-shadow ضخم، أو SVG mask).
- `TourPopover` (ديسكتوب) / `TourBottomSheet` (موبايل) — بطاقة الشرح + أزرار (التالي/تخطّي/تم).
- تحديد العنصر الهدف عبر سمة `data-tour="<id>"` تُضاف على العناصر الحقيقية.

### 2.2 نموذج الحالة (State)

`onboardingStore` جديد (zustand + persist في localStorage كطبقة cache، مع الخلفية كمصدر حقيقة):
```ts
type TourStatus = "pending" | "active" | "snoozed" | "completed" | "skipped";

interface OnboardingState {
  hasSeenWelcome: boolean;        // شاهد سلايدات الترحيب
  status: TourStatus;             // بدل tourCompleted — يشمل snoozed للتأجيل
  activeStepId: string | null;    // الخطوة الحالية أو null (غير نشطة)
  expectedRoute: string | null;   // المسار المتوقّع للخطوة الحالية (للـNavigation Resilience — §2.7)
  completedSteps: string[];       // للـProgress Tracker
  role: UserRole | null;          // الجولة الحالية لأي دور
  snoozedAt: string | null;       // وقت التأجيل — يُعاد تشغيلها في الجلسة القادمة
  // actions: startTour, nextStep, prevStep, skipForever, snooze, completeStep, resetTour, resumeFromNav
}
```
- **Persist** لكل مستخدم: مفتاح `onboarding:{userId}` حتى لا تتكرّر لمستخدم آخر على نفس المتصفح.
- **`snoozed` مقابل `skipped`**: التأجيل (Snooze) يترك `status="snoozed"` فيُعاد
  التشغيل في **الجلسة القادمة** (login جديد)؛ التخطّي النهائي يضبط `skipped` بلا عودة تلقائية.

### 2.2.1 الخلفية — مصدر الحقيقة (مرفوعة إلى المرحلة الأولى)

> **قرار مُحدَّث**: T14 (الـbackend) لم تعد اختيارية — أصبحت أساسية في المرحلة الأولى.
> السبب: المندوب الذي يسجّل الدخول من حاسوب المكتب ثم يفتح موبايله في الطريق
> يجب ألّا يرى الجولة مرتين. localStorage وحده لا يعبر الأجهزة.

- migration: عمود `onboarding_status` (enum/text) + `onboarding_completed_at` (nullable timestamp) على `User`.
- `GET /api/v1/auth/me` يُرجع هذه الحقول ضمن كائن المستخدم.
- `PATCH /api/v1/auth/me` (أو endpoint مخصّص `/auth/me/onboarding`) لتحديث الحالة.
- **المزامنة**: localStorage = cache متفائل للاستجابة الفورية؛ عند كل انتقال حالة مهم
  (إتمام/تخطّي/تأجيل) نرسل PATCH. عند تسجيل الدخول، `me.onboarding_status` يغلب على المخزّن محلياً.

### 2.3 حيلة الـProgress Tracker (يبدأ من ~25-30%)

- المجموع الظاهر للمستخدم = خطوات الجولة الفعلية (مثلاً 6 خطوات).
- نضيف **"خطوتين وهميتين مُنجزتين مسبقاً"** تمثّلان "إنشاء الحساب" و"تسجيل الدخول"
  (وهما فعلاً أنجزهما!) → يبدأ العدّاد عند 2/8 ≈ **25%**.
- الصياغة: «أنجزت خطوتين — تبقّى القليل 🎉». كل إنجاز يرفع النسبة بحركة scale bounce خفيفة.
- شريط التقدّم بلون `brand-*`، دائري أو أفقي أعلى الـpopover.

### 2.4 محتوى الجولة حسب الدور

**سلايدات الترحيب (Welcome Carousel)** — 3–4 سلايدات، قابلة للقلب/التخطّي:
- Agent: «احسب التكلفة الواصلة بثقة» · «حوّل كتالوجك لمنتجات بضغطة» · «تابع صفقاتك وشحناتك».
- Client: «اكتشف موردين موثّقين» · «اطلب عرض سعر بسهولة» · «تابع طلبك حتى العقبة».

**الجولة الموجّهة (Guided Tour)** — خطوات مربوطة بعناصر حقيقية + أفعال تجريبية:

| # | Agent (المندوب) | Client (المستورد) | الفعل التجريبي |
|---|-----------------|-------------------|-----------------|
| 1 | تعريف السايدبار/التنقّل | نفس | إبراز فقط |
| 2 | «جرّب الحاسبة السريعة» → `/agent/standalone-calculator` | «تصفّح السوق العالمي» → `/marketplace` | نقر فعلي + إدخال قيمة |
| 3 | «ارفع كتالوج/ملف» → `/documents/upload` | «اطلب عرض سعر» → `/rfq/create` | فتح الشاشة (رفع/إرسال اختياري) |
| 4 | «اطلع على طلبات العملاء الواردة» → `/rfq/supplier-inbox` | «تابع طلباتي» → `/rfq` | إبراز |
| 5 | «تتبّع الشحنات» → `/orders` | «تتبّع الشحنة» → `/orders` | إبراز |
| 6 | «المحادثات + الملف الشخصي» | نفس | إبراز + إنهاء |

- كل خطوة: عنوان قصير + جملة شرح ببساطة + زر «التالي» + رابط «تخطّي الجولة».
- الخطوات ذات الفعل التجريبي: زر أساسي «جرّبها الآن» (لون الدور) ينقل فعلياً للشاشة،
  وعند وصولها ووقوع الحدث المطلوب تُحسب الخطوة مُنجزة تلقائياً.
- **تساهُل في الفعل التجريبي (Step Forgiveness)**: المستخدم قد لا يملك ملفاً جاهزاً
  أو لا يريد إرسال RFQ حقيقي الآن. لذلك **اجتياز الخطوة يتحقق بأخفّ فعل ذي معنى**:
  - «ارفع ملف» → يكفي **فتح متصفّح الملفات / الوصول لمنطقة الرفع** (لا رفع فعلي مطلوب).
  - «اطلب عرض سعر» → يكفي **فتح النموذج والوصول إليه** (لا إرسال مطلوب).
  - «الحاسبة» → يكفي **إدخال قيمة واحدة أو النقر على احسب** (لا صحّة كاملة مطلوبة).
  - كل خطوة تفاعلية تحمل أيضاً زر «تخطّي هذه الخطوة» صغير حتى لا يشعر المستخدم بالحصار.
- **الأدمن**: مرحلة أولى = سلايدات ترحيب مختصرة فقط (بلا tour موجّه)، توسّع لاحقاً.

### 2.5 نقطة التشغيل (Trigger) ومخرج الطوارئ اللطيف

- بعد `login()` الناجح ومعرفة الدور: إن `status ∈ {pending, snoozed}` →
  توجيه إلى الداشبورد ثم تشغيل الترحيب تلقائياً (الـ`snoozed` يُعاد تشغيله هنا في الجلسة الجديدة).
- التشغيل الفعلي يُحقن في **`AppLayout`** (يعرف الدور + يلفّ كل الشاشات) عبر
  `<OnboardingProvider>` يراقب `onboardingStore` ويعرض الطبقات فوق أي صفحة.
- **مخرج الطوارئ اللطيف (بدل زر "تخطّي" واحد)** — الفئة المستهدفة قد تدخل مستعجلة:
  - **«ذكّرني لاحقاً» (Snooze)** → `status="snoozed"`، تُغلق الجولة الآن وتعود في **الجلسة القادمة**.
  - **«تخطّي نهائياً»** → `status="skipped"`، لا تعود تلقائياً (تبقى متاحة يدوياً من الإعدادات).
- زر «إعادة الجولة» في `/settings` لتشغيلها يدوياً في أي وقت (`resetTour`).

### 2.6 الحركة وإمكانية الوصول

- كل الانتقالات ≤250ms، احترام `prefers-reduced-motion` (تعطيل spotlight animation).
- التنقّل بلوحة المفاتيح: Esc = تخطّي، Enter/→ = التالي. تركيز (focus trap) داخل الـpopover.
- ARIA: `role="dialog"`, `aria-live` للنسبة، تباين ألوان كافٍ.
- z-index أعلى من الـdrawer/modals الحالية؛ منع scroll الخلفية أثناء الترحيب.

### 2.7 الثغرات التقنية (Edge Cases) وحلولها — إلزامية في المراحل ج/د

#### أ) عناصر DOM غير جاهزة (Async / Dynamic Elements)
- **المشكلة**: خطوة تستهدف `data-tour="inbox-table"` لكن الجدول ينتظر ~1.5s جلب API →
  المحرّك لا يجد العنصر فيتخطّى أو ينهار.
- **الحل** (داخل `useTourTarget`): آلية انتظار عبر **`MutationObserver`** (أو polling بفاصل ~100ms)
  بمهلة قصوى **~3 ثوانٍ** لظهور العنصر. أثناء الانتظار يعرض الـPopover **Skeleton/Spinner** بسيط
  («جارٍ التحضير...»). بعد المهلة: تدرّج لطيف — إمّا **تخطّي الخطوة تلقائياً** إلى التالية أو
  عرض «لم نتمكّن من عرض هذه الخطوة» بلا انهيار الجولة. يُلغى الـobserver عند التفكيك/تغيّر الخطوة.

#### ب) صمود التنقّل (Navigation Resilience)
- **المشكلة**: في خطوة تفاعلية (مثلاً `/marketplace`) ينقر المستخدم رابطاً آخر أو زر «رجوع» بالمتصفح.
- **الحل**: `expectedRoute` في الستور لكل خطوة. `OnboardingProvider` يراقب `useLocation`؛
  إن اختلف المسار الحالي عن `expectedRoute` **لا نُنهي الجولة**، بل نعرض **Toast عائم لطيف**:
  «يبدو أنك ابتعدت عن الجولة! [العودة للخطوة الحالية]» — الزر يستدعي `resumeFromNav()` فيعيد التوجيه
  للمسار المتوقّع ويستأنف من نفس الخطوة. لا احتساب فشل، لا فقدان تقدّم.

#### ج) معضلة الـStacking Context (Z-Index + Overflow/Transform)
- **المشكلة**: الـSpotlight (box-shadow ضخم أو clip-path) يُقتَص إذا كان الهدف داخل حاوية
  `overflow:hidden` أو `transform` (وهو شائع في الكروت والـsidebar).
- **الحل**: `<Spotlight/>` و`<TourPopover/>`/`<TourBottomSheet/>` تُرندَر عبر **`createPortal`
  إلى `document.body` مباشرة**، وتعتمد **حصراً** على إحداثيات مطلقة من `getBoundingClientRect()`
  للهدف — لا على موضعها داخل شجرة الـDOM. تُعاد قراءة الإحداثيات عند `scroll`/`resize` (مع rAF throttle)
  وعند تغيّر الخطوة. هذا يضمن أيضاً z-index موحّد فوق كل الحاويات.

---

## 3. بنية الملفات المقترحة

```
frontend/src/
├── stores/
│   └── onboardingStore.ts                 # حالة + persist
├── constants/
│   └── onboardingSteps.ts                 # تعريف خطوات كل دور (data-tour ids + routes + نصوص keys)
├── components/onboarding/
│   ├── OnboardingProvider.tsx             # يُحقن في AppLayout — يقرّر ماذا يُعرض
│   ├── WelcomeCarousel.tsx                # موزّع ديسكتوب/موبايل (useMediaQuery)
│   ├── WelcomeCarouselDesktop.tsx
│   ├── WelcomeCarouselMobile.tsx
│   ├── GuidedTour.tsx                      # محرّك الجولة (يقرأ onboardingSteps)
│   ├── Spotlight.tsx                       # overlay + ثقب — createPortal إلى body، إحداثيات مطلقة (§2.7-ج)
│   ├── TourPopover.tsx                     # بطاقة الشرح ديسكتوب — Portal + Skeleton أثناء انتظار الهدف
│   ├── TourBottomSheet.tsx                 # بطاقة الشرح موبايل — Portal
│   ├── NavGuardToast.tsx                   # تنبيه «ابتعدت عن الجولة» + resume (§2.7-ب)
│   ├── ProgressTracker.tsx                 # الشريط/الدائرة مع حيلة الـ25%
│   └── __tests__/…
├── hooks/
│   └── useTourTarget.ts                    # data-tour id → rect حيّ + MutationObserver/polling بمهلة 3s (§2.7-أ)
└── locales/{ar,en,zh}/common.json         # مفتاح onboarding.* جديد للنصوص
```
+ إضافة `data-tour="..."` على العناصر الحقيقية في Sidebar/BottomNav/الداشبوردات/CTAs.
+ **backend (أساسي — §2.2.1)**: migration `onboarding_status` + `onboarding_completed_at` + تعديل `auth` schema/route (GET/PATCH me).

---

## 4. قائمة المهام (Tasks)

> الترتيب تدرّجي؛ كل مهمة قابلة للتسليم والاختبار وحدها. **لا تبدأ حتى يُطلب.**

### المرحلة أ — الأساس (State + Content + Backend)
- [ ] **T1** — إنشاء `onboardingStore.ts` (zustand + persist per-user) مع كل الـactions (بما فيها `snooze`/`skipForever`/`resumeFromNav`) + `status` و`expectedRoute` + الاختبارات.
- [ ] **T2** — إنشاء `constants/onboardingSteps.ts`: خطوات Agent وClient (ids, `route`/`expectedRoute`, نصوص keys, نوع الفعل التجريبي وشرط اجتيازه المتساهل).
- [ ] **T3** — إضافة مفاتيح `onboarding.*` في `locales/ar|en|zh/common.json` (عربي أولاً، ثم en/zh).
- [ ] **T3b** — **backend (أساسي)**: migration `onboarding_status` + `onboarding_completed_at` على `User`، تحديث `auth` schema، وGET/PATCH `/auth/me` لقراءة/كتابة الحالة.

### المرحلة ب — سلايدات الترحيب
- [ ] **T4** — `WelcomeCarousel` (ديسكتوب + موبايل + موزّع) مع «تخطّي نهائياً» + «ذكّرني لاحقاً» + قلب + ألوان الدور + حركة ≤250ms.
- [ ] **T5** — ربط الترحيب بنقطة التشغيل: `OnboardingProvider` داخل `AppLayout`، منطق «أول دخول» + إعادة تشغيل `snoozed` في الجلسة الجديدة + مزامنة الحالة مع `/auth/me`.

### المرحلة ج — محرّك الجولة الموجّهة
- [ ] **T6** — `useTourTarget` + `Spotlight`: ثقب RTL-safe، **createPortal إلى body وإحداثيات مطلقة** (§2.7-ج)، تتبّع scroll/resize (rAF throttle)، **MutationObserver/polling بمهلة 3s للعناصر غير الجاهزة** (§2.7-أ)، احترام reduced-motion.
- [ ] **T7** — `TourPopover` (ديسكتوب) + `TourBottomSheet` (موبايل) عبر Portal، مع **Skeleton أثناء انتظار الهدف**، أزرار التالي/«ذكّرني لاحقاً»/«تخطّي نهائياً»/«تخطّي هذه الخطوة» + a11y (focus trap, Esc/Enter/→).
- [ ] **T8** — `ProgressTracker` مع حيلة البداية ~25% (خطوتان وهميتان) + bounce عند الإنجاز.
- [ ] **T9** — `GuidedTour` يربط كل ما سبق: تسلسل الخطوات، الانتقال بين المسارات، احتساب الخطوة عند الفعل التجريبي.
- [ ] **T9b** — **Navigation Resilience** (§2.7-ب): مراقبة `useLocation` مقابل `expectedRoute` + `NavGuardToast` «ابتعدت عن الجولة» مع زر العودة (`resumeFromNav`)، بلا إنهاء الجولة.

### المرحلة د — الربط بالعناصر الحقيقية
- [ ] **T10** — إضافة `data-tour="..."` على عناصر Sidebar/BottomNav/الداشبوردات وCTAs المستهدفة (Agent + Client).
- [ ] **T11** — منطق «الفعل التجريبي المتساهل»: اجتياز الخطوة بأخفّ فعل (فتح متصفّح الملفات / فتح نموذج RFQ / إدخال قيمة بالحاسبة) → `completeStep`، مع زر «تخطّي هذه الخطوة».

### المرحلة هـ — الإنهاء والتحكّم
- [ ] **T12** — بطاقة الإنهاء «أتممت الجولة 🎉» + ضبط `status="completed"` (+ PATCH backend) + عدم التكرار.
- [ ] **T13** — زر «إعادة الجولة» في `/settings` (`resetTour`).

### المرحلة و — الجودة
- [ ] **T14** — اختبارات وحدة (store مع snooze/skip/resume، steps resolver، ProgressTracker) + اختبار تكامل لتدفّق الجولة + سيناريوهات §2.7 (عنصر متأخّر، تنقّل خاطئ، overflow container).
- [ ] **T15** — مراجعة a11y/RTL/reduced-motion + التزام الألوان (supplier/importer/brand، لا indigo) + التحقق على موبايل حقيقي.
- [ ] **T16** — (اختياري) جولة الأدمن المختصرة.

---

## 5. مخاطر ونقاط انتباه

- **تموضع الـSpotlight مع RTL + scroll + overflow/transform containers**: أكبر خطر تقني — يُعالَج في T6 بـ`getBoundingClientRect` حيّ + **Portal إلى body وإحداثيات مطلقة** (§2.7-ج).
- **عناصر تحتاج API قبل الظهور**: انتظار عبر MutationObserver بمهلة 3s + Skeleton (§2.7-أ) — لا انهيار ولا تخطٍّ صامت.
- **ضياع المستخدم بالتنقّل/زر الرجوع**: `expectedRoute` + Toast «العودة للخطوة الحالية» (§2.7-ب) — الحالة في store عالمي تنجو من تغيّر المسار.
- **المستخدم المستعجل**: «ذكّرني لاحقاً» (snooze) بدل إجبار على إكمال أو تخطٍّ نهائي.
- **عدم إزعاج المستخدم العائد عبر الأجهزة**: الحالة في الـbackend (§2.2.1) هي مصدر الحقيقة، وlocalStorage cache فقط.
- **الترجمة**: كل نص عبر i18n منذ البداية، لا نصوص عربية مضمّنة في JSX.
- **الالتزام بنمط الملفين**: لا `hidden lg:block` — ملفات ديسكتوب/موبايل منفصلة للطبقات المرئية.

---

## 6. تعريف "منجز" (Definition of Done)

- مستخدم Agent وClient جديد يرى الترحيب مرة واحدة، يمرّ بجولة تلمس ≥5 مزايا، يجرّب فعلياً ≥2 خدمة.
- الـProgress يبدأ ظاهرياً عند ~25% وينتهي 100% مع بهجة خفيفة.
- يعمل RTL + عربي، ديسكتوب وموبايل، مع reduced-motion وkeyboard.
- لا يتكرّر بعد الإتمام؛ قابل لإعادة التشغيل من الإعدادات.
- التزام كامل بألوان وقواعد CLAUDE.md.
