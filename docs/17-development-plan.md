# E-GAROON — Development Plan

**Version:** 1.0  
**Related:** [01-project-overview.md](./01-project-overview.md), [MASTER-AI-PROMPT.md](./MASTER-AI-PROMPT.md)

Build **phase by phase**. Do not implement all features in one pass.

---

## Phase 0 — Documentation ✅ (this folder)

| Task | Status |
|------|--------|
| Requirements gathering | ✅ |
| SRS | ✅ `03-srs.md` |
| Use cases | ✅ `04-use-cases.md` |
| Business rules | ✅ `05-business-rules.md` |
| Roles & permissions | ✅ `06-roles-permissions.md` |
| Acceptance criteria | ✅ `07-acceptance-criteria.md` |
| HLD / LLD / DB / API / Security | ✅ |
| Master AI prompt | ✅ `MASTER-AI-PROMPT.md` |

---

## Phase 1 — Architecture

| Task | Status |
|------|--------|
| HLD documented | ✅ |
| LLD documented | ✅ |
| Database design | ✅ |
| API contract | ✅ |
| Security design | ✅ |
| Folder architecture | ✅ |
| Repo scaffold (server + client) | ✅ Implemented |

---

## Phase 2 — Foundation

| Task | Status |
|------|--------|
| Git / GitHub repo | ✅ |
| Express app + middleware | ✅ |
| MongoDB + Mongoose | ✅ |
| Redis (ioredis) | ✅ |
| JWT + bcrypt | ✅ |
| Validation + error handling | ✅ Partial |
| Logging | ⚠️ Basic (structured logging planned) |
| `.env.example` | ✅ |

---

## Phase 3 — Authentication

| Task | Status |
|------|--------|
| Register (captain/owner) | ✅ |
| Login / logout / refresh | ✅ |
| GET /me | ✅ |
| Role middleware | ✅ |
| Permission-level RBAC | ❌ Planned (FR-039) |
| Session management UI | ⚠️ Partial |

---

## Phase 4 — Stadium

| Task | Status |
|------|--------|
| Stadium CRUD | ✅ |
| Field CRUD | ✅ |
| Working hours | ⚠️ Basic |
| Availability blocks | ✅ |
| Pricing (per_player / fixed) | ✅ |
| Admin stadium verify | ✅ |
| Recurring bookings | ❌ Phase 4+ |
| Discounts | ❌ Phase 4+ |
| Stadium manager role | ❌ Planned |
| Geo search | ✅ Nearby + radius + sort + `availableNow` (slot look-ahead) |

---

## Phase 5 — Booking

| Task | Status |
|------|--------|
| Stadium search + availability | ✅ |
| Redis slot lock | ✅ |
| Booking create (HELD) | ✅ |
| Team B invitation | ✅ |
| 10-minute hold expiry | ✅ (cron job) |
| MongoDB partial unique index | ✅ |
| Socket.IO booking updates | ✅ |
| Scheduled expire job (cron) | ✅ `jobs/scheduler.js` |
| Public field slots feed | ✅ `GET /fields/:id/slots` |

---

## Phase 6 — Payment

| Task | Status |
|------|--------|
| Payment intent + mock provider | ✅ |
| Provider adapter pattern | ✅ mock + Waafi/Dahab stubs |
| Webhook scaffold | ✅ |
| Dev mock-confirm | ✅ |
| Escrow (HELD) | ✅ |
| Settlement + 4% commission | ✅ |
| Automated payout after safety window | ✅ (scheduler) |
| Payment list / get | ✅ |
| WaafiPay / DahabPay live APIs | ❌ credentials required |

---

## Phase 7 — Match

| Task | Status |
|------|--------|
| Digital match pass (QR display) | ✅ |
| Check-in endpoint | ✅ |
| Lineup / formation / positions | ✅ (payment-gated) |
| Match lifecycle auto-advance | ✅ (scheduler) |
| QR scan enforcement | ❌ |
| No-show detection + grace | ❌ |

---

## Phase 8 — Tournament

| Task | Status |
|------|--------|
| Tournament CRUD | ✅ |
| Registration + fee payment (mock) | ✅ |
| Groups / fixtures / standings | ✅ (basic) |
| Slot blocking | ✅ |
| Knockout bracket advanced | ⚠️ Partial |
| Client UI | ✅ |

---

## Phase 9 — Admin

| Task | Status |
|------|--------|
| User list / suspend | ✅ |
| Role assignment (super_admin) | ✅ |
| Admin / owner dashboards | ✅ |
| Settle + expire holds UI | ✅ |
| Owner revenue API | ✅ |
| Recurring + discounts APIs | ✅ |
| Disputes / refunds | ❌ |
| Audit logs | ❌ |

---

## Phase 10 — Testing

| Task | Status |
|------|--------|
| Unit tests (services) | ❌ |
| API integration tests | ❌ |
| Security tests | ❌ |
| Concurrency / booking race tests | ❌ |
| Payment webhook tests | ❌ |
| E2E (Playwright/Cypress) | ❌ |

---

## Phase 11 — Deployment

| Task | Status |
|------|--------|
| AWS hosting | ❌ |
| Nginx reverse proxy | ❌ |
| PM2 process manager | ❌ |
| HTTPS / TLS | ❌ |
| MongoDB Atlas / managed Redis | ❌ |
| Monitoring + alerts | ❌ |
| Backups | ❌ |

---

## Recommended Next Steps

Phases 1–9 core are complete. Priority order for remaining work:

1. **WaafiPay / DahabPay live credentials** (Phase 6) — provider stubs are built; swap `mock` in production `PAYMENT_PROVIDER` env var.
2. **API versioning `/api/v1`** — mount both prefixes, deprecate `/api` later (no DB migration required).
3. **Testing suite** (Phase 10) — unit tests for BookingService/PaymentService; concurrency test for race condition; E2E booking flow.
4. **AWS deployment** (Phase 11) — Nginx + PM2 + MongoDB Atlas + managed Redis + HTTPS.
5. **Dispute / refund module** + **Audit logs** — currently Planned; needed for production readiness.
6. **Permission-level RBAC** (FR-039) — extend middleware from role-only to permission strings.

---

## AI-Assisted Development Workflow

```text
AI → Read /docs
   → Plan one module
   → Implement
   → Test
   → Review against SRS + API contract
   → Next module
```

**Do not prompt:** "Build the whole E-GAROON application."

**Do prompt:** "Implement Phase 6 WaafiPay adapter per `/docs/14-payment-design.md`."

See [MASTER-AI-PROMPT.md](./MASTER-AI-PROMPT.md).

---

## Versioning & Migration

| Change | Approach |
|--------|----------|
| `/api` → `/api/v1` | Mount both; deprecate `/api` later |
| Permission RBAC | Add collection; migrate role defaults |
| Team draft/active | Add `status` field; backfill `active` for existing |
