# E-GAROON — Use Cases

**Version:** 1.0  
**Related:** [03-srs.md](./03-srs.md), [06-roles-permissions.md](./06-roles-permissions.md), [07-acceptance-criteria.md](./07-acceptance-criteria.md)

---

## UC-001 — Register

| Field | Value |
|-------|-------|
| **Actor** | Guest |
| **Preconditions** | Valid email/phone not already registered |
| **Postconditions** | User account created; default role `team_captain`. `stadium_owner` only if Super Admin enabled `publicOwnerSignup`. |
| **Main flow** | 1. User submits email/password **or** Google → 2. Server validates; role from Platform Settings not client → 3. Password hashed if local (bcrypt) → 4. User record created → 5. Session issued |
| **Alternates** | Duplicate email → 409; validation failure → 400; owner role while flag off → 403 `PUBLIC_OWNER_SIGNUP_DISABLED` |
| **Business rules** | BR-001 (auth required for bookings); public registration defaults to captain (BR-015a / `publicOwnerSignup`) |

---

## UC-002 — Login

| Field | Value |
|-------|-------|
| **Actor** | Registered user |
| **Main flow** | Email/password **or** Google OAuth → access JWT issued → refresh token in httpOnly cookie |
| **Alternates** | Invalid credentials → 401; Google-only account using password → 401 `PASSWORD_NOT_SET`; suspended account → 403 |

---

## UC-003 — Create Team

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Main flow** | Captain creates team (name, logo) → team in **Draft** until payment/booking preconditions met → becomes **Active** |
| **Business rules** | Team draft vs active team ([01-project-overview.md](./01-project-overview.md)); BR-007 for match features |

---

## UC-004 — Manage Team

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Main flow** | Add/remove players, update logo, edit team info |
| **Preconditions** | Captain owns team |

---

## UC-005 — Search Stadium

| Field | Value |
|-------|-------|
| **Actor** | Team Captain (or guest for public listing) |
| **Main flow** | Filter by city, region, facilities → paginated results |
| **Postconditions** | Only verified stadiums shown in production search (admin verification) |

---

## UC-006 — View Field

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Main flow** | View field details: type, capacity, images, pricing mode, working hours |

---

## UC-007 — Check Availability

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Main flow** | Select date → system returns available slots excluding bookings, blocks, recurring reservations, tournament holds |
| **Business rules** | BR-012 (blocked slots); BR-011 (tournament slots) |

---

## UC-008 — Create Booking

| Field | Value |
|-------|-------|
| **Actor** | Team Captain (Team A) |
| **Preconditions** | Authenticated; team exists; slot available; no conflict |
| **Main flow** | Select field, date, time, player count → Redis lock → booking HELD → Team A payment initiated |
| **Postconditions** | Slot temporarily unavailable; hold TTL started (default 10 min) |
| **Business rules** | BR-002, BR-003, BR-004 |

---

## UC-009 — Invite Team B

| Field | Value |
|-------|-------|
| **Actor** | Team Captain (Team A) |
| **Preconditions** | Booking exists; Team A paid or hold active per rules |
| **Main flow** | Enter Team B ID → invitation sent → Team B payment deadline starts |
| **Alternates** | Invalid team → 404; same team as A → 400 |

---

## UC-010 — Pay Booking

| Field | Value |
|-------|-------|
| **Actor** | Team Captain (Team A or B) |
| **Main flow** | Create payment intent → redirect/SDK to WaafiPay/DahabPay → await webhook |
| **Business rules** | BR-008; never trust client payment status |

---

## UC-011 — Confirm Payment

| Field | Value |
|-------|-------|
| **Actor** | System (webhook handler) |
| **Main flow** | Verify webhook signature → idempotent update → payment SUCCESS/HELD → evaluate booking transition |
| **Business rules** | NFR-007 |

---

## UC-012 — Confirm Booking

| Field | Value |
|-------|-------|
| **Actor** | System |
| **Preconditions** | Team A and Team B payments verified |
| **Postconditions** | Booking CONFIRMED; lineup/formation/positions enabled |
| **Business rules** | BR-006, BR-007 |

