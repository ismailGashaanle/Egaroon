# E-GAROON — Roles & Permissions

**Version:** 1.0  
**Related:** [05-business-rules.md](./05-business-rules.md), [12-security-design.md](./12-security-design.md)

---

## 1. Role Hierarchy

### System-wide primary roles

```text
1. TEAM_CAPTAIN
2. STADIUM_OWNER
3. ADMIN
4. SUPER_ADMIN
```

### Scoped roles (not system-wide)

```text
STADIUM_MANAGER   — delegated by Stadium Owner per stadium
TEAM_MEMBER       — player on a team roster
```

Public self-registration **defaults to `team_captain`**. Super Admin can turn **`publicOwnerSignup`** on in Platform Settings so the public register form (and Google OAuth) may also create `stadium_owner`. When that flag is off (default), `POST /auth/register` with `role=stadium_owner` returns **403** `PUBLIC_OWNER_SIGNUP_DISABLED`. Admin, Super Admin, and stadium manager are never self-created. Stadium owners are normally provisioned via `POST /api/admin/users` or `/api/admin/owner-onboardings`. Users may sign in with **email/password or Google**; existing accounts keep their role when they later link Google.

**Current MVP:** Role-level RBAC only. Permission-level RBAC (FR-039) is planned.

---

## 2. Team Captain Permissions

### Account

| Permission | Description |
|------------|-------------|
| `profile.read` | View own profile |
| `profile.update` | Update own profile |
| `password.change` | Change password |

### Team

| Permission | Description |
|------------|-------------|
| `team.create` | Create team (draft) |
| `team.read` | View own teams |
| `team.update` | Edit team info |
| `team.members.manage` | Add/remove players |
| `team.logo.manage` | Upload team logo |

### Stadium (read-only)

| Permission | Description |
|------------|-------------|
| `stadium.search` | Search stadiums |
| `stadium.read` | View stadium/field details |
| `availability.read` | View slot availability (not Dhacay / lost empty hours) |

### Booking

| Permission | Description |
|------------|-------------|
| `booking.create` | Create booking (Team A) |
| `booking.read.own` | View own bookings |
| `booking.cancel.own` | Cancel own booking (per state rules) |
| `booking.invite` | Invite Team B |

### Payment

| Permission | Description |
|------------|-------------|
| `payment.create` | Initiate payment for own team share |
| `payment.read.own` | View own payments |
| `receipt.read.own` | View receipts |

### Match (precondition-gated)

| Permission | Preconditions |
|------------|---------------|
| `match.read` | Booking exists |
| `lineup.manage` | BR-007: both paid + CONFIRMED |
| `formation.manage` | BR-007 |
| `positions.manage` | BR-007 |
| `checkin` | CONFIRMED + within check-in window |

### Tournament

| Permission | Description |
|------------|-------------|
| `tournament.browse` | View tournaments |
| `tournament.join` | Register team |
| `tournament.payment` | Pay registration fee |

---

## 3. Stadium Owner Permissions

Manages: Stadium → Fields → Prices → Working Hours → Availability → Bookings → Tournaments → Revenue.

| Area | Permissions |
|------|-------------|
| Stadium | create, read, update, delete (own), images, facilities, location |
| Fields | CRUD on own stadium fields |
| Pricing | per_player / fixed_field modes |
| Availability | working hours, blocks, recurring bookings, Dhacay/lost empty hours (venue clock) |
| Discounts | time-based discount rules |
| Bookings | read bookings on own fields |
| Tournaments | create and manage on own stadiums |
| Revenue | view payouts and settlement reports (own) |
| Managers | assign STADIUM_MANAGER scoped access |

**Cannot:** modify other owners' resources (BR-013).

---

## 4. Stadium Manager (Scoped)

Assigned by Stadium Owner to a specific stadium.

| Allowed | Denied |
|---------|--------|
| View bookings | Payout / bank settings |
| Manage daily availability | Transfer ownership |
| Check-in teams | Delete stadium |
| Block fields | Platform commission |
| Match day operations | Payment provider config |

---

## 5. Admin Permissions

**Platform Operations Manager** — not system owner.

```text
users.read              (excludes Super Admin accounts)
users.suspend           (captains, owners, managers — NOT Super Admin, NOT other Admins)
users.edit.safe         (name/phone/city — same limits)
teams.read
stadiums.read
stadiums.verify         (approve / reject / suspend stadium)
bookings.read
bookings.settle         (completed booking settlement)
payments.read
payments.review         (mark captain payment OK / flagged)
refunds.manage          (ops review)
disputes.manage
reports.read            (ops — not platform profit PDF for SA)
tournaments.moderate
```

### Admin cannot

```text
❌ create / edit / suspend / delete Super Admin
❌ create Admin or change Admin roles (Super Admin only)
❌ delete other Admin accounts
❌ change platform commission / field subscription policy
❌ payment provider secrets / Site Content policies
❌ owner onboarding wizard / gifts master / platform profit exports (SA)
❌ grant super_admin role
```

---

## 6. Super Admin Permissions

**System Owner / Root Authority**

```text
Everything Admin can do, plus:
Admins (CRUD / provision)
Roles & Permissions (full)
Platform Settings (commission %, owner commission visibility, hold windows, lineup/gift flags)
Payment Configuration
Field subscription policy
Owner onboarding (agreement + activate)
Free-match gift campaigns
Platform profit reports (PDF/Excel)
Regions / Cities / Site Content
System Rules / Security / Audit
```

---

## 7. Admin vs Super Admin Matrix

| Feature | Admin | Super Admin |
|---------|:-----:|:-----------:|
| Users (captain / owner / manager) | ✅ | ✅ |
| See / edit / suspend Super Admin | ❌ | ✅ (limited) |
| Create Admin / Stadium Owner account | ❌ | ✅ |
| Delete Admin | ❌ | ✅ |
| Stadiums verify / suspend | ✅ | ✅ |
| Bookings monitor / settle | ✅ | ✅ |
| Payment review (OK / flag) | ✅ | ✅ |
| Platform profit / commission % | ❌ | ✅ |
| Owner onboarding / gifts / site content | ❌ | ✅ |
| Roles change | ❌ | ✅ |

---

## 8. Authorization Pipeline

Every protected request:

```text
REQUEST
  ↓ HTTPS
JWT Verification
  ↓
USER loaded
  ↓
ROLE check
  ↓
PERMISSION check (future)
  ↓
RESOURCE OWNERSHIP
  ↓
BUSINESS RULE (payment/booking preconditions)
  ↓
CONTROLLER → SERVICE → DATABASE
```

See [12-security-design.md](./12-security-design.md).

---

## 9. Implementation Notes (MVP)

- Roles stored on `User` document: `team_captain`, `stadium_owner`, `admin`, `super_admin`.
- Middleware: `authenticate`, `authorize(...roles)`.
- Wrong-role client routes redirect to role dashboard (client-side UX only; server still enforces).
