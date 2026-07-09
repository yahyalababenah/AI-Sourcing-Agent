# Production Readiness Checklist — AI-Sourcing Hub

> مبني على مراجعة شاملة للكود الحالي — كل نقطة مرتبطة بملف وسطر محدد
> تاريخ المراجعة: 2026-06-29

---

## 🔴 Phase 1 — حرج: قبل أي deploy على production

### 1. المصادقة (Authentication)

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 1.1 | **CRITICAL** — `get_current_user()` لا يتحقق من الـ blacklist في Redis. المستخدم لو عمل logout والـ token لسه شغال | `app/modules/auth/dependencies.py:33-117` | أضف `await redis.get(f"blacklisted:{jti}")` قبل قبول أي token | [x] ✅ |
| 1.2 | **CRITICAL** — Refresh token لا يُبطل الـ access token القديم عند التجديد | `app/modules/auth/service.py:242-297` | أضف الـ old jti للـ blacklist عند كل refresh | [x] ✅ |
| 1.3 | لا يوجد Refresh Token Rotation — نفس الـ refresh token يُستخدم للأبد | `app/modules/auth/service.py:242-297` | أصدر refresh token جديد وابطل القديم في كل مرة | [x] ✅ |
| 1.4 | Email enumeration — رسالة "A user with this email already exists" تكشف وجود المستخدم | `app/modules/auth/service.py:137-141` | رد بـ `"Registration failed"` generic بدون تفاصيل | [x] ✅ |
| 1.5 | Password Policy ضعيفة — طول 8 فقط، بدون uppercase/numbers/symbols | `app/modules/auth/schemas.py:79` | أضف regex validator لتعقيد كلمة المرور | [x] ✅ |

---

### 2. التفويض (Authorization) — Ownership Checks مفقودة

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 2.1 | **HIGH** — حذف Documents لا يتحقق من المالك: Agent A يحذف ملفات Agent B | `app/modules/documents/router.py:134-145` | تحقق `document.uploaded_by == current_user.id` قبل الحذف | [x] ✅ |
| 2.2 | **HIGH** — إضافة products لـ RFQ بدون التحقق من ملكية الـ RFQ | `app/modules/intake/service.py:302-356` | تحقق من `rfq.agent_id == current_user.id` | [x] ✅ |
| 2.3 | **HIGH** — تحديث حالة RFQ بدون التحقق من ملكية الـ agent | `app/modules/intake/router.py:222-238` | أضف ownership check في الـ service | [x] ✅ |
| 2.4 | **HIGH** — تحديث حالة Quotation بدون التحقق من المالك | `app/modules/output/router.py:165-178` | تحقق من ملكية الـ quotation | [x] ✅ |
| 2.5 | **HIGH** — Chat room: أي مستخدم مصادق يقدر يقرأ رسائل أي room | `app/modules/chat/router.py:107` | تحقق أن `current_user` عضو في الـ room | [x] ✅ |

---

### 3. رفع الملفات (File Upload Security)

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 3.1 | **CRITICAL** — لا يوجد التحقق من نوع الملف — أي MIME type مقبول | `app/modules/documents/router.py:79` | Whitelist: `application/pdf`, `image/jpeg`, `image/png` فقط. تحقق من file magic bytes لا من الـ header | [x] ✅ |
| 3.2 | **CRITICAL** — اسم الملف لا يُعقَّم — `../../etc/passwd` يمكن تمريره كـ filename | `app/modules/documents/router.py` | `re.sub(r'[^a-zA-Z0-9._-]', '_', filename)` | [x] ✅ |
| 3.3 | Presigned URL تبقى صالحة حتى بعد حذف الملف | `app/modules/output/router.py:227` | احفظ revocation list في Redis أو استخدم TTL أقصر | [x] ✅ |

---

### 4. Rate Limiting على Auth

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 4.1 | **HIGH** — `/auth/login` و`/auth/register` ليس لهما rate limit خاص — Brute Force ممكن | `app/shared/rate_limiter.py` | أضف scope `auth_login: 5 req/min` على endpoints المصادقة | [x] ✅ |
| 4.2 | X-Forwarded-For لا يُتحقق منه — يمكن spoofing الـ IP لتجاوز الـ rate limit | `app/shared/rate_limiter.py:114` | تحقق من الـ CIDR للـ trusted proxies فقط | [x] ✅ |

---