---

## UC-013 — Manage Lineup

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Preconditions** | Booking CONFIRMED; both payments verified |
| **Main flow** | Set formation, starting XI, substitutes, player positions |
| **Alternates** | Precondition not met → 403 with clear reason |

---

## UC-014 — Check In

| Field | Value |
|-------|-------|
| **Actor** | Team Captain or Stadium Manager |
| **Main flow** | Scan QR on Digital Match Pass → booking CHECKED_IN |
| **Related** | FR-019, FR-018 |

---

## UC-015 — Complete Match

| Field | Value |
|-------|-------|
| **Actor** | System / Stadium Manager |
| **Main flow** | Match end time passed → IN_PROGRESS → COMPLETED → SETTLEMENT_PENDING |
| **Postconditions** | Eligible for settlement after safety window |

---

## UC-016 — Create Recurring Booking

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner |
| **Main flow** | Define team, field, schedule (weekly/biweekly/monthly), start/end dates → slots reserved |
| **Example** | Doctors FC every Friday 8–9 PM |

---

## UC-017 — Create Discount

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner |
| **Main flow** | Define time window + percentage → server-side price calculation applies discount |
| **Example** | Mon–Fri 2–5 PM 20% off; Ramadan 15% |

---

## UC-018 — Block Field

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner / Manager |
| **Main flow** | Block field for date/time range with reason (MAINTENANCE, RAIN, PRIVATE_EVENT, HOLIDAY, TOURNAMENT, OWNER_BLOCK) |
| **Business rules** | BR-012 |

---

## UC-019 — Create Tournament

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner |
| **Main flow** | Configure name, fees, dates, format → reserve fields → block public slots |
| **Related** | [16-tournament-design.md](./16-tournament-design.md) |

---

## UC-020 — Register Tournament Team

| Field | Value |
|-------|-------|
| **Actor** | Team Captain |
| **Main flow** | Register team before deadline → pay registration fee |

---

## UC-021 — Generate Fixtures

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner / System |
| **Main flow** | Group stage and/or knockout bracket generated from registered teams |

---

## UC-022 — Record Match Result

| Field | Value |
|-------|-------|
| **Actor** | Stadium Owner / Admin |
| **Main flow** | Enter scores → update standings / advance knockout |

---

## UC-023 — Calculate Standings

| Field | Value |
|-------|-------|
| **Actor** | System |
| **Main flow** | Update P, W, D, L, GF, GA, GD, PTS per group |

---

## UC-024 — Handle Dispute

| Field | Value |
|-------|-------|
| **Actor** | Admin |
| **Main flow** | Review evidence → resolve → may block payout (BR-010) |

---

## UC-025 — Process Settlement

| Field | Value |
|-------|-------|
| **Actor** | System / Admin |
| **Main flow** | After match COMPLETED + safety window → compute gross, commission, owner amount |
| **Business rules** | BR-009 |

---

## UC-026 — Process Payout

| Field | Value |
|-------|-------|
| **Actor** | System |
| **Preconditions** | Not disputed; settlement complete |
| **Main flow** | Transfer owner share after configurable delay (default 75 min post match end) |

---

## UC-027 — Review Reports

| Field | Value |
|-------|-------|
| **Actor** | Admin / Super Admin |
| **Main flow** | View platform reports: bookings, revenue, users, disputes |

---

## UC-028 — Manage Users

| Field | Value |
|-------|-------|
| **Actor** | Admin |
| **Main flow** | List users, suspend/activate accounts |

---

## UC-029 — Manage Admins

| Field | Value |
|-------|-------|
| **Actor** | Super Admin |
| **Main flow** | Create/delete admin accounts, assign roles |
| **Business rules** | BR-014 (Admin cannot create Super Admin) |

---

## UC-030 — Manage Permissions

| Field | Value |
|-------|-------|
| **Actor** | Super Admin |
| **Main flow** | Configure permission-level RBAC beyond default role bundles |
| **Status** | Planned (current MVP: role-level only)
