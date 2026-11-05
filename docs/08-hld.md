# E-GAROON — High-Level Design (HLD)

**Version:** 1.0  
**Related:** [09-lld.md](./09-lld.md), [13-folder-architecture.md](./13-folder-architecture.md)

---

## 1. System Context

E-GAROON is a web platform connecting football teams with stadium owners. External systems: WaafiPay, DahabPay, MongoDB, Redis, email/SMS providers (future).

---

## 2. Architecture Diagram

```text
                     CLIENT
                       │
                    React SPA
                       │
                    HTTPS
                       │
                     Nginx
                       │
              Node.js / Express
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   Auth Service    Booking Service   Payment Service
       │               │                │
       │              Redis            Providers
       │               │             ┌────┴────┐
       │            MongoDB       WaafiPay DahabPay
       │
       ├── Team Service
       ├── Stadium Service
       ├── Tournament Service
       ├── Notification Service
       ├── Dispute Service
       └── Admin Service
                       │
                   Socket.IO
                       │
                    Clients
```

---

## 3. Layered Architecture

```text
Presentation   →  React (pages, components, Redux)
API Gateway    →  Express routes + middleware
Application    →  Services (business logic)
Domain         →  Models, constants, state machines
Infrastructure →  MongoDB, Redis, payment adapters, Socket.IO
```

**Rule:** Controllers are thin; services contain business logic (NFR-008).

---

## 4. Core Modules

| Module | Responsibility |
|--------|----------------|
| Auth | Register, login, JWT, refresh, sessions |
| Users | Profiles, status, role assignment |
| Teams | CRUD, roster, draft/active state |
| Stadiums | Venue metadata, verification |
| Fields | Per-field config, pricing, capacity |
| Availability | Rules, blocks, recurring, slot computation |
| Bookings | Hold, invite, lifecycle, check-in |
| Payments | Intents, webhooks, escrow, receipts |
| Payouts / Settlements | Commission, owner payout timing |
| Tournaments | Registration, groups, fixtures, standings |
| Notifications | Socket.IO + async channels |
| Reviews | Post-match ratings |
| Disputes | Conflict resolution |
| Reports | Admin analytics |
| Admin / Audit | Operations, audit trail |
| Uploads | Images (stadium, field, team logo) |

---

## 5. Data Flow — Booking & Payment

```text
Captain → POST /bookings
       → AvailabilityService (slot free?)
       → RedisLockService (acquire)
       → BookingService (create HELD)
       → MongoDB (persist)
       → Socket.IO (slot unavailable)

Captain → POST /payments
       → PaymentService → Provider adapter
       → Provider UI / redirect

Provider → POST /webhooks/payment
        → Verify signature
        → PaymentService (idempotent update)
        → BookingService (evaluate transition)
        → Socket.IO (payment:received, booking:updated)
```

---

## 6. Separation of Concerns

Three independent layers (core principle):

```text
Payment Status   (payments collection)
Booking Status   (bookings collection)
Feature Permission (computed in service layer)
```

Example: payment may be SUCCESS while booking is still PAYMENT_PENDING (waiting for Team B).

---

## 7. Real-Time (Socket.IO)

| Event | Trigger | Subscribers |
|-------|---------|-------------|
| `booking:updated` | State change | Booking participants, field room |
| `payment:received` | Verified payment | Team A captain |
| `availability:changed` | Hold/block/tournament | Field room |
| `notification:*` | Various | User room |

Authentication: socket handshake with access JWT.

---

## 8. Redis Usage

| Use | Pattern |
|-----|---------|
| Booking lock | `lock:field:{fieldId}:{date}:{startTime}` TTL 10m |
| Rate limiting | Token bucket per IP/user |
| Cache | Hot stadium listings (optional) |
| Session revocation | Refresh token blocklist (optional) |
| Job queues | BullMQ for expiry/settlement (planned) |

**MongoDB = source of truth. Redis = ephemeral coordination.**

---

## 9. Deployment Topology (Target)

```text
Internet → Nginx (TLS) → PM2 cluster (Node workers)
                              ├── MongoDB (replica set)
                              ├── Redis
                              └── S3 (images, optional)
```

Horizontal scaling: stateless API instances behind load balancer; sticky sessions not required for REST; Socket.IO may need Redis adapter for multi-node.

---

## 10. MVP vs Target

| Aspect | MVP (current) | Target |
|--------|---------------|--------|
| API prefix | `/api` | `/api/v1` |
| Payment | Mock provider | WaafiPay + DahabPay |
| Jobs | Manual admin endpoints | Cron / BullMQ |
| Modules | Flat controllers/services | Modular `modules/` layout |
| RBAC | Role-only | Role + permission |

See [17-development-plan.md](./17-development-plan.md).
