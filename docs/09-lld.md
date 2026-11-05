# E-GAROON — Low-Level Design (LLD)

**Version:** 1.0  
**Related:** [08-hld.md](./08-hld.md), [10-database-design.md](./10-database-design.md), [11-api-contract.md](./11-api-contract.md)

---

## 1. Request Lifecycle

```text
HTTP Request
  → helmet, cors, rateLimiter
  → body parser + validator
  → authenticate (JWT)
  → authorize (role)
  → checkOwnership (resource)
  → controller.method
  → service.method
  → model / repository
  → response | error middleware
```

---

## 2. Booking Module

### Class / module flow

```text
BookingController
       ↓
BookingService
       ├── AvailabilityService.isSlotAvailable()
       ├── PricingService.calculateTeamShare()
       ├── RedisLockService.acquire(fieldId, startTime)
       ├── BookingRepository.create()
       └── SocketService.emit('booking:updated')
       ↓
MongoDB (bookings)
```

### Key methods (BookingService)

| Method | Description |
|--------|-------------|
| `createBooking(actor, payload)` | Validate → lock → create HELD |
| `inviteTeamB(bookingId, teamBId)` | Attach Team B; start B payment window |
| `evaluatePaymentImpact(payment)` | Transition booking on verified payment |
| `cancelBooking(actor, bookingId)` | Cancel per state rules |
| `checkIn(actor, bookingId, qrPayload)` | QR validation → CHECKED_IN |
| `advanceMatchLifecycle()` | Job: IN_PROGRESS → COMPLETED |
| `expireStaleHolds()` | Job: HELD/PAYMENT_PENDING → EXPIRED |

### Redis lock

```javascript
// Key pattern
`slot-lock:${fieldId}:${isoStartTime}`

// Acquire: SET NX EX 600 (10 min default)
// Release: DEL on expiry, cancel, or confirm
```

---

## 3. Payment Module

```text
PaymentController
       ↓
PaymentService
       ├── PaymentProviderFactory.get(providerName)
       │        ├── WaafiPayAdapter
       │        └── DahabPayAdapter
       ├── createPaymentIntent(booking, team, amount)
       ├── handleWebhook(provider, payload, signature)
       ├── confirmPaymentSuccess(paymentId)  // internal after verify
       └── SettlementService.settle(bookingId)
       ↓
MongoDB (payments, transactions, settlements)
```

### PaymentProvider interface (conceptual)

```javascript
// providers/payment/PaymentProvider.js
{
  name: 'waafipay' | 'dahabpay' | 'mock',
  createIntent({ amount, currency, metadata, returnUrl }),
  verifyWebhook(headers, rawBody),
  parseWebhookEvent(rawBody),
  refund(paymentRef, amount),
}
```

**Rule:** No `waafiPaySpecificCode` inside BookingService.

---

## 4. Availability Module

```text
AvailabilityService
  ├── getWorkingHours(field, date)
  ├── getBlocks(field, dateRange)
  ├── getRecurringReservations(field, dateRange)
  ├── getTournamentHolds(field, dateRange)
  ├── getLiveBookings(field, dateRange)
  └── computeSlots(field, date) → [{ start, end, status }]
```

Slot status values: `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`, `TOURNAMENT`.

---

## 5. Team Module

```text
TeamService
  ├── createTeam(captainId, data) → status: DRAFT
  ├── activateTeam(teamId) → after booking/payment rules
  ├── addPlayer / removePlayer
  └── LineupService (gated by Feature Permission)
```

---

## 6. Tournament Module

```text
TournamentService
  ├── createTournament(ownerId, config)
  ├── reserveSlots(tournamentId) → availabilityBlocks
  ├── registerTeam(tournamentId, teamId)
  ├── generateGroups / generateFixtures
  ├── recordResult(fixtureId, score)
  └── StandingsService.recalculate(groupId)
```

See [16-tournament-design.md](./16-tournament-design.md).

---

## 7. Auth Module

```text
AuthService
  ├── register(data, role)
  ├── login(credentials) → { accessToken } + set refresh cookie
  ├── refresh(refreshToken) → rotate tokens
  ├── logout(userId) → revoke refresh
  └── hashPassword / comparePassword (bcrypt)
```

JWT payload (minimal): `{ sub: userId, role }` — no permissions blob in token (load from DB when permission RBAC added).

---

## 8. Error Handling

Centralized error middleware:

| Code | When |
|------|------|
| 400 | Validation failure |
| 401 | Missing/invalid token |
| 403 | Role, ownership, or business rule denial |
| 404 | Resource not found |
| 409 | Booking conflict / duplicate |
| 422 | Business rule violation |
| 429 | Rate limit |
| 500 | Unexpected (logged, generic message to client) |

---

## 9. Validation Layer

- Route-level: `express-validator` or Joi schemas in `validators/`
- Model-level: Mongoose schema validators
- Service-level: business preconditions (payment gates, state checks)

---

## 10. Background Jobs (Target)

| Job | Schedule | Action |
|-----|----------|--------|
| `expireStaleHolds` | Every 1 min | EXPIRED bookings, release locks |
| `advanceBookings` | Every 5 min | CHECKED_IN → IN_PROGRESS → COMPLETED |
| `processSettlements` | Every 15 min | COMPLETED → SETTLED after safety window |
| `processPayouts` | Every 15 min | Transfer owner funds |
| `sendReminders` | Hourly | Match reminders |

**MVP:** Manual admin endpoints for hold expiry and settlement.

---

## 11. Socket.IO Design

```text
sockets/
  index.js          — attach to HTTP server, auth middleware
  bookingHandlers.js
  availabilityHandlers.js
```

Rooms:
- `user:{userId}`
- `field:{fieldId}`
- `booking:{bookingId}`

---

## 12. Idempotency (Payments)

Webhook handler stores provider event ID:

```text
IF eventId already processed → 200 OK, no-op
ELSE process in transaction → mark eventId processed
```

---

## 13. Current MVP Alignment

The repository implements the flows above in a flatter structure (`controllers/`, `services/`, `models/`) without separate `repositories/` or `modules/` directories. Refactor toward modular layout is planned — see [13-folder-architecture.md](./13-folder-architecture.md).
