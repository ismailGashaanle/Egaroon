# E-GAROON — Project Overview

**Version:** 1.0  
**Working title:** E-GAROON (final brand TBD)  
**Repository:** `kulansiiye`  
**Architecture:** MERN + Redis + Socket.IO  
**Payment providers (target):** WaafiPay, DahabPay

---

## 1. What Is E-GAROON?

**E-GAROON** is an online platform for managing football (soccer) venue operations end-to-end:

- Stadiums and fields
- Team-to-team match bookings
- Payments, escrow, and owner payouts
- Recurring matches, discounts, and blocked time slots
- Tournaments/cups (groups, fixtures, standings, knockout)
- QR check-in, receipts, notifications, reviews, disputes, and administration

The platform connects **Team Captains**, **Stadium Owners**, **Admins**, and **Super Admins** in a single marketplace where verified payment determines what users are allowed to do.

### Background

Football is one of the most popular sports in Somaliland and Somalia. Teams, schools, and communities regularly use stadiums and artificial turf for training, friendlies, and tournaments — but finding and booking a field is still largely manual (phone calls, WhatsApp, physical visits, notebooks, and spreadsheets). As the number of teams and venues grows, those methods produce scheduling conflicts, double bookings, unclear payments, and weak records of matches and tournaments.

E-GAROON is a centralized digital platform that connects teams with stadiums and gives owners, managers, and administrators tools for availability, booking, payments, matches, and tournaments.

### Problem (one sentence)

> The main problem addressed by E-GAROON is the lack of a centralized digital system for efficiently managing football stadium bookings, availability, payments, teams, matches, and tournaments, resulting in manual processes, booking conflicts, poor payment tracking, and inefficient stadium management.

Full background, stakeholder problems, and objectives: [03-srs.md](./03-srs.md) §§2–4.

---

## 2. Primary Workflow

```text
TEAM CAPTAIN
      ↓
SEARCH STADIUM
      ↓
SELECT FIELD
      ↓
SELECT DATE/TIME
      ↓
CREATE MATCH BOOKING
      ↓
TEAM A PAYMENT
      ↓
TEAM B INVITATION / PAYMENT
      ↓
BOTH PAYMENTS CONFIRMED
      ↓
BOOKING CONFIRMED
      ↓
MATCH (lineup, formation, positions enabled)
      ↓
CHECK-IN (QR)
      ↓
MATCH COMPLETED
      ↓
SETTLEMENT
      ↓
4% PLATFORM COMMISSION
      ↓
STADIUM OWNER PAYOUT
```

---

## 3. Core Business Principle

> **Verified payment determines what a user is permitted to do.**

Example: a Team Captain does **not** receive full match-management privileges (lineup, formation, positions) until **both teams** have verified payments and the booking is **CONFIRMED**.

This is **not** implemented as “deny everything at the database layer.” Instead, the system separates three concerns:

```text
Payment Status
       ↓
Booking Status
       ↓
Feature Permission
```

See [05-business-rules.md](./05-business-rules.md) and [15-booking-state-machine.md](./15-booking-state-machine.md).

---

## 4. Primary Actors

| Actor | Description |
|-------|-------------|
| **Team Captain** | Represents a team; books fields, invites opponents, pays, manages squad |
| **Stadium Owner** | Owns stadiums; manages fields, pricing, availability, revenue |
| **Stadium Manager** | Scoped delegate of an owner (not a system-wide role) |
| **Team Member / Player** | Squad member; scoped to a team |
| **Admin** | Platform operations manager (daily ops, disputes, verification) |
| **Super Admin** | System owner / root authority (admins, commission, platform config) |

Details: [06-roles-permissions.md](./06-roles-permissions.md).

---

## 5. Technology Stack

### Frontend (spec target)

React, Vite, JavaScript, Tailwind CSS, Redux Toolkit, React Router, React Hook Form, Zod, Axios, Socket.IO Client, Lucide React, Sonner.

### Backend

Node.js, Express.js, JavaScript, MongoDB, Mongoose, Redis, Socket.IO, JWT, bcrypt, crypto, validator, Helmet, CORS, rate limiting.

### Infrastructure (target)

Git, GitHub, AWS, Nginx, PM2, HTTPS.

### Payments (target)

WaafiPay and DahabPay via a **PaymentProvider adapter pattern**.

---

## 6. Current Implementation Status

The repository contains a **Phase 1 MVP scaffold** (see [17-development-plan.md](./17-development-plan.md)):

| Area | Status |
|------|--------|
| Auth (JWT + refresh cookie), RBAC (4 roles) | Implemented |
| Teams, stadiums, fields, availability blocks | Implemented |
| Booking hold + Team A/B invite + payment lifecycle | Implemented |
| Redis slot locks + MongoDB partial unique index | Implemented |
| Payment/escrow scaffolding (mock provider) | Implemented |
| Commission settlement math (4%) | Implemented |
| Recurring bookings, discounts, blocked slots | Implemented |
| Scheduled cron jobs (hold expiry, match advance, settlement) | Implemented |
| Tournament (groups, fixtures, standings, registration) | Implemented (basic; advanced knockout partial) |
| Client: search, book, pay, match pass QR, dashboards | Implemented |
| Stadium manager (scoped invite) | Implemented |
| Site content CMS (hero, about, contact) | Implemented |
| WaafiPay / DahabPay live adapters | Planned (stubs ready; needs credentials) |
| No-show detection, disputes, refunds | Planned |
| Audit logs | Planned |
| API versioning `/api/v1/*` | Planned (current: `/api`) |
| Unit/E2E tests + AWS deployment | Planned |

See [13-folder-architecture.md](./13-folder-architecture.md) for implementation drift notes (e.g. `react-hot-toast` vs Sonner).

---

## 7. Document Map

| Document | Purpose |
|----------|---------|
| [02-requirements.md](./02-requirements.md) | Functional & non-functional requirements index |
| [03-srs.md](./03-srs.md) | Software Requirements Specification |
| [04-use-cases.md](./04-use-cases.md) | UC-001 – UC-030 |
| [05-business-rules.md](./05-business-rules.md) | BR-001 – BR-015 |
| [06-roles-permissions.md](./06-roles-permissions.md) | Roles, permissions, admin matrix |
| [07-acceptance-criteria.md](./07-acceptance-criteria.md) | Given/When/Then criteria |
| [08-hld.md](./08-hld.md) | High-level design |
| [09-lld.md](./09-lld.md) | Low-level design |
| [10-database-design.md](./10-database-design.md) | Collections, indexes, relationships |
| [11-api-contract.md](./11-api-contract.md) | REST API contract |
| [12-security-design.md](./12-security-design.md) | Security architecture |
| [13-folder-architecture.md](./13-folder-architecture.md) | Repo layout (target + current) |
| [14-payment-design.md](./14-payment-design.md) | Payments, escrow, settlement |
| [15-booking-state-machine.md](./15-booking-state-machine.md) | Booking & payment states |
| [16-tournament-design.md](./16-tournament-design.md) | Tournament system |
| [17-development-plan.md](./17-development-plan.md) | Phased build plan |
| [MASTER-AI-PROMPT.md](./MASTER-AI-PROMPT.md) | AI assistant master prompt |

---

## 8. Brand & UI

Working brand palette (implemented in client):

- Forest Green `#176B45`, Warm White `#F7F6F1`, Charcoal `#18201C`, Olive `#6B8E3A`, Muted Orange `#D98A3A`

Final product name may change; documentation uses **E-GAROON** until decided.
