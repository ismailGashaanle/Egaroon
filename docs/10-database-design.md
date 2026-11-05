# E-GAROON — Database Design

**Version:** 1.0  
**Database:** MongoDB (Mongoose ODM)  
**Related:** [09-lld.md](./09-lld.md), [15-booking-state-machine.md](./15-booking-state-machine.md)

---

## 1. Design Principles

- MongoDB is the **persistent source of truth**; Redis is ephemeral.
- Booking and payment states live on **separate documents**.
- Financial amounts stored in smallest currency unit or Decimal128 — be consistent project-wide.
- Partial unique indexes enforce booking uniqueness for live statuses.
- Soft-delete where audit trail matters (users, stadiums); hard-delete for drafts.

---

## 2. Entity Relationship Overview

```text
User ──┬── owns ──► Team (captain)
       ├── owns ──► Stadium (owner)
       └── role ──► admin | super_admin

Stadium ──► Field (1:N)
Field ──► AvailabilityBlock (1:N)
Field ──► RecurringBooking (1:N)
Field ──► Booking (1:N)

Booking ──► Payment (1:N, typically 2: Team A + Team B)
Booking ──► Lineup (1:2, one per team)
Booking ──► Settlement (1:1)

Tournament ──► TournamentTeam (N:M via join)
Tournament ──► Group ──► Fixture ──► Standing
Tournament ──► AvailabilityBlock (reserved slots)

Payment ──► Transaction / LedgerEntry
Settlement ──► Payout
```

---

## 3. Collections

### users

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `email` | String | unique, indexed |
| `phone` | String | optional, sparse unique |
| `passwordHash` | String | bcrypt; optional for Google-only accounts |
| `googleId` | String | sparse unique; Google `sub` |
| `authProviders` | String[] | `local` and/or `google` |
| `firstName`, `lastName` | String | |
| `role` | Enum | team_captain, stadium_owner, admin, super_admin |
| `status` | Enum | active, suspended |
| `createdAt`, `updatedAt` | Date | |

**Indexes:** `{ email: 1 }` unique; `{ role: 1, status: 1 }`

---

### teams

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | |
| `captain` | ObjectId | ref users |
| `logoUrl` | String | |
| `status` | Enum | draft, active |
| `players` | Array | embedded or ref teamMembers |

**Indexes:** `{ captain: 1 }`; `{ name: 1 }` (optional text search)

---

### teamMembers (optional normalized)

| Field | Type |
|-------|------|
| `team` | ObjectId |
| `user` | ObjectId |
| `displayName` | String |
| `jerseyNumber` | Number |

---

### stadiums

| Field | Type | Notes |
|-------|------|-------|
| `owner` | ObjectId | ref users |
| `name`, `description` | String | |
| `city`, `region`, `area` | String | |
| `location` | GeoJSON Point | 2dsphere index |
| `images` | [String] | URLs |
| `facilities` | [String] | |
| `contactPhone` | String | |
| `openingHours` | Object | |
| `verified` | Boolean | admin verification |
| `status` | Enum | active, suspended |

**Indexes:** `{ city: 1, verified: 1 }`; `{ location: '2dsphere' }`

---

### stadiumManagers

| Field | Type |
|-------|------|
| `stadium` | ObjectId |
| `user` | ObjectId |
| `permissions` | [String] |
| `invitedBy` | ObjectId |

---

### fields

| Field | Type | Notes |
|-------|------|-------|
| `stadium` | ObjectId | |
| `name` | String | |
| `type` | String | 5v5, 7v7, 11v11 |
| `capacity` | Number | max players |
| `images` | [String] | |
| `pricingMode` | Enum | per_player, fixed_field |
| `pricePerPlayer` | Number | |
| `fixedPrice` | Number | |
| `workingHours` | Object | per weekday |
| `status` | Enum | active, inactive |
| `isOnline` | Boolean | default true — field open for public booking |
| `offlineFrom` / `offlineUntil` | Date | optional scheduled closed window |
| `offlineReason` | String | optional |

**Indexes:** `{ stadium: 1 }`

---

### availabilityBlocks

| Field | Type | Notes |
|-------|------|-------|
| `field` | ObjectId | |
| `startTime`, `endTime` | Date | |
| `reason` | Enum | MAINTENANCE, RAIN, PRIVATE_EVENT, HOLIDAY, TOURNAMENT, OWNER_BLOCK |
| `note` | String | |
| `createdBy` | ObjectId | |

**Indexes:** `{ field: 1, startTime: 1, endTime: 1 }`

---

### recurringBookings

| Field | Type |
|-------|------|
| `field` | ObjectId |
| `team` | ObjectId |
| `frequency` | Enum: weekly, biweekly, monthly |
| `dayOfWeek` | Number |
| `startTimeLocal` | String (`HH:mm` venue wall clock as UTC hours, not EAT-converted) |
| `durationMinutes` | Number |
| `startDate`, `endDate` | Date |

---

### bookings

| Field | Type | Notes |
|-------|------|-------|
| `field` | ObjectId | |
| `stadium` | ObjectId | denormalized |
| `teamA`, `teamB` | ObjectId | |
| `captainA`, `captainB` | ObjectId | |
| `startTime`, `endTime` | Date | |
| `playerCount` | Number | |
| `pricingSnapshot` | Object | server-calculated at creation |
| `status` | Enum | see state machine |
| `holdExpiresAt` | Date | |
| `teamBInviteExpiresAt` | Date | |
| `bookingCode` | String | for QR |
| `checkedInAt` | Object | { teamA, teamB } |

