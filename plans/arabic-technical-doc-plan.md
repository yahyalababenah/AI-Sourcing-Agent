# خطة التوثيق الفني الكامل باللغة العربية - AI-Sourcing Hub

## هيكل الوثيقة المقترح

### القسم الأول: نظرة عامة على المشروع
- المهمة والرؤية
- الميزة الرئيسية (Zero-Touch Quotation)
- المستخدمون المستهدفون
- سير العمل الأساسي (مخطط Mermaid)

### القسم الثاني: بنية النظام العامة (System Architecture)
- نمط الـ Modular Monolith
- مخطط معماري شامل (Mermaid)
- شرح طبقات الـ Middleware
- شرح الوحدات الخمس (Auth, Intake, Documents, Pricing, Output)
- الخدمات المساعدة (PostgreSQL, Redis, Celery, MinIO, ChromaDB)

### القسم الثالث: مجموعة التقنيات المستخدمة (Technology Stack)
جدول كامل بجميع التقنيات مع سبب اختيار كل منها

### القسم الرابع: وحدة المصادقة (Auth Module)
- JWT Authentication (Access + Refresh Tokens)
- التخزين الآمن لكلمات المرور (bcrypt)
- أدوار المستخدمين (admin, agent, client)
- تسجيل الخروج و blacklisting
- Middleware الأمان والـ Rate Limiting

### القسم الخامس: وحدة الاستعلامات والترجمة (Intake Module)
- استخراج الكيانات من النص العربي
- الترجمة إلى الصينية التجارية
- دورة حياة RFQ (Open → Processing → Quoted → Closed/Cancelled)
- إدارة المنتجات
- LLM Client مع Retry Logic

### القسم السادس: وحدة المستندات والمعالجة (Documents Module)
- رفع الملفات إلى MinIO
- معالجة PDF غير متزامنة عبر Celery
- استخراج البيانات باستخدام Vision LLM
- إصلاح JSON التالف
- Human-in-the-Loop للتحقق من البيانات

### القسم السابع: محرك التسعير (Pricing Module)
- خوارزمية الـ Landed Cost (9 خطوات)
- أسعار الصرف الحية
- الشحن والتخليص والجمارك والعمولات
- خصومات MOQ
- التخزين المؤقت للأسعار في Redis

### القسم الثامن: وحدة إنشاء عروض الأسعار (Output Module)
- إنشاء عروض الأسعار
- توليد PDF باستخدام WeasyPrint + Jinja2
- دعم اللغة العربية والـ RTL في PDF
- التخزين في MinIO مع روابط مؤقتة

### القسم التاسع: قاعدة البيانات (Database Schema)
- مخطط ERD (Mermaid)
- شرح الجداول الثمانية
- العلاقات بين الجداول
- الـ PostgreSQL Enums

### القسم العاشر: الواجهة الأمامية (Frontend)
- React 18 + TypeScript + Vite
- TanStack React Query
- إدارة الحالة باستخدام Zustand
- الـ JWT Interceptor في Axios
- دعم العربية و RTL (TailwindCSS)
- shadcn/ui للمكونات

### القسم الحادي عشر: النشر والبنية التحتية (Deployment)
- Docker Compose (7 خدمات)
- Dockerfile متعدد المراحل
- Nginx كوكيل عكسي في الإنتاج
- Railway deployment
- إدارة المتغيرات البيئية

### القسم الثاني عشر: الأمان والمراقبة (Security & Monitoring)
- Prometheus Metrics
- Sentry Error Tracking
- السجلات والتدقيق (Audit Logging)
- Security Headers
- Rate Limiting

### القسم الثالث عشر: الـ CI/CD Pipeline
- GitHub Actions workflow
- اختبارات pytest
- التحقق من الجودة

### القسم الرابع عشر: الاقتراحات المستقبلية (Future Roadmap)
1. **تطوير محرك التسعير بالتعلم الآلي** - إضافة XGBoost للتنبؤ بالأسعار
2. **التكامل مع WhatsApp Business API** - لاستقبال طلبات العملاء مباشرة
3. **نظام RAG متقدم** - مطابقة تلقائية بين الطلبات السابقة وعروض الموردين
4. **تطبيق جوال** - React Native للعملاء والوكلاء
5. **تعدد اللغات** - إضافة التركية والفارسية والأوردو
6. **منصة موردين** - بوابة للموردين الصينيين لتقديم عروضهم مباشرة
7. **لوحة تحليل متقدمة** - تحليلات ذكاء اصطناعي للاتجاهات والأسعار
8. **Blockchain للعقود** - عقود ذكية لتوثيق الصفقات
9. **API عام** - فتح API للمطورين والشركاء
10. **التكامل مع خدمات الشحن** - ربط مباشر مع شركات الشحن للتتبع

---

## هيكل ملف التوثيق النهائي

```
plans/ai-sourcing-hub-arabic-technical-documentation.md
```
