# E-GAROON — Security Design

**Version:** 1.0  
**Related:** [06-roles-permissions.md](./06-roles-permissions.md), [05-business-rules.md](./05-business-rules.md), [14-payment-design.md](./14-payment-design.md)

---

## 1. Security Principles

1. **Never trust the client** for payment status, prices, roles, or booking state.
2. **Defense in depth:** JWT + RBAC + ownership + business rules.
3. **Backend is source of truth** for authorization, pricing, availability, and state.
4. **Least privilege:** scoped roles (manager, team member) over broad grants.
5. **Audit sensitive actions:** payments, role changes, settlements, refunds.
6. **Secrets in environment variables** — never in source code or client bundles.

---

## 2. Technology Controls

| Control | Implementation |
|---------|----------------|
| Transport | HTTPS (TLS 1.2+) via Nginx |
| Password storage | bcrypt (cost factor ≥ 10) |
| Session | JWT access (short-lived, memory on client) |
| Refresh | httpOnly, Secure, SameSite cookie; rotation on refresh |
| Headers | Helmet (CSP, HSTS, etc.) |
| CORS | Allowlist frontend origins only |
| Rate limiting | express-rate-limit + Redis store (target) |
| Input validation | validator / express-validator + Mongoose |
| NoSQL injection | Parameterized queries; sanitize user input |
| File uploads | Type/size limits; store outside web root or S3 |

---

## 3. Authentication Flow

```text
Email/password login  ──►  verify bcrypt (or 401 PASSWORD_NOT_SET)
Google OAuth          ──►  Google → API callback → SPA /oauth/callback → POST /oauth/exchange
                          ↓
Issue access JWT (e.g. 15 min)
  ↓
Issue refresh token → httpOnly cookie (e.g. 7 days)
  ↓
Subsequent requests: Authorization: Bearer <access>
  ↓
On 401: POST /refresh (cookie) → new access token
  ↓
Logout: revoke refresh, clear cookie
```

Access token payload (minimal): `sub` (userId), `role`. Do not embed permissions in JWT until invalidation strategy is defined.

---

## 4. Authorization Pipeline

```text
REQUEST
  ↓ HTTPS
JWT Verification (authenticate middleware)
  ↓
Load user; check status !== suspended
  ↓
ROLE check (authorize middleware)
  ↓
PERMISSION check (future)
  ↓
RESOURCE OWNERSHIP (e.g. stadium.owner === user.id)
  ↓
BUSINESS RULE (payment/booking preconditions)
  ↓
CONTROLLER → SERVICE → DATABASE
```

---

## 5. Threat Model & Mitigations

| Threat | Mitigation |
|--------|------------|
| Client fakes payment success | Webhook-only status updates; BR-008 |
| Client manipulates price | Server-side PricingService; ignore client amounts |
| Client elevates role | Role from JWT/DB only; admin role assignment server-only |
| IDOR on bookings/teams | Ownership checks on every read/write |
| Double booking race | Redis lock + MongoDB partial unique index |
| Webhook replay | Idempotency keys + processed event log |
| JWT theft | Short access TTL; httpOnly refresh; optional IP binding |
| Brute force login | Rate limit + lockout (planned) |
| Match Code join scam (stranger pays with leaked code) | BR-005c: require Team A payer phone + optional invitePhone; distinct error codes (rate-limited); fail lockout; no QR until CONFIRMED |
| XSS stealing token | Access token in memory (not localStorage) |
| CSRF on refresh | SameSite cookie + CSRF token if cross-site |

---

## 6. Payment Security

```text
Frontend → Backend → Payment Provider
                         ↓
                    Webhook → Verify signature
                         ↓
                    Idempotent handler
                         ↓
                    Database update
```

- Webhook endpoints **not** protected by user JWT — protected by provider HMAC/signature.
- Raw webhook body preserved for dispute audit.
- Mock confirm endpoint **disabled** when `NODE_ENV=production`.
- **Initiate body is whitelisted** (`paymentInitiate.validator`): reject unexpected fields; never accept client `amount` / `totalPrice` / discounts.
- Phones: `normalizeSomaliPhone` + operator prefix check; garbage rejected.
- Names: sanitize control chars; Somali-safe letter/space regex; max 80.
- `invitePhoneTeamB` (optional) stored on Payment and applied as `booking.invitePhone` only after Team A split pay succeeds and Match Code exists.
- Rate-limit: `paymentLimiter` on `POST /payments` and mock confirm/fail.
- Share links for Team B contain **only** `code` + `teamAPhone` (no tokens, OTP, or card data). Join still requires Match Code + Team A payer phone (BR-005c).

