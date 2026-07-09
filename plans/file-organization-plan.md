# خطة تنظيم ملفات المشروع

## الهيكل الجديد

```
📦 ai-sourcing-hub/
├── 📁 docs/                          # 📚 التوثيق الرسمي للمشروع
│   ├── 📁 architecture/              # توثيق المعمارية والتصميم
│   │   ├── arabic-technical-doc.md   # التوثيق الفني الشامل (جديد)
│   │   └── ... (ملفات معمارية أخرى)
│   │
│   ├── 📁 deployment/                # توثيق النشر والاستضافة
│   │   ├── DEPLOY_RAILWAY.md         # نشر على Railway
│   │   ├── deployment.md             # دليل النشر العام
│   │   ├── hf-README.md              # نشر على Hugging Face Spaces
│   │   └── hf-spaces-env.md          # متغيرات بيئة HF Spaces
│   │
│   ├── 📁 reports/                   # تقارير المشروع
│   │   ├── LIFECYCLE_REPORT.md       # تقرير دورة حياة المشروع
│   │   ├── PROJECT_STATUS.md         # حالة المشروع
│   │   ├── PROJECT_STATUS_REPORT.md  # تقرير حالة المشروع
│   │   ├── PRODUCTION_READINESS.md   # جاهزية الإنتاج
│   │   ├── TEST_COVERAGE_SUMMARY.md  # ملخص تغطية الاختبارات
│   │   ├── TESTING_FINDINGS.md       # نتائج الاختبارات
│   │   ├── PLAN.md                   # خطة المشروع الرئيسية
│   │   └── tariff-report.xlsx        # تقرير التعريفات الجمركية
│   │
│   ├── 📁 prd/                       # متطلبات المنتج (PRD)
│   │   ├── ai-sourcing-agent-notion.md
│   │   └── AI-Sourcing Hub Master PRD & Wiki/    # مجلد PRD الكامل
│   │
│   └── 📁 handoff/                   # ملفات التسليم
│       ├── handoff/                  # مجلد handoff الحالي
│       └── handoff-designs/          # مجلد التصاميم
│
├── 📁 archive/                       # 🗄️ ملفات قديمة/تجريبية/مرجعية
│   ├── 📁 experimental/              # ملفات تجريبية لم تعد مستخدمة
│   │   ├── gemini-code-1780390634144.md
│   │   ├── landed_cost_calculator.jsx
│   │   ├── e2e_audit.py
│   │   └── lib/tokens.ts            # مكتبة tokens المنفردة في الجذر
│   │
│   ├── 📁 exports/                   # تصديرات من أدوات خارجية
│   │   ├── plan-ai-sourcing-hub-2026.json
│   │   └── ExportBlock-.../         # تصدير Notion
│   │
│   └── 📁 old-plans/                 # خطط سابقة (مرجعية)
│       ├── ai-sourcing-hub-implementation-roadmap.md
│       ├── ai-sourcing-hub-tech-doc-review.md
│       ├── ai-sourcing-hub-technical-documentation-v1.1.md
│       ├── ai-sourcing-hub-technical-documentation.md
│       ├── b2b-marketplace-auth-refactor.md
│       ├── bug-remediation-plan.md
│       ├── course-correction-todo.md
│       ├── current-project-status.md
│       ├── deployment-preparation-plan.md
│       ├── enterprise-saas-refactoring-plan.md
│       ├── frontend-architecture-plan.md
│       ├── missing-features-plan.md
│       ├── next-steps-plan.md
│       ├── paddleocr-replacement-plan.md
│       ├── project-drift-analysis.md
│       ├── task2-filters-sidebar-catalog-query-params.md
│       ├── task3-supplier-rfq-inbox.md
│       ├── task4-catalog-database-indexes.md
│       ├── task5-order-tracking.md
│       └── user-workflow-documentation.md
│
├── 📁 plans/                         # 📋 الخطط النشطة (تبقى كما هي)
│   ├── arabic-technical-doc-plan.md  # خطة التوثيق العربي
│   └── file-organization-plan.md     # هذه الخطة
│
├── ... (بقية ملفات المشروع تبقى في مكانها)
```