**Critical index — partial unique (live bookings):**

```javascript
db.bookings.createIndex(
  { field: 1, startTime: 1, endTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          'HELD', 'PAYMENT_PENDING', 'PARTIALLY_PAID',
          'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
          'COMPLETED', 'SETTLEMENT_PENDING'
        ]
      }
    }
  }
)
```

**Additional indexes:** `{ teamA: 1, status: 1 }`; `{ teamB: 1, status: 1 }`; `{ holdExpiresAt: 1 }` (TTL job queries)

---

### bookingParticipants

Optional normalized join if booking embed becomes heavy.

---

### payments

| Field | Type | Notes |
|-------|------|-------|
| `booking` | ObjectId | |
| `team` | ObjectId | Team A or B |
| `payer` | ObjectId | captain user |
| `amount` | Number | server-calculated |
| `currency` | String | default USD/local |
| `provider` | Enum | mock, waafipay, dahabpay |
| `providerRef` | String | external ID |
| `status` | Enum | see payment state machine |
| `idempotencyKey` | String | unique |
| `webhookEvents` | [String] | processed event IDs |

**Indexes:** `{ booking: 1, team: 1 }`; `{ idempotencyKey: 1 }` unique; `{ providerRef: 1 }`

---

### transactions / ledgerEntries

Append-only financial audit:

| Field | Type |
|-------|------|
| `type` | Enum: payment_in, commission, payout, refund |
| `amount` | Number |
| `booking` | ObjectId |
| `payment` | ObjectId |
| `metadata` | Object |

---

### settlements

| Field | Type |
|-------|------|
| `booking` | ObjectId | unique |
| `grossAmount` | Number |
| `commissionAmount` | Number |
| `ownerAmount` | Number |
| `providerFee` | Number |
| `status` | Enum |
| `settledAt` | Date |

---

### payouts

| Field | Type |
|-------|------|
| `settlement` | ObjectId |
| `owner` | ObjectId |
| `amount` | Number |
| `status` | Enum: pending, processing, paid, failed |
| `eligibleAt` | Date |
| `paidAt` | Date |

---

### tournaments

| Field | Type |
|-------|------|
| `stadium` | ObjectId |
| `owner` | ObjectId |
| `name` | String |
| `format` | Enum |
| `registrationFee` | Number |
| `maxTeams` | Number |
| `startDate`, `endDate` | Date |
| `registrationDeadline` | Date |
| `rules`, `prize` | Object |
| `status` | Enum |

---

### tournamentTeams, groups, fixtures, standings, lineups

Booking match lineups (`Lineup` collection): `{ booking, team, captain, formation, capacity, published (default true), players[] }`. Unique on `(booking, team)` — **Team A and Team B each have their own doc** for the same booking. Player `photoUrl` stores Cloudinary/http(s) URLs (not base64). Docs are **hard-deleted when the match ends** (BR-007d). See BR-007 / BR-007b2 / BR-007c / BR-007d.

Tournament bracket lineups: see [16-tournament-design.md](./16-tournament-design.md).

---

### reviews, disputes, refunds, discounts, notifications, auditLogs

Standard CRUD collections with `{ createdAt: 1 }`, foreign keys to users/bookings, and status enums. `auditLogs` append-only: `{ actor, action, resource, before, after, ip, timestamp }`.

---

## 4. Relationships Summary

| From | To | Cardinality |
|------|-----|-------------|
| User | Team | 1:N (as captain) |
| User | Stadium | 1:N (as owner) |
| Stadium | Field | 1:N |
| Field | Booking | 1:N |
| Booking | Payment | 1:N |
| Booking | Settlement | 1:1 |
| Tournament | Field blocks | 1:N |

---

## 5. MVP Collections (Implemented)

All core Mongoose models are present in `server/src/models/`. As of August 2026:

| Model | Status |
|-------|--------|
| `User` | ✅ |
| `Team` | ✅ |
| `Stadium` | ✅ |
| `Field` | ✅ |
| `AvailabilityBlock` | ✅ |
| `RecurringBooking` | ✅ |
| `Discount` | ✅ |
| `Booking` | ✅ |
| `Payment` | ✅ |
| `Lineup` | ✅ |
| `Tournament` | ✅ |
| `TournamentTeam` | ✅ |
| `Fixture` | ✅ |
| `Notification` | ✅ |
| `OtpCode` | ✅ |
| `PlatformSettings` | ✅ |
| `FieldSubscriptionPeriod` | ✅ |
| `SiteContent` | ✅ |
| `OwnerOnboarding` | ✅ |
| `StadiumManager` | ✅ |
| `FreeMatchCampaign` | ✅ |
| `FreeMatchEntry` | ✅ |

**Not yet implemented:** `Transaction/LedgerEntry`, `Settlement`, `Payout`, `Dispute`, `Review`, `AuditLog`, `Group`, `Standing` — planned for Phase 9+.

---

## 6. Migration Notes

- When adding `/api/v1`, no DB migration required.
- Adding permission RBAC may require `permissions[]` on users or separate `rolePermissions` collection.
- Move from embedded players to `teamMembers` if roster grows large.
- `User.deletedAt` soft-delete; Platform Settings gains field subscription fields; commission snapshots live on Booking/Payment.
