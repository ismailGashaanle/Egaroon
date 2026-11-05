# E-GAROON — Software Requirements Specification (SRS)

**Version:** 1.0  
**Product:** E-GAROON (working title)  
**Date:** September 2026

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for **E-GAROON**, a football stadium booking, team management, payment, match management, and tournament platform.

### 1.2 Scope

E-GAROON enables Team Captains to search stadiums, book fields, pay for matches, and manage squads; Stadium Owners to list venues, set pricing, and receive payouts; and platform Admins to operate, moderate, and configure the system.

Out of scope for v1.0: native mobile apps (web-first), international payment providers beyond WaafiPay/DahabPay, and live video streaming.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Team A | Booking initiator (first team to hold a slot) |
| Team B | Invited opponent team |
| Hold | Temporary reservation of a slot pending payment |
| Escrow | Funds held by platform until match settlement |
| Settlement safety window | Configurable delay after match end before owner payout |

### 1.4 References

- [01-project-overview.md](./01-project-overview.md)
- [02-requirements.md](./02-requirements.md)
- [04-use-cases.md](./04-use-cases.md)
- [05-business-rules.md](./05-business-rules.md)
- [11-api-contract.md](./11-api-contract.md)

---

## 2. Project Background

Football is one of the most popular sports in Somaliland and Somalia, with many teams, communities, schools, and organizations regularly using football stadiums and artificial turf fields for training, friendly matches, tournaments, and competitions. However, the process of finding and booking a suitable football field is still largely manual.

In many cases, team captains or players must physically visit stadiums, call stadium owners or managers, or communicate through WhatsApp and other informal channels to check field availability, prices, and booking schedules. Stadium owners and managers also commonly rely on notebooks, phone calls, WhatsApp messages, or spreadsheets to manage bookings and payments.

As the number of football teams and stadium facilities continues to grow, these traditional methods become increasingly difficult to manage. They can result in scheduling conflicts, double bookings, unclear payment records, missed bookings, and difficulties tracking team and tournament activities.

**E-GAROON** is proposed as a centralized digital platform that connects football teams with stadiums and provides tools for stadium booking, team management, payments, match management, tournament management, availability tracking, and administrative management. The system aims to make football facility management more organized, transparent, and convenient for both teams and stadium operators.

---

## 3. Problem Statement

Currently, football stadium booking and team management in Somaliland and Somalia are often handled through **manual and informal processes**, such as phone calls, WhatsApp messages, physical visits, notebooks, and spreadsheets. These methods create several problems for both customers and stadium operators.

### 3.1 Problems faced by teams

- Teams may have difficulty finding available stadiums at their preferred time.
- Players or team captains may need to contact multiple stadiums to compare availability and prices.
- There is no centralized platform showing available fields and booking schedules.
- Manual communication can cause misunderstandings about booking times and prices.
- Teams may not have a reliable digital record of their previous bookings and payments.
- Tournament and match organization can be difficult to manage.

### 3.2 Problems faced by stadium owners and managers

- Bookings are often recorded manually, making them difficult to track.
- Double bookings can occur when multiple customers request the same time slot.
- Managing cancellations, refunds, and payments manually can be complicated.
- Owners may have limited visibility into their daily, weekly, or monthly revenue.
- Managing multiple fields and their availability can become difficult.
- There may be no centralized system for managing stadium staff and customers.

### 3.3 Payment-related problems

Manual payment processes can also create uncertainty regarding whether a booking has been fully paid, partially paid, cancelled, or expired. When two teams attempt to reserve the same field and time simultaneously, the absence of an automated booking and payment mechanism can increase the risk of conflicts.

### 3.4 Specific operational gaps (product)

These informal methods show up in the platform as concrete gaps:

- Double-booking and scheduling conflicts at popular venues
- No trusted payment flow between two teams and the stadium owner
- No platform commission or automated owner payout
- Manual tournament fixture and standings management
- No audit trail for disputes, no-shows, or refunds

### 3.5 Overall problem

Therefore, there is a need for a **centralized, secure, and automated football stadium management and booking platform** that can manage stadium availability, prevent double bookings, coordinate teams and matches, record payments, support tournaments, and provide appropriate management tools for stadium owners and administrators.

**E-GAROON** addresses this problem by providing a unified platform where **Team Captains, Stadium Owners, Stadium Managers, Admins, and Super Admins** can perform their respective activities through role-based access.

### 3.6 One-sentence problem statement

> **The main problem addressed by E-GAROON is the lack of a centralized digital system for efficiently managing football stadium bookings, availability, payments, teams, matches, and tournaments, resulting in manual processes, booking conflicts, poor payment tracking, and inefficient stadium management.**

---

## 4. Project Objectives

1. Provide a searchable catalog of verified stadiums and fields.
2. Enforce booking uniqueness under concurrency.
3. Require verified payment before match-management features unlock.
4. Hold funds in escrow; settle with configurable platform commission.
5. Support tournaments with slot blocking and standings.
6. Enforce server-side authorization and pricing — never trust the client.

---

## 5. Scope

### 5.1 In Scope

Authentication, teams, stadiums, fields, availability, bookings, payments, settlements, payouts, lineups, QR check-in, tournaments, admin operations, notifications, reviews, disputes, reports, audit logs.

### 5.2 Out of Scope (v1.0)

Native iOS/Android apps, multi-currency FX, betting, social feed, AI refereeing.

---

## 6. Stakeholders

| Stakeholder | Interest |
|-------------|----------|
| Team Captain | Book fields, pay, manage squad |
| Stadium Owner | List venue, set prices, receive revenue |
| Stadium Manager | Day-to-day venue operations (scoped) |
| Platform Admin | Operations, verification, disputes |
| Super Admin | Platform configuration, admins, commission |
| Payment providers | WaafiPay, DahabPay |

