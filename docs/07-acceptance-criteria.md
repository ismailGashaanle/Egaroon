# E-GAROON — Acceptance Criteria

**Version:** 1.0  
**Related:** [04-use-cases.md](./04-use-cases.md), [05-business-rules.md](./05-business-rules.md)

Format: **Given / When / Then**

---

## Authentication

### AC-AUTH-001 — Registration

**Given** a guest with valid credentials  
**When** they submit registration as Team Captain  
**Then** an account is created with role `team_captain` and password is stored hashed (not plaintext).

### AC-AUTH-002 — Protected routes

**Given** an unauthenticated client  
**When** they call a protected API  
**Then** the server returns 401.

---

## Booking — Hold

### AC-BOOK-001 — Temporary hold

**Given** field `Field 2` is available on Friday 8:00–9:00 PM  
**When** Team Captain (Team A) creates a booking for that slot  
**Then** the system creates a booking in `HELD` status, acquires a Redis lock, and the slot is unavailable to other users.

### AC-BOOK-002 — Hold expiry

**Given** a booking in `HELD` status  
**When** the hold duration (default 10 minutes) elapses without required payment  
**Then** booking transitions to `EXPIRED`, Redis lock is released, and the slot becomes available again.

### AC-BOOK-003 — Concurrent booking prevention

**Given** two captains attempt to book the same field and overlapping time simultaneously  
**When** both requests reach the server  
**Then** exactly one succeeds; the other receives a conflict error (409).

---

## Team B invitation & payment

### AC-BOOK-004 — Team B invitation

**Given** Team A has created a booking  
**When** Team A invites Team B by team ID  
**Then** Team B receives an invitation and has the configured time (default 10 minutes) to pay.

### AC-BOOK-005 — Team B payment timeout

**Given** Team B was invited  
**When** Team B does not pay before the deadline  
**Then** invitation expires, hold is released, and slot returns to available.

---

## Payment verification

### AC-PAY-001 — No client payment trust

**Given** a client sends `{ "paymentStatus": "SUCCESS" }` without provider verification  
**When** the backend processes the request  
**Then** payment status is **not** updated to success.

### AC-PAY-002 — Webhook verification

**Given** a valid signed webhook from WaafiPay or DahabPay  
**When** the webhook handler processes it  
**Then** payment status updates to verified success/held and the operation is idempotent on duplicate delivery.

---

## Booking confirmation

### AC-BOOK-006 — Dual payment confirmation

**Given** Team A payment = SUCCESS (verified)  
**And** Team B payment = SUCCESS (verified)  
**When** the booking service evaluates state  
**Then** booking status = `CONFIRMED`.

### AC-BOOK-007 — Match features enabled

**Given** booking status = `CONFIRMED`  
**And** both team payments verified  
**When** Team Captain requests lineup management  
**Then** the system allows lineup, formation, and positions operations.

### AC-BOOK-008 — Match features blocked pre-confirmation

**Given** booking status is `PAYMENT_PENDING` or `HELD`  
**When** Team Captain requests lineup management  
**Then** the system returns 403 with a clear precondition message.

---

## Pricing

### AC-PRICE-001 — Server-side calculation (per player)

**Given** field pricing mode = `PER_PLAYER`, price = $1/player, 11 players  
**When** Team A initiates payment  
**Then** Team A amount = $11 (server-calculated, not client-supplied).

### AC-PRICE-002 — Client price ignored

**Given** client sends a manipulated total in the request body  
**When** payment is created  
**Then** server uses authoritative field pricing and player count.

---

## Check-in & match completion

### AC-MATCH-001 — QR check-in

**Given** booking is `CONFIRMED`  
**When** valid QR from Digital Match Pass is scanned at stadium  
**Then** booking transitions to `CHECKED_IN`.

### AC-MATCH-002 — No-show review

**Given** match start was 7:00 PM with 15-minute grace  
**And** Team A checked in, Team B did not  
**When** grace period ends  
**Then** system flags `NO_SHOW_REVIEW` (not automatic payout without policy).

---

## Settlement & payout

### AC-PAY-003 — Commission calculation

**Given** total collected = $22, commission = 4%  
**When** settlement runs  
**Then** platform commission = $0.88 and owner share = $21.12 (before provider fees).

### AC-PAY-004 — Payout delay

**Given** match ended at 8:00 PM  
**And** settlement safety window = 75 minutes  
**When** current time is before 9:15 PM  
**Then** owner payout is not yet eligible.

### AC-PAY-005 — Disputed booking

**Given** booking is `DISPUTED`  
**When** payout job runs  
**Then** owner payout is skipped (BR-010).

---

## Availability blocks

### AC-AVAIL-001 — Blocked slot

**Given** Field 2 is blocked Aug 25 7–11 PM for MAINTENANCE  
**When** captain searches availability  
**Then** those slots show as unavailable and cannot be booked.

---

## Tournament

### AC-TOURN-001 — Slot blocking

**Given** tournament "Ramadan Cup 2027" reserves Field 1 on listed dates  
**When** a captain attempts public booking on a reserved slot  
**Then** booking is rejected.

---

## Admin

### AC-ADMIN-001 — Stadium verification

**Given** admin user  
**When** they verify a stadium  
**Then** stadium appears in public search (per verification rules).

### AC-ADMIN-002 — Admin cannot create Super Admin

**Given** admin user  
**When** they attempt to assign `super_admin` role  
**Then** server returns 403.

---

## Security

### AC-SEC-001 — Cross-owner isolation

**Given** Stadium Owner A  
**When** they attempt to PATCH Stadium Owner B's stadium  
**Then** server returns 403.

### AC-SEC-002 — IDOR prevention

**Given** Team Captain A  
**When** they request Team Captain B's booking by ID  
**Then** server returns 403 or 404 (no data leak).
