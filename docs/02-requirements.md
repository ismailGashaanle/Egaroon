# E-GAROON — Requirements Index

**Version:** 1.0  
**Related:** [03-srs.md](./03-srs.md) (full SRS), [05-business-rules.md](./05-business-rules.md), [07-acceptance-criteria.md](./07-acceptance-criteria.md)

This document indexes all functional and non-functional requirements. Detailed narratives live in the SRS and linked design docs.

---

## 1. Functional Requirements (FR-001 – FR-039)

| ID | Requirement | Primary module | Status (MVP) |
|----|-------------|----------------|--------------|
| FR-001 | User Registration | Auth | Implemented |
| FR-002 | User Login | Auth | Implemented |
| FR-003 | JWT Authentication (access + refresh) | Auth | Implemented |
| FR-004 | Role Authorization (RBAC) | Auth / Middleware | Implemented (role-level) |
| FR-005 | Team Creation | Teams | Implemented |
| FR-006 | Stadium Creation | Stadiums | Implemented |
| FR-007 | Field Creation | Fields | Implemented |
| FR-008 | Stadium Search | Stadiums | Implemented |
| FR-009 | Availability Search | Availability | Implemented |
| FR-010 | Booking Creation | Bookings | Implemented |
| FR-011 | Temporary Slot Hold (Redis + DB) | Bookings | Implemented |
| FR-012 | Team B Invitation | Bookings | Implemented |
| FR-013 | Team A Payment | Payments | Implemented (mock) |
| FR-014 | Team B Payment | Payments | Implemented (mock) |
| FR-015 | Payment Verification (webhook) | Payments | Scaffolded |
| FR-016 | Booking Confirmation | Bookings | Implemented |
| FR-017 | Digital Receipt | Payments | Planned |
| FR-018 | QR Match Pass | Bookings / Match | Partial (QR display) |
| FR-019 | Check-in | Bookings | Endpoint exists; QR scan enforcement planned |
| FR-020 | No-show handling | Bookings | Planned |
| FR-021 | Recurring Booking | Availability | Implemented |
| FR-022 | Discounts | Pricing | Implemented |
| FR-023 | Blocked Slots | Availability | Implemented |
| FR-024 | Tournament Creation | Tournaments | Implemented |
| FR-025 | Tournament Registration | Tournaments | Implemented |
| FR-026 | Group Management | Tournaments | Implemented (basic) |
| FR-027 | Fixture Generation | Tournaments | Implemented (basic) |
| FR-028 | Standings | Tournaments | Implemented (basic) |
| FR-029 | Match Results | Tournaments / Bookings | Partial |
| FR-030 | Settlement | Payments | Implemented (manual trigger + cron) |
| FR-031 | Commission (default 4%) | Payments | Implemented |
| FR-032 | Owner Payout | Payouts | Partial (settlement math; automated payout job planned) |
| FR-033 | Reviews | Reviews | Planned |
| FR-034 | Disputes | Disputes | Planned |
| FR-035 | Notifications (email/SMS/push) | Notifications | Partial (in-app; real channels planned) |
| FR-036 | Reports | Reports / Admin | Partial (dashboards; export planned) |
| FR-037 | Audit Logs | Audit | Planned |
| FR-038 | Admin Management | Admin | Implemented |
| FR-039 | Permission Management | Admin / Super Admin | Planned (permission-level RBAC) |

---

## 2. Non-Functional Requirements (NFR-001 – NFR-008)

### Security

| ID | Requirement |
|----|-------------|
| NFR-001 | All protected APIs must require authentication. |
| NFR-002 | Passwords must never be stored in plaintext (bcrypt). |
| NFR-003 | Authorization must be enforced server-side; never trust client roles or payment status. |

### Performance

| ID | Requirement |
|----|-------------|
| NFR-004 | Availability searches should respond within an acceptable low-latency target. |
| NFR-005 | Booking conflicts must be prevented under concurrent requests (Redis lock + DB constraint). |

### Scalability

| ID | Requirement |
|----|-------------|
| NFR-006 | Architecture should support horizontal scaling (stateless API, Redis, MongoDB). |

### Reliability

| ID | Requirement |
|----|-------------|
| NFR-007 | Payment webhook processing must be idempotent. |

### Maintainability

| ID | Requirement |
|----|-------------|
| NFR-008 | Business logic must remain separated from controllers (services layer). |

---

## 3. Cross-Cutting Requirements

### Payment & booking separation

- Booking state and payment state are **separate state machines** ([15-booking-state-machine.md](./15-booking-state-machine.md)).
- Feature permissions (lineup, formation, positions) depend on verified payment + confirmed booking ([05-business-rules.md](./05-business-rules.md) BR-006, BR-007).

### Data access

- Users and frontend **never** access MongoDB directly ([12-security-design.md](./12-security-design.md)).
- Backend is source of truth for pricing, availability, roles, and state.

### Concurrency

- Redis: temporary lock `lock:field:{fieldId}:{date}:{startTime}` (TTL default 10 minutes).
- MongoDB: partial unique index on live bookings for `(field, startTime, endTime)`.

---

## 4. External Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| WaafiPay | Mobile money payments | Planned |
| DahabPay | Mobile money payments | Planned |
| MongoDB | Persistent data | Implemented |
| Redis | Locks, cache, rate limits | Implemented |
| Socket.IO | Real-time booking/payment events | Implemented |

---

## 5. Constraints

- **JavaScript only** — no TypeScript in application code.
- Payment providers via **adapter pattern** — no provider-specific code scattered in booking service ([14-payment-design.md](./14-payment-design.md)).
- Platform commission default **4%**, configurable by Super Admin.
- Owner payout delayed by **settlement safety window** (default 75 minutes after match end).
- Team B payment deadline default **10 minutes** after invitation.

---

## 6. Assumptions

- Target market uses WaafiPay and/or DahabPay for mobile payments.
- Stadium owners operate multiple fields with per-player or fixed-field pricing.
- Match bookings are typically two teams (Team A initiator, Team B invited opponent).
- Single MongoDB deployment is sufficient for MVP; sharding is a future concern.

---

## 7. Dependencies

- MongoDB and Redis available at runtime.
- HTTPS termination at Nginx (production).
- Payment provider webhook endpoints reachable from provider networks.
- Environment variables for secrets (JWT, provider keys) — never in source control.