---

## 7. System Overview

MERN stack with Redis (locks, cache) and Socket.IO (real-time). React SPA communicates with Express API over HTTPS. Payment adapters integrate WaafiPay and DahabPay. MongoDB is the persistent source of truth.

See [08-hld.md](./08-hld.md).

---

## 8. Actors

1. **Team Captain** — primary booking actor  
2. **Stadium Owner** — venue operator  
3. **Stadium Manager** — owner delegate (scoped)  
4. **Team Member** — squad player (scoped)  
5. **Admin** — platform operations  
6. **Super Admin** — root authority  
7. **Payment Provider** — external system (webhooks)

---

## 9. Roles & Permissions

Four system-wide primary roles: `TEAM_CAPTAIN`, `STADIUM_OWNER`, `ADMIN`, `SUPER_ADMIN`.

Scoped roles: `STADIUM_MANAGER`, `TEAM_MEMBER`.

Full matrix: [06-roles-permissions.md](./06-roles-permissions.md).

---

## 10. Functional Requirements

See [02-requirements.md](./02-requirements.md) for FR-001 through FR-039 with implementation status.

---

## 11. Non-Functional Requirements

See [02-requirements.md](./02-requirements.md) for NFR-001 through NFR-008.

---

## 12. Business Rules

See [05-business-rules.md](./05-business-rules.md) for BR-001 through BR-015.

---

## 13. Use Cases

See [04-use-cases.md](./04-use-cases.md) for UC-001 through UC-030.

---

## 14. User Stories (selected)

| As a… | I want to… | So that… |
|-------|------------|----------|
| Team Captain | search stadiums by city | I can find a nearby pitch |
| Team Captain | hold a slot for 10 minutes | I can pay without losing the slot |
| Team Captain | invite Team B | we can play a match |
| Stadium Owner | set per-player pricing | total cost scales with squad size |
| Admin | verify a stadium | only legitimate venues appear in search |
| Super Admin | change commission % | platform revenue is configurable |

---

## 15. Acceptance Criteria

See [07-acceptance-criteria.md](./07-acceptance-criteria.md).

---

## 16. Payment Requirements

- Providers: WaafiPay, DahabPay via adapter pattern ([14-payment-design.md](./14-payment-design.md)).
- Frontend cannot assert payment success; only verified webhooks update state.
- Escrow: team payments held until settlement.
- Commission default 4%, configurable.
- Owner payout after settlement safety window (default 75 min).
- Idempotent webhook processing (NFR-007).
- Separate payment and booking state machines.

---

## 17. Booking Requirements

- Team A creates booking → slot HELD (default 10 min).
- Team A pays → PAYMENT_PENDING if Team B not yet invited/paid.
- Team B invited → configurable payment deadline (default 10 min).
- Both paid → CONFIRMED; lineup/formation/positions enabled.
- Expiry releases hold; slot becomes available again.
- Redis lock + MongoDB partial unique index prevent double booking ([15-booking-state-machine.md](./15-booking-state-machine.md)).

---

## 18. Tournament Requirements

- Owner creates tournament; reserves fields/slots ([16-tournament-design.md](./16-tournament-design.md)).
- Formats: GROUP_STAGE, KNOCKOUT, GROUP_AND_KNOCKOUT.
- Registration fee, groups, fixtures, standings (P/W/D/L/GF/GA/GD/PTS).
- Tournament-reserved slots blocked from public booking (BR-011).

---

## 19. Security Requirements

- JWT access (short-lived) + refresh (httpOnly cookie, rotation).
- bcrypt password hashing.
- RBAC + resource ownership checks + business-rule gates.
- Helmet, CORS, rate limiting, input validation.
- Audit logs for sensitive actions.
- See [12-security-design.md](./12-security-design.md).

---

## 20. Notification Requirements

Real-time via Socket.IO (booking updated, payment received). Future: email, SMS, push for payment confirmed, match reminder, tournament fixture updates.

---

## 21. Reporting Requirements

Admin/Super Admin dashboards: users, bookings, payments, disputes, revenue, commission. Export and scheduled reports — planned Phase 9+.

---

## 22. Constraints

- JavaScript (not TypeScript).
- Modular backend; business logic in services (NFR-008).
- No direct MongoDB access from client.
- API base path target: `/api/v1/*` (current MVP: `/api/*`).

---

## 23. Assumptions

- Reliable internet for payment provider callbacks.
- Owners provide accurate field capacity and pricing.
- Two-team match model is the default booking type.

---

## 24. Dependencies

MongoDB, Redis, Node.js 18+, payment provider APIs, AWS/hosting for production.

---

## 25. External Integrations

| System | Integration type |
|--------|------------------|
| WaafiPay | REST + webhooks |
| DahabPay | REST + webhooks |
| MongoDB | Mongoose ODM |
| Redis | ioredis |

---

## 26. Data Requirements

Collections listed in [10-database-design.md](./10-database-design.md). PII: user email, phone, names. Financial: payments, transactions, ledger entries, payouts. Retention and GDPR-style deletion — future policy.

---

## 27. API Requirements

REST JSON under `/api/v1`. Every endpoint: method, auth, role, permission, validation, business rules, errors, rate limit. See [11-api-contract.md](./11-api-contract.md).

---

## 28. System Design Requirements

- HLD: [08-hld.md](./08-hld.md)
- LLD: [09-lld.md](./09-lld.md)
- Folder layout: [13-folder-architecture.md](./13-folder-architecture.md)

---

## 29. Future Enhancements

- Permission-level RBAC beyond role-only checks
- Multi-language UI (Somali + English)
- Owner analytics and forecasting
- Automated no-show policy engine
- Additional payment providers
- Mobile apps
- API versioning migration from `/api` to `/api/v1`