See [14-payment-design.md](./14-payment-design.md).

---

## 7. Database Access Rule

```text
React  →  API only
User   →  never MongoDB directly
Backend → sole gatekeeper for read/write
```

No MongoDB connection strings or admin credentials in frontend env (except public anon keys if ever used — not planned).

---

## 8. RBAC

Four system roles documented in [06-roles-permissions.md](./06-roles-permissions.md).

**MVP:** middleware `authorize('admin', 'super_admin')`.

**Target:** permission strings (e.g. `booking.create`) resolved from role + overrides.

---

## 9. Audit Logging

Log (append-only `auditLogs` collection):

- User login failures (aggregate, no password)
- Role/status changes
- Payment webhook processing
- Settlement and payout
- Admin dispute resolution
- Stadium verification

Fields: `actorId`, `action`, `resourceType`, `resourceId`, `before`, `after`, `ip`, `userAgent`, `timestamp`.

Super Admin: full read. Admin: read-only subset.

---

## 10. Data Protection

- Passwords: bcrypt only; never log plaintext.
- PII: email, phone — restrict to owner + admin.
- Payment refs: no full card data (mobile money — provider handles).
- Backups: encrypted at rest (AWS RDS/Atlas settings).

---

## 10b. OTP / verification (register & password reset)

**Master switch:** `OTP_ENABLED=false` (default) skips OTP on register and password reset. Set `OTP_ENABLED=true` before production to restore required verification. Clients read `GET /api/auth/features` → `{ otpEnabled }`.

**Chosen approach: Twilio Verify (Option A)** — Twilio generates, delivers, and checks phone OTPs. E-Garoon stores only a purpose/session row (`OtpCode` with provider `twilio_verify`); plaintext codes are never stored or returned when Verify is used.

| Rule | Implementation |
|------|----------------|
| Feature flag | `OTP_ENABLED=true\|false` (default `false` until ready) |
| Secrets | `TWILIO_AUTH_TOKEN` etc. in `server/.env` only — never client / git |
| Provider switch | `OTP_PROVIDER=mock\|twilio` (default `mock`) |
| Fail closed | `twilio` without credentials → clear 500; no silent mock fallback |
| `devCode` | Only local/mock OTP in non-production; never for Verify-managed phone |
| Logs | Masked phones (`61****00`); never log OTP or auth token |
| Phone format | Somali normalize → E.164 `+252…` before send |
| Email | Local hashed OTP until SMTP; same register/forgot API |
| Rate limits | `otpSendLimiter` + per-target send caps in `otp.service` |
| Somalia | Enable +252 geo permissions; if SMS fails, Africa's Talking / local SMS stub |

Adapters: `server/src/services/otpProviders/` (`MockOtpProvider`, `TwilioVerifyProvider`, `AfricasTalkingProvider` stub).

---

## 10c. Google OAuth

Optional. Secrets stay on the server (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Clients only read `oauthEnabled` from `GET /auth/features`.

| Rule | Implementation |
|------|----------------|
| Adapter | `oauth.service.js` (no Passport) — token + userinfo against Google |
| State | JWT signed with refresh secret, 10 min, carries requested public role |
| Exchange code | One-time Redis (or memory fallback) key, 90s; SPA never sees Google tokens |
| Roles | Never trust client role. Existing email keeps DB role. New users: `team_captain` unless `publicOwnerSignup` and requested owner |
| Link | Same email + Google later adds `google` to `authProviders`; does not promote role |
| Password | Google-only users have no `passwordHash`; login tells them to use Google or Forgot password |

Google Cloud authorized redirect: `{API_PUBLIC_URL}/api/auth/oauth/google/callback`.

---

## 11. Socket.IO Security

- Authenticate connection with access JWT in handshake.
- Join rooms only if user has access to that booking/field.
- Do not emit full payment details to unauthorized sockets.

---

## 12. Environment Secrets

Required in `.env` (never commit):

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
MONGODB_URI
REDIS_URL
WAAFIPAY_API_KEY
WAAFIPAY_WEBHOOK_SECRET
DAHABPAY_API_KEY
DAHABPAY_WEBHOOK_SECRET
OTP_ENABLED
OTP_PROVIDER
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
API_PUBLIC_URL
```

Use `.env.example` with placeholder names only.

---

## 13. Security Checklist (per feature)

Before shipping any endpoint:

- [ ] Authentication required?
- [ ] Role and ownership checked?
- [ ] Input validated?
- [ ] Business preconditions enforced in service?
- [ ] Rate limit applied?
- [ ] Sensitive action audited?
- [ ] No secrets in response?
- [ ] Error messages don't leak internals?
