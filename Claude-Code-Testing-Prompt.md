# برومبت شامل لـ Claude Code — بناء خطة اختبارات كاملة لمنصة AI-Sourcing Hub

> انسخ المحتوى بالكامل بين الخطين أدناه والصقه في Claude Code داخل مجلد المشروع مباشرة.

---

## البرومبت (ابدأ النسخ من هنا)

```
أنت الآن تعمل داخل مشروع "AI-Sourcing Hub" — منصة B2B Sourcing عامة (Python 3.12
+ FastAPI Modular Monolith / React 18 + TypeScript + Vite / PostgreSQL + SQLAlchemy
async / Alembic / Redis / Celery + Celery Beat / MinIO / PaddleOCR PP-Structure /
Prometheus + Sentry + Grafana + Flower). الواجهة عربية RTL بالكامل.

مهمتك: افحص الكود الفعلي أولاً (لا تعتمد على أي وثائق قديمة)، ثم ابنِ منظومة اختبارات
شاملة عبر أربع طبقات: Backend، Frontend، تكامل Frontend↔Backend في بيئة تحاكي
الإنتاج، واختبارات واجهة المستخدم/دورة حياة المستخدم. اعمل بالترتيب التالي بالضبط
ولا تنتقل لمرحلة قبل إكمال التي قبلها.

===========================================================
المرحلة 0 — الاستكشاف (لا تكتب أي كود اختبار في هذه المرحلة)
===========================================================
1. اعرض بنية المشروع الكاملة (backend + frontend) عبر شجرة ملفات.
2. اقرأ app/main.py وأدرج كل الراوترات المسجّلة فعلياً مع مساراتها.
3. افحص app/modules/intake/matcher.py وافهم منطق المطابقة الحصرية (3 ساعات) ثم العامة.
4. افحص آلية الـ SSE في notifications و chat (الباك إند والفرونت hooks
   useNotifications.ts و useRoomSSE.ts).
5. افحص آلية الـ JWT وtoken blacklist (Redis jti + session invalidation).
6. افحص هل توجد فعلياً مهمة Celery Beat مجدولة تُنفّذ الانتقال من "حصري" إلى "عام"
   بعد انتهاء exclusive_deadline — هذه نقطة غير مؤكدة ويجب حسمها بالكود لا بالتخمين.
7. افحص جدول rfqs وتأكد من غياب/وجود catalog_product_id (foreign key نحو
   CatalogProduct) — وثّق الفجوة إن وُجدت.
8. افحص صفحة settings في الفرونت إند وحدد إن كانت stub فعلاً بدون ربط بيانات.
9. اكتب ملخصاً من 15-20 سطراً بما اكتشفته قبل المتابعة، واطلب مني تأكيداً إن وجدت
   أي تعارض جوهري مع الوصف أعلاه.

===========================================================
المرحلة 1 — إعداد البنية التحتية للاختبارات (Test Infrastructure)
===========================================================
Backend:
- تأكد من وجود pytest + pytest-asyncio + httpx (AsyncClient) + pytest-cov.
- أنشئ conftest.py بقاعدة بيانات اختبار منعزلة (test DB أو SQLite in-memory عبر
  aiosqlite إن كان متوافقاً، وإلا استخدم PostgreSQL test container عبر testcontainers).
- أنشئ fixtures لكل دور (customer, rep, supplier, admin) بتوكنات JWT صالحة.
- أنشئ fixture لـ Redis وCelery في وضع eager (task_always_eager=True) للاختبارات
  التي لا تحتاج تنفيذاً حقيقياً غير متزامن، وfixture منفصل لاختبارات Celery الحقيقية.
- أنشئ factories (factory_boy أو fixtures يدوية) لـ RFQ، Product، CatalogProduct،
  User، Quote.

Frontend:
- تأكد من وجود Vitest أو Jest + @testing-library/react + @testing-library/user-event.
- أنشئ mock لـ EventSource قابل لإطلاق أحداث SSE يدوياً في الاختبارات.
- أنشئ MSW (Mock Service Worker) handlers لكل endpoint رئيسي.

E2E:
- ثبّت Playwright (مفضّل على Cypress هنا بسبب دعمه الأفضل لـ SSE ومتعدد التبويبات).
- أنشئ playwright.config.ts ببيئتين: staging محلية عبر docker-compose، وبيئة تحاكي
  الإنتاج إن وُجد رابط staging حقيقي.
- أنشئ ملف docker-compose.test.yml يشغّل: backend, frontend, postgres, redis,
  minio, celery worker, celery beat — كلها معزولة عن بيانات التطوير.

===========================================================
المرحلة 2 — اختبارات الـ Backend
===========================================================
اكتب الملفات التالية تحت backend/tests/ بنيوياً (unit/ ثم integration/ ثم load/
ثم security/):

unit/
  test_pricing_engine.py         → حساب التكلفة الكاملة لكل فئة منتج (10 فئات)،
                                    بما فيها حالات حدّية: سعر صفر، وزن سالب، عملة
                                    غير مدعومة.
  test_matcher_logic.py          → استخراج الفئة من الكيانات، مطابقة مباشرة
                                    بالكتالوج، مطابقة عبر تداخل ملف تعريف المورد،
                                    حالة عدم وجود أي مورد مطابق.
  test_jwt_auth.py               → إصدار/تجديد/انتهاء صلاحية التوكن، صلاحيات كل دور.
  test_token_blacklist.py        → إبطال refresh عبر jti في Redis، إبطال access
                                    عبر مقارنة توقيت الإصدار بتوقيت آخر logout.
  test_currency_conversion.py    → تحديث سعر الصرف وتطبيقه على حسابات قائمة.
  test_ocr_extraction_parsing.py → تحليل مخرجات PaddleOCR وتحويلها لعناصر منظمة
                                    (استخدم fixture بمخرجات OCR حقيقية مُسجّلة مسبقاً،
                                    لا تشغّل OCR فعلياً في اختبار الوحدة).

integration/
  test_intake_router.py          → دورة كاملة: إنشاء RFQ → ترجمة → تشغيل مطابقة →
                                    صندوق مطابقات المورد → البوابة العامة → استيراد دفعي.
  test_documents_pipeline.py     → رفع مستند حقيقي إلى MinIO (test bucket) → تشغيل
                                    OCR → التحقق من العناصر المستخرجة في DB.
  test_exclusive_window_expiry.py → **أولوية قصوى**: أنشئ RFQ بـ exclusive_deadline
                                    في الماضي، شغّل مهمة Celery Beat يدوياً (أو
                                    استدعِ الدالة المجدولة مباشرة)، وتحقق أن is_public
                                    أصبح True فعلاً دون تدخل يدوي. إن لم توجد هذه
                                    المهمة في الكود، أنشئها الآن كجزء من هذا الاختبار
                                    (test-driven) وأبلغني بذلك صراحة.
  test_review_status_gate.py     → التحقق أن /api/v1/catalog/search لا يُرجع إلا
                                    منتجات review_status == approved، واختبار مسار
                                    الموافقة/الرفض من صفحة المراجعة.
  test_sse_notifications.py      → استخدم httpx-sse أو اتصال streaming حقيقي،
                                    أطلق حدث new_rfq وquote_ready وتحقق من استلامها.
  test_chat_sse_multiuser.py     → افتح اتصالين SSE لمستخدمين مختلفين بنفس الغرفة
                                    وتحقق من استلام كليهما للرسالة نفسها.
  test_celery_pdf_generation.py  → توليد PDF غير متزامن لعرض سعر والتحقق من اكتمال
                                    المهمة وصحة الملف الناتج في MinIO.
  test_rfq_catalog_fk_gap.py     → اختبار يوثّق صراحة الفجوة التصميمية (غياب
                                    catalog_product_id في جدول rfqs)، عبر محاولة
                                    استرجاع منتج الكتالوج الدقيق من RFQ والتحقق من
                                    نسبة الغموض/الالتباس عند وجود أكثر من تطابق محتمل.
  test_db_migrations_up_down.py  → alembic upgrade head ثم alembic downgrade base
                                    ثم upgrade head مجدداً دون أخطاء، على قاعدة فارغة.

load/
  locustfile_pricing.py          → حمل متزامن على /api/v1/pricing/quick-estimate.
  locustfile_sse_channels.py     → عدد اتصالات SSE المتزامنة القصوى قبل تدهور الأداء.
  test_celery_queue_backpressure.py → إغراق طابور OCR بعدد كبير من المهام ومراقبة
                                    زمن المعالجة والذاكرة.

security/
  test_rbac_boundaries.py        → لكل endpoint حساس، تحقق أن كل دور غير مخوَّل
                                    يحصل على 403/401 (مصفوفة كاملة: كل endpoint ×
                                    كل دور).
  test_sql_injection.py          → حقن نصوص خبيثة في كل حقل نصي في intake/documents.
  test_csp_and_security_headers.py → تحقق من رؤوس الأمان الحالية، ووثّق أن
                                    unsafe-inline لا يزال مستخدماً إن كان كذلك.
  test_minio_signed_url_expiry.py → تحقق أن روابط الملفات المؤقتة تنتهي فعلياً.

بعد كل ملف، شغّل pytest --cov وتأكد من تغطية لا تقل عن 80% للموديولات الجوهرية
(pricing, matcher, auth). لا تنتقل لملف تالٍ قبل أن يمر الحالي بنجاح.

===========================================================
المرحلة 3 — اختبارات الـ Frontend
===========================================================
تحت frontend/src/**/__tests__/ أو frontend/tests/unit/:

- PricingCalculator.test.tsx      → إدخال قيم، تحقق من النتيجة المعروضة، حالات خطأ.
- RFQForm.test.tsx                → validation، إرسال، حالة تحميل، حالة فشل الشبكة.
- useNotifications.test.ts        → mock لـ EventSource، تحقق من تحديث الحالة عند
                                     استقبال new_rfq وquote_ready، وسلوك إعادة الاتصال
                                     عند انقطاع الاتصال.
- useRoomSSE.test.ts               → نفس الفكرة لغرفة الدردشة.
- AuthTabs.test.tsx                → التبديل بين تبويبات (عميل/مندوب/مورد) ودخول الأدمن.
- ProductReviewPage.test.tsx       → أزرار الموافقة/الرفض وتحديث القائمة بعدها.
- CatalogSearch.test.tsx           → البحث والفلترة والتقدير السريع.
- SettingsPage.test.tsx            → **مهم**: اختبار يوثّق صراحة أن الصفحة stub حالياً
                                     (يفشل عمداً أو يُعلَّم كـ TODO حتى تُستكمل الصفحة،
                                     ليكون تذكيراً دائماً في CI).

اختبارات بصرية:
- أعدّ إعداد Storybook + Chromatic (أو Percy) لأهم 10 مكوّنات، مع تركيز خاص على
  التخطيط RTL (تحقق يدوي أن لا عناصر مقلوبة أو محاذاة خاطئة).

===========================================================
المرحلة 4 — اختبارات E2E (تكامل Frontend↔Backend في بيئة تحاكي الإنتاج)
===========================================================
تحت e2e/tests/ باستخدام Playwright، وشغّلها فقط ضد docker-compose.test.yml
(بيئة كاملة حقيقية، لا mocks):

- e2e_full_customer_journey.spec.ts:
  رفع كتالوج → OCR → مراجعة بشرية (بمستخدم مندوب) → ظهور في السوق العام
  (بمستخدم عميل) → طلب RFQ → مطابقة حصرية → إشعار SSE فوري (تحقق فعلي من
  ظهور toast/badge دون refresh) → توليد PDF → قبول العميل → تتبع الشحنة.

- e2e_exclusive_to_public_transition.spec.ts:
  أنشئ RFQ، تحقق أنه يظهر فقط للموردين المطابقين، تلاعب بالوقت (freeze/travel
  عبر Playwright clock API أو عبر تعديل exclusive_deadline مباشرة بقاعدة البيانات)،
  شغّل Celery Beat، تحقق أن الطلب أصبح مرئياً بالبوابة العامة فعلياً في الواجهة.

- e2e_live_chat_two_tabs.spec.ts:
  افتح تبويبين بمستخدمين مختلفين (context منفصل لكل منهما في Playwright)، أرسل
  رسالة من الأول، تحقق من ظهورها في الثاني خلال أقل من ثانيتين دون polling يدوي.

- e2e_auth_full_cycle.spec.ts:
  دخول لكل الأدوار الأربعة، تسجيل خروج، ثم محاولة استخدام access token القديم
  يدوياً (عبر API مباشرة) والتحقق أنه يُرفض فعلياً — هذا يختبر session invalidation
  الحقيقي وليس فقط حذف التوكن من الفرونت.

- e2e_quote_pdf_download.spec.ts:
  من حاسبة التسعير إلى بناء عرض سعر إلى تحميل PDF فعلي والتحقق من محتواه
  (رقم العرض، السعر الإجمالي).

- contract/pact_frontend_backend.spec.ts:
  استخدم Pact أو schemathesis لتوليد اختبارات عقد تلقائية من OpenAPI schema
  الخاص بـ FastAPI (/openapi.json)، وتحقق أن كل استجابة تطابق الـ schema المُعلن.

- synthetic/synthetic_health_check.ts:
  فحص دوري (قابل للجدولة عبر cron خارج هذا المستودع) لـ /health و/metrics،
  يتحقق من DB + Redis + MinIO + Celery + LLM كلها معاً.

- synthetic/synthetic_sse_uptime.ts:
  فتح اتصال SSE طويل الأمد (10+ دقائق) والتحقق من عدم انقطاعه، خاصة بعد أي
  إعادة نشر محاكاة (rolling restart في docker-compose).

===========================================================
المرحلة 5 — اختبارات واجهة المستخدم ودورة حياة المستخدم
===========================================================
تحت e2e/tests/lifecycle/:

- lifecycle_customer.spec.ts   → تسجيل → RFQ → استلام عرض → قبول → تتبع → (إن
                                  وُجد) تقييم المورد.
- lifecycle_supplier.spec.ts   → تسجيل → انتظار تحقق الأدمن → إضافة منتجات →
                                  مراجعة بشرية → ظهور بالسوق → استلام مطابقة
                                  حصرية → رد خلال/بعد مهلة 3 ساعات (سيناريوهين).
- lifecycle_rep.spec.ts        → استلام RFQ → مراجعة → إضافة شحن → توليد عرض
                                  → متابعة الحالة حتى القبول.
- lifecycle_admin.spec.ts      → مراقبة صحة النظام → إدارة مستخدمين → التحقق من
                                  موردين → مراجعة إحصائيات تكلفة الـ AI.

اختبارات إمكانية الوصول:
- a11y_scan.spec.ts لكل صفحة رئيسية عبر axe-core، مع تركيز خاص على قارئات
  الشاشة العربية واتجاه RTL.

اختبارات الاستجابة والأجهزة:
- responsive_admin_dashboard.spec.ts على viewport للموبايل والتابلت.
- chat_slow_network.spec.ts عبر Playwright network throttling (Slow 3G) للتأكد
  أن SSE لا ينهار ويعيد الاتصال بسلاسة.

اختبارات الحالات الحدّية بالواجهة:
- ui_no_match_found.spec.ts    → سلوك واجهة العميل عند عدم مطابقة RFQ بأي مورد.
- ui_settings_stub_warning.spec.ts → تأكيد أن الصفحة لا تُعرض كصفحة معطوبة
                                  (حتى لو كانت فارغة، يجب أن تحمل رسالة "قريباً"
                                  وليس شاشة بيضاء أو خطأ في الكونسول).

===========================================================
قواعد عامة يجب اتباعها طوال العمل
===========================================================
1. لا تفترض سلوك أي جزء من الكود — افحصه دائماً قبل كتابة الاختبار.
2. أي فجوة تكتشفها أثناء الاختبار (مثل غياب مهمة Celery Beat أو غياب FK) وثّقها
   في ملف TESTING_FINDINGS.md بدلاً من إخفائها أو "إصلاحها بصمت" دون إخباري.
3. اكتب كل ملف اختبار، شغّله، أصلح ما يفشل بسبب خطأ باختبارك أنت (لا تُسكت فشلاً
   حقيقياً في الكود عبر تعديل الاختبار ليتوافق مع خطأ).
4. بعد كل مرحلة (0 إلى 5)، أعطني ملخصاً موجزاً: عدد الاختبارات المكتوبة، عدد
   الناجح/الفاشل، وأي فجوات مكتشفة، قبل الانتقال للمرحلة التالية.
5. أنشئ في النهاية ملف CI (GitHub Actions أو ما يناسب المستودع) يشغّل: unit تلقائياً
   على كل push، integration + security على كل PR، وE2E الكامل على جدولة ليلية
   أو قبل أي نشر إلى production.
6. أنشئ ملف TEST_COVERAGE_SUMMARY.md في النهاية يلخّص كل الاختبارات المكتوبة
   مصنّفة حسب الطبقة (Backend/Frontend/E2E/Lifecycle) مع حالة كل واحد ونسبة
   التغطية.

ابدأ الآن بالمرحلة 0 فقط، ولا تكتب أي كود اختبار قبل أن أراجع ملخص الاستكشاف
وأؤكد لك المتابعة.
```

---

## ملاحظات استخدام سريعة

- **قسّم التنفيذ**: البرومبت مصمَّم ليتوقف Claude Code بعد كل مرحلة وينتظر تأكيدك — هذا مقصود لتفادي أن يبني آلاف الأسطر على افتراض خاطئ.
- **المرحلة 0 هي الأهم**: لا تسمح لـ Claude Code بتجاوزها. أي اختبار مبني على افتراض غير مُتحقَّق منه من الكود الفعلي سيكون مضلِّلاً.
- **`test_exclusive_window_expiry.py`** و**`test_rfq_catalog_fk_gap.py`** مُعلَّمان صراحة كأولوية لأنهما يطابقان الفجوتين الحقيقيتين المذكورتين في تقرير حالة المشروع.
- يمكنك حذف قسم "اختبارات الحمل" (Load) إن لم تكن جاهزاً بعد للبنية التحتية الخاصة بها (Locust يحتاج بيئة موارد كافية).