### 5. Deployment

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 5.1 | **CRITICAL** — Alembic migrations لا تُشغَّل تلقائياً عند deploy | `docker-compose.yml` | أضف `alembic upgrade head` في `entrypoint.sh` قبل `uvicorn` | [x] ✅ |
| 5.2 | **HIGH** — Celery tasks بدون message signing — يمكن حقن tasks ضارة | `app/shared/celery_app.py` | أضف `task_serializer='json'`, `accept_content=['json']` | [x] ✅ كان موجوداً |
| 5.3 | **HIGH** — Let's Encrypt cert بدون auto-renewal — سيتوقف الموقع بعد 90 يوم | `docker-compose.prod.yml` | أضف `certbot` container مع cron renewal | [x] ✅ |
| 5.4 | API تشتغل بـ process واحد فقط | `docker-compose.yml:52` | استخدم `gunicorn -w 4 -k uvicorn.workers.UvicornWorker` | [x] ✅ في docker-compose.prod.yml |

---

## 🟠 Phase 2 — مهم: خلال أول أسبوع في production

### 6. تشفير الاتصالات الداخلية

| # | المشكلة | الحل | الحالة |
|---|---------|------|--------|
| 6.1 | PostgreSQL بدون TLS داخل docker network | أضف `?ssl=require` لـ `DATABASE_URL` في production | [x] ✅ موثق في docker-compose.prod.yml |
| 6.2 | Redis بدون TLS — `redis://` cleartext | استخدم `rediss://` مع TLS certificate في production | [x] ✅ موثق في docker-compose.prod.yml |
| 6.3 | MinIO بدون HTTPS داخلياً | فعّل TLS في MinIO config أو استخدم private network فقط | [ ] |

---

### 7. Health Checks العميقة

الـ `/health` endpoint الحالي يتحقق من DB و Redis فعلاً ✅ — لكن يحتاج إضافة:

```python
# app/main.py — health_check()
- MinIO connectivity check
- Celery worker ping via inspect().ping()
- اتصال بـ external LLM provider إذا كان configured
```

| # | الحالة |
|---|--------|
| 7.1 MinIO check | [x] ✅ |
| 7.2 Celery worker ping | [x] ✅ |
| 7.3 LLM provider check | [x] ✅ |

---

### 8. Monitoring & Alerting

| # | ما يجب فعله | الملف | الحالة |
|---|------------|-------|--------|
| 8.1 | اربط Sentry DSN — موجود في config لكن يحتاج تفعيل بيئة production | `app/config.py:95` | [ ] أضف SENTRY_DSN في .env |
| 8.2 | أضف Grafana dashboard لـ Prometheus metrics الموجودة | `docker-compose.prod.yml` | [x] ✅ |
| 8.3 | أضف Celery Flower container لمراقبة الـ tasks | `docker-compose.prod.yml` | [x] ✅ |
| 8.4 | فعّل query timeout في SQLAlchemy: `connect_args={"command_timeout": 30}` | `app/shared/database.py` | [x] ✅ |
| 8.5 | أضف alerting على HTTP 5xx rate و slow queries | Grafana/Sentry | [ ] |

---

### 9. تحسينات الـ CSP و CORS

| # | المشكلة | الملف | الحل | الحالة |
|---|---------|-------|------|--------|
| 9.1 | `'unsafe-inline'` في الـ CSP للـ styles | `app/shared/security_middleware.py:82` | استخدم nonces بدلاً من `unsafe-inline` | [ ] |
| 9.2 | CORS_ORIGINS تحتوي على `localhost` كـ default | `app/config.py:106` | أضف validation: في production، ارفض أي origin يحتوي `localhost` | [x] ✅ |

---

## 🟡 Phase 3 — تحسين: خلال أول شهر

### 10. External APIs Resilience

| # | ما يجب فعله | الملف | الحالة |
|---|------------|-------|--------|
| 10.1 | أضف Circuit Breaker على LLM API calls — لو فشل الـ provider يتوقف الـ pipeline كله | `app/shared/circuit_breaker.py` + `app/modules/intake/llm_client.py` | [x] ✅ |
| 10.2 | أضف Exponential Backoff — موجود فعلاً (1s/4s/15s) بدون tenacity | `app/modules/intake/llm_client.py:49-51` | [x] ✅ كان موجوداً |
| 10.3 | أضف request timeout على كل `httpx` calls (30 ثانية كحد أقصى) | `app/modules/intake/llm_client.py:46` | [x] ✅ كان موجوداً |

---

### 11. Cache Security

| # | ما يجب فعله | الملف | الحالة |
|---|------------|-------|--------|
| 11.1 | تحقق أن `invalidate_rules_cache()` يُستدعى عند كل تعديل لـ pricing rules | `app/modules/pricing/router.py:81-82` | [x] ✅ كان موجوداً |
| 11.2 | أضف Cache stampede protection (lock أثناء إعادة البناء) | `app/modules/pricing/cache.py` + `app/modules/pricing/service.py` | [x] ✅ |

