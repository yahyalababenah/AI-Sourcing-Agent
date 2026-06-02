# 🏢 AI-Sourcing Agent — Notion Workspace 🚀

Bridge China ↔ Middle East with AI-Powered Sourcing Intelligence

---

# 🏠 1. Main Dashboard — لوحة التحكم الرئيسية

## 🧭 Mission

> *"نسهل التجارة بين الصين والشرق الأوسط بالذكاء الاصطناعي — We bridge China and the Middle East with AI-powered sourcing intelligence."*

## 🎯 Current Objective

Building the MVP — Core pipeline: WhatsApp Arabic NLP → Chinese Translation → PDF Catalog Analysis → Dynamic Quotation

## 🔗 Quick Links

- [Product & Engineering — قسم التطوير التقني والمنتج](#-2-product--engineering--قسم-التطوير-التقني-والمنتج)
- [User Research & Field Testing — قسم الأبحاث الميدانية](#-3-user-research--field-testing--قسم-الأبحاث-الميدانية)
- [Business Development & CRM — قسم المبيعات والعملاء](#-4-business-development--crm--قسم-المبيعات-والعملاء)
- [Financials & Pricing Logic — القسم المالي وتوليد الأسعار](#-5-financials--pricing-logic--القسم-المالي-وتوليد-الأسعار)

## 📈 MVP Progress

- ✅ LLM Provider selected — GPT-4o (Vision) + GPT-4 (Arabic)
- ✅ FastAPI backend scaffolded
- 🔄 Arabic NLP pipeline — In Progress
- ❌ PDF table extraction — Not Started
- ❌ Dynamic Pricing Engine — Not Started

## ⚡ Quick Actions

- [ ] مراجعة آخر تعليقات الميدان — Review latest field feedback
- [ ] تحديث أولويات Sprint — Update sprint priorities
- [ ] متابعة العملاء المتوقعين — Follow up on leads
- [ ] مراجعة قواعد التسعير — Review pricing rules

---

# 🛠️ 2. Product & Engineering — قسم التطوير التقني والمنتج

## 📋 Database: Product Roadmap & Sprints (خارطة الطريق والسباقات)

### View: Kanban Board — Grouped by Status

### Properties

| Property | Type | Options |
|----------|------|---------|
| Task Name | Title | - |
| Tech Layer | Multi-select | AI/LLM · Vision AI · FastAPI · Frontend · Database |
| Priority | Select | P0-Critical · P1-High · P2-Low |
| Assigned to | Person | - |
| Sprint Date | Date | - |
| Status | Select | To Do · In Progress · Testing · Done |
| Related Feedback | Relation → Field Feedback & Interviews | - |
| Dependencies | Relation → Product Roadmap & Sprints | - |

### 🟢 To Do

#### Task 1: WhatsApp Arabic NLP Parsing

- **Tech Layer:** AI/LLM
- **Priority:** P0-Critical
- **Status:** To Do
- **Sprint Date:** Sprint 1 — Week 1-2
- **Description:** Build an NLP pipeline that accepts raw Arabic WhatsApp messages (typos, dialect, no formatting), extracts product intent, quantity, specs, and urgency. Translate structured output to Simplified Chinese for factory communication.
- **Acceptance Criteria:**
  - 85%+ intent accuracy on test WhatsApp dumps
  - Structured JSON output (product, qty, specs, deadline)
  - Arabic→Chinese translation confidence > 80%
  - Response time < 5 seconds per message
- **Dependencies:** None

#### Task 2: PDF Table Extraction using Vision AI

- **Tech Layer:** Vision AI
- **Priority:** P0-Critical
- **Status:** To Do
- **Sprint Date:** Sprint 1 — Week 3-4
- **Description:** Use Vision LLM (GPT-4o) to extract pricing tables, specification sheets, and MOQ details from Chinese factory PDF catalogs. Handle mixed Chinese/English headers, scanned PDFs, and complex table layouts.
- **Acceptance Criteria:**
  - 90%+ cell-level extraction accuracy on clean PDFs
  - 75%+ accuracy on scanned PDFs
  - Output as structured JSON array of rows
  - Fallback to manual correction UI
- **Dependencies:** WhatsApp Arabic NLP Parsing

### 🟡 In Progress

*(Empty — add your first task here)*

### 🧪 Testing

*(Empty — add your first task here)*

### ✅ Done

*(Empty — add your first task here)*

#### Task 3: Dynamic Pricing Engine Rule Creation

- **Tech Layer:** FastAPI
- **Priority:** P1-High
- **Status:** To Do
- **Sprint Date:** Sprint 2 — Week 5-6
- **Description:** Implement a rule-based pricing engine in FastAPI that takes factory FOB price (RMB), applies exchange rate (RMB→USD→local currency), shipping costs, customs %, and agent commission % to output a final all-in price quotation.
- **Acceptance Criteria:**
  - All pricing variables configurable via database
  - Currency conversion with live exchange rate API
  - Quotation generation in under 2 seconds
  - PDF/WhatsApp-formatted output
- **Dependencies:** PDF Table Extraction, Quotation Engine Rules (MVP) database

---

# 🌍 3. User Research & Field Testing — قسم الأبحاث الميدانية

## 📋 Database: Field Feedback & Interviews (التعليقات الميدانية والمقابلات)

### View: Table View

### Properties

| Property | Type | Options |
|----------|------|---------|
| Interviewee Name | Title | - |
| Role | Select | Sourcing Agent in China · Local Middle East Merchant · Shipping Office |
| Core Pain Point | Text | - |
| Stage Causing Delay | Select | Sourcing/Translating · Pricing/Math · Factory Negotiation |
| Feature Idea | Relation → Product Roadmap & Sprints | - |
| Interview Date | Date | - |
| WhatsApp Screenshots | Files & Media | - |
| Urgency | Select | High · Medium · Low |

### Sample Data

| Interviewee Name | Role | Core Pain Point | Stage Causing Delay | Urgency |
|------------------|------|----------------|---------------------|---------|
| أحمد المصري | Sourcing Agent in China | "بضيع وقت كبير في ترجمة طلبات الواتساب من العربي للصيني" | Sourcing/Translating | High |
| خالد العمري | Local Middle East Merchant | "ما بقدر أتأكد من أسعار المصانع لأن الكتالوجات كلها صيني" | Factory Negotiation | Medium |
| سعيد المطيري | Shipping Office | "حسابات الشحن والجمارك والعمولة تأخذ مني ساعات كل أسبوع" | Pricing/Math | High |

### 📄 Interview Template

> **To use in Notion:** Create a new template in the Field Feedback database (⋮ → Create template) and paste the content below.

---

# 🎙️ مقابلة ميدانية — Interview Record

## 📋 Info

- **الاسم:** [Interviewee Name]
- **الدور:** [Role]
- **التاريخ:** [Interview Date]

## ❓ الأسئلة — Questions

### 1. Workflow Bottlenecks — الاختناقات في سير العمل

❓ *"من لحظة استلام طلب عميل عربي إلى إرسال عرض السعر للعميل، أين أكثر نقطة تسبب تأخير؟"*
> *"From receiving an Arabic client request to sending a quotation, where is the biggest delay?"*

**ANSWER:** [مفتوح]

### 2. PDF & Catalog Handling — التعامل مع الكتالوجات

❓ *"كم كتالوج PDF تستلم من المصانع شهرياً؟ وكيف تتعامل معها حالياً؟ هل تبحث فيها يدوياً؟"*
> *"How many factory PDF catalogs do you receive monthly? How do you handle them today?"*

**ANSWER:** [مفتوح]

### 3. Pricing & Math Pain —痛点 التسعير

❓ *"هل تواجه صعوبة في تحويل العملات وحساب التكاليف النهائية (شحن + جمارك + عمولة)؟ كم مرة أخطأت في الحسابات؟"*
> *"Do you struggle with currency conversion and final cost calculations? How often do miscalculations happen?"*

**ANSWER:** [مفتوح]

### 4. Feature Wish — الميزة التي تتمناها

❓ *"لو عندك عصا سحرية، وش تكون الميزة اللي تحس أنها تغير شغلك ١٨٠ درجة؟"*
> *"If you had a magic wand, what one feature would transform your workflow?"*

**ANSWER:** [مفتوح]

## 🔗 Feature Idea Relation

- [ربط بفكرة منتج في Product Roadmap & Sprints]

---

# 🤝 4. Business Development & CRM — قسم المبيعات والعملاء

## 📋 Database: B2B Clients & Agencies (العملاء والوكالات التجارية)

### View: Pipeline Kanban — Grouped by Stage

### Properties

| Property | Type | Options |
|----------|------|---------|
| Agency Name | Title | - |
| Location | Select | Jordan · KSA · UAE · Egypt |
| Current Monthly Volume | Number | - |
| Willingness to Pay | Select | Monthly Subscription · Per-Transaction · Not Interested |
| Stage | Select | Lead · Contacted · Demo Scheduled · Active Beta Tester |
| Contact Person | Text | - |
| Notes / Follow-up | Text | - |
| Suggested Features | Relation → Product Roadmap & Sprints | - |
| Next Follow-up | Date | - |

### 🟤 Lead

| Agency Name | Location | Current Monthly Volume | Willingness to Pay | Contact Person |
|-------------|----------|----------------------|-------------------|----------------|
| الشرق للتجارة — Al-Sharq Trading | KSA | 150 | Monthly Subscription | أبو محمد — +966 50 123 4567 |

### 🟣 Contacted

| Agency Name | Location | Current Monthly Volume | Willingness to Pay | Contact Person |
|-------------|----------|----------------------|-------------------|----------------|
| النيل للاستيراد — Nile Imports | Egypt | 80 | Not Interested | أحمد — +20 100 234 5678 |

### 🟡 Demo Scheduled

| Agency Name | Location | Current Monthly Volume | Willingness to Pay | Contact Person |
|-------------|----------|----------------------|-------------------|----------------|
| بصريات الأردن — Jordan Optics | Jordan | 45 | Per-Transaction | سامر — +962 79 123 4567 |

### 🟢 Active Beta Tester

| Agency Name | Location | Current Monthly Volume | Willingness to Pay | Contact Person |
|-------------|----------|----------------------|-------------------|----------------|
| Gulf Sourcing LLC | UAE | 300 | Monthly Subscription | John — +971 50 123 4567 |

---

# 💰 5. Financials & Pricing Logic — القسم المالي وتوليد الأسعار

## 📋 Database: Quotation Engine Rules (MVP) (قواعد محرك التسعير)

### View: List View

### Properties

| Property | Type | Options |
|----------|------|---------|
| Cost Variable | Title | - |
| Current Value | Number | - |
| Update Frequency | Select | Daily · Weekly · Static |
| Impact on Final Price | Select | High · Medium · Low |
| Description | Text | - |
| Last Updated | Date | - |
| Source | Text | API · Manual · Fixed |

### All Pricing Rules

| # | Cost Variable | Current Value | Update Frequency | Impact on Final Price | Description | Source |
|---|---------------|--------------|------------------|----------------------|-------------|--------|
| 1 | RMB/USD Exchange Rate | 7.25 | Daily | High | Chinese Yuan to US Dollar | API |
| 2 | USD/JOD Exchange Rate | 0.708 | Weekly | High | US Dollar to Jordanian Dinar | API |
| 3 | USD/SAR Exchange Rate | 3.75 | Weekly | High | US Dollar to Saudi Riyal | API |
| 4 | USD/AED Exchange Rate | 3.67 | Weekly | High | US Dollar to UAE Dirham | API |
| 5 | USD/EGP Exchange Rate | 30.90 | Weekly | High | US Dollar to Egyptian Pound | API |
| 6 | Sea Freight per CBM — China→Aqaba | 85 | Weekly | Medium | Shipping cost per CBM to Jordan (Aqaba port) | Manual |
| 7 | Sea Freight per CBM — China→Jeddah | 95 | Weekly | Medium | Shipping cost per CBM to KSA (Jeddah port) | Manual |
| 8 | Sea Freight per CBM — China→Dubai | 70 | Weekly | Medium | Shipping cost per CBM to UAE (Dubai port) | Manual |
| 9 | Jordan Customs % | 5 | Static | Medium | Customs duty percentage for Jordan | Fixed |
| 10 | KSA Customs % | 5 | Static | Medium | Customs duty percentage for KSA | Fixed |
| 11 | UAE Customs % | 5 | Static | Medium | Customs duty percentage for UAE | Fixed |
| 12 | Egypt Customs % | 5 | Static | Medium | Customs duty percentage for Egypt | Fixed |
| 13 | Agent Commission % | 10 | Static | High | Standard agent commission on total order | Fixed |
| 14 | MOQ Discount — 1000+ units % | 5 | Static | Low | Volume discount for orders over 1000 units | Fixed |
| 15 | MOQ Discount — 5000+ units % | 10 | Static | Low | Volume discount for orders over 5000 units | Fixed |
| 16 | Payment Gateway Fee % | 2.9 | Static | Low | Stripe/Payment processing fee | Fixed |

---

# 🔗 Database Relations

## How to Create Relations in Notion

1. Go to **Product Roadmap & Sprints** database
2. Click **+ Add a property** → **Relation**
3. Select **Field Feedback & Interviews** → name it "Related Feedback"
4. In **Field Feedback & Interviews**, add a Relation property back → name it "Feature Idea"
5. Repeat for **B2B Clients & Agencies** → **Product Roadmap** (name: "Suggested Features")

---

# ✅ Implementation Checklist

- [ ] 1. Create Main Dashboard as a new Notion page
- [ ] 2. Create Product Roadmap & Sprints database (turn table into database)
- [ ] 3. Switch Product Roadmap to Board view
- [ ] 4. Create Field Feedback & Interviews database
- [ ] 5. Add Interview Template via database templates
- [ ] 6. Create B2B Clients & Agencies database
- [ ] 7. Switch B2B Clients to Board/Pipeline view
- [ ] 8. Create Quotation Engine Rules (MVP) database
- [ ] 9. Switch Quotation Engine to List view
- [ ] 10. Set up Relations between databases
- [ ] 11. Add Quick Links on Dashboard to all databases
- [ ] 12. Invite team members

---

> *Built for AI-Sourcing Agent — MVP Phase*
> *Notion Workspace Architecture by Senior PM*