## الأوامر التنفيذية المطلوبة

### 1. إنشاء المجلدات
```bash
mkdir -p docs/architecture docs/deployment docs/reports docs/prd docs/handoff archive/experimental archive/exports archive/old-plans
```

### 2. نقل ملفات التوثيق (docs/)
```bash
# deployment
mv DEPLOY_RAILWAY.md docs/deployment/
mv deployment.md docs/deployment/
mv hf-README.md docs/deployment/
mv docs/hf-spaces-env.md docs/deployment/   # من docs/ إلى docs/deployment/

# reports
mv LIFECYCLE_REPORT.md docs/reports/
mv PROJECT_STATUS.md docs/reports/
mv PROJECT_STATUS_REPORT.md docs/reports/
mv PRODUCTION_READINESS.md docs/reports/
mv TEST_COVERAGE_SUMMARY.md docs/reports/
mv TESTING_FINDINGS.md docs/reports/
mv PLAN.md docs/reports/
mv tariff-report.xlsx docs/reports/

# prd
mv ai-sourcing-agent-notion.md docs/prd/
mv AI-Sourcing\ Hub\ Master\ PRD\ \&\ Wiki/ docs/prd/

# handoff
mv handoff/ docs/handoff/handoff/
mv handoff-designs/ docs/handoff/handoff-designs/

# architecture
mv plans/arabic-technical-doc.md docs/architecture/
```

### 3. نقل الملفات التجريبية والقديمة (archive/)
```bash
# experimental
mv gemini-code-1780390634144.md archive/experimental/
mv landed_cost_calculator.jsx archive/experimental/
mv e2e_audit.py archive/experimental/
mv lib/tokens.ts archive/experimental/

# exports
mv plan-ai-sourcing-hub-2026.json archive/exports/
mv ExportBlock-794e909b-055b-4972-a740-bd4b59db2f3e-Part-1/ archive/exports/

# old plans (جميع ملفات الخطط ما عدا النشطة)
cd plans
for f in \
  ai-sourcing-hub-implementation-roadmap.md \
  ai-sourcing-hub-tech-doc-review.md \
  ai-sourcing-hub-technical-documentation-v1.1.md \
  ai-sourcing-hub-technical-documentation.md \
  b2b-marketplace-auth-refactor.md \
  bug-remediation-plan.md \
  course-correction-todo.md \
  current-project-status.md \
  deployment-preparation-plan.md \
  enterprise-saas-refactoring-plan.md \
  frontend-architecture-plan.md \
  missing-features-plan.md \
  next-steps-plan.md \
  paddleocr-replacement-plan.md \
  project-drift-analysis.md \
  task2-filters-sidebar-catalog-query-params.md \
  task3-supplier-rfq-inbox.md \
  task4-catalog-database-indexes.md \
  task5-order-tracking.md \
  user-workflow-documentation.md
do
  mv "$f" ../archive/old-plans/
done
cd ..
```

### 4. تحديث مسار التوثيق العربي
تحديث ملف docs/architecture/arabic-technical-doc.md ليصبح مساره الجديد.

## الملفات التي ستبقى في الجذر (لا تتأثر)

| الملف | السبب |
|-------|-------|
| `.dockerignore`, `.gitignore` | ملفات إعدادات أساسية |
| `.mcp.json` | إعدادات MCP |
| `CLAUDE.md` | تعليمات Claude |
| `alembic.ini` | إعدادات الترحيل |
| `docker-compose.yml`, `*.prod.yml`, `*.test.yml` | البنية التحتية |
| `Dockerfile`, `entrypoint.sh`, `entrypoint.hf.sh` | بناء الحاويات |
| `package.json`, `pyproject.toml`, `requirements.txt` | إدارة التبعيات |
| `railway.json` | إعدادات Railway |
| `README.md` | التوثيق العام |
| `.env.example` | مثال المتغيرات البيئية |
| `.github/` | إعدادات GitHub Actions |
| `.claude/` | إعدادات Claude |
| `nginx/` | إعدادات Nginx |
| `scripts/` | سكريبتات المساعدة |
| `app/`, `frontend/`, `e2e/`, `tests/`, `alembic/` | الكود المصدري |