---

### 12. Backup & Disaster Recovery

| # | ما يجب فعله | الحالة |
|---|------------|--------|
| 12.1 | PostgreSQL daily backup إلى MinIO أو S3 خارجي | [x] ✅ (`scripts/backup.sh`) |
| 12.2 | MinIO backup للملفات المرفوعة | [x] ✅ (`scripts/backup.sh` — mc mirror) |
| 12.3 | Test restore procedure — تحقق شهرياً من إمكانية الاستعادة | [ ] يدوي |
| 12.4 | احتفظ بـ 30 يوم backups كحد أدنى | [x] ✅ (`RETAIN_DAYS=30` في backup.sh) |

لتشغيل الـ backup تلقائياً — أضف للـ crontab على الـ host:
```bash
# تشغيل يومي الساعة 02:00
0 2 * * * PGPASSWORD=secret MINIO_ALIAS=local /app/scripts/backup.sh >> /var/log/aisourcing-backup.log 2>&1
```

---

## ✅ ما هو موجود وشغال صح

- ✅ bcrypt password hashing مع JWT access + refresh tokens
- ✅ JWT secret validation — يرفض `"change_me"` وما شابهه عند الـ startup
- ✅ RBAC كامل (client/agent/admin) مع composable role checkers
- ✅ HSTS + كامل Security Headers (X-Frame-Options, CSP, Permissions-Policy)
- ✅ Redis-backed sliding window rate limiter مع Retry-After headers
- ✅ Nginx rate limiting كطبقة ثانية (api/upload/llm zones)
- ✅ SQL injection محمي بالكامل عبر SQLAlchemy ORM
- ✅ Pydantic validation على كل endpoints مع field constraints
- ✅ Audit logging مع automatic redaction للبيانات الحساسة
- ✅ Sentry integration جاهز للتفعيل
- ✅ Docker Compose production setup مع resource limits وlog rotation
- ✅ MinIO presigned URLs مع expiry
- ✅ Token blacklist عند logout (موجود لكن غير مفعّل في التحقق — راجع 1.1)
- ✅ Data isolation: clients يرون RFQs خاصتهم فقط
- ✅ TrustedHostMiddleware + CORS configuration
- ✅ Health check يتحقق من DB + Redis

---

## ترتيب التنفيذ الموصى به

```
هذا الأسبوع — قبل production
├── 1.1 🔴 فعّل Token Blacklist check في get_current_user()     ← 30 دقيقة
├── 3.1 🔴 Whitelist لأنواع الملفات المسموحة + magic bytes      ← 1 ساعة
├── 3.2 🔴 Sanitize filenames (path traversal prevention)        ← 30 دقيقة
├── 5.1 🔴 alembic upgrade head في entrypoint.sh               ← 15 دقيقة
├── 5.2 🔴 Celery task signing (json serializer only)           ← 30 دقيقة
├── 2.1 🟠 Ownership check على Document delete                  ← 1 ساعة
├── 2.4 🟠 Ownership check على Chat rooms                       ← 1 ساعة
├── 4.1 🟠 Auth endpoints rate limiting (5 req/min)             ← 30 دقيقة
└── 5.3 🟠 Certbot container للـ SSL auto-renewal               ← 2 ساعة

الأسبوع التالي
├── 1.2 Refresh token rotation
├── 1.4 Generic error messages (إزالة email enumeration)
├── 2.2 / 2.3 Ownership checks على RFQ operations
├── 6.1 / 6.2 TLS للـ DB و Redis في production
├── 5.4 Multi-process gunicorn
└── 8.1 تفعيل Sentry DSN

الشهر الأول
├── Circuit Breaker للـ LLM (tenacity)
├── Deep health checks (MinIO + Celery)
├── Grafana + Flower monitoring
├── Backup strategy
└── CSP nonces (إزالة unsafe-inline)
```

---

## ملخص المخاطر

| الخطورة | العدد | أبرز النقاط |
|---------|-------|------------|
| 🔴 Critical | 5 | Token blacklist غير مفعّل، file type validation مفقود، filename sanitization، migrations، Celery signing |
| 🟠 High | 8 | Ownership checks (5 أماكن)، auth brute force، SSL renewal، multi-process |
| 🟡 Medium | 7 | TLS داخلي، IP spoofing، CSP unsafe-inline، query timeout، circuit breaker |
| 🟢 Low | 4 | Password complexity، email enumeration، cache stampede، log retention |
