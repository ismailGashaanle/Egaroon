# E-GAROON — Business Rules

**Version:** 1.0  
**Related:** [02-requirements.md](./02-requirements.md), [14-payment-design.md](./14-payment-design.md), [15-booking-state-machine.md](./15-booking-state-machine.md)

These rules are enforced **server-side**. The frontend may reflect them for UX but must never be the sole enforcement layer.

---

## BR-001 — Authenticated bookings only

Only authenticated users can create bookings.

**Enforcement:** Auth middleware on `POST /bookings`; reject unauthenticated requests with 401.

---

## BR-002 — Team Captain creates team bookings

Only a user with role `team_captain` (acting as Team A captain) can initiate a match booking.

**Enforcement:** RBAC on booking creation; captain must own Team A.

---

## BR-003 — No overlapping confirmed bookings

A field cannot have two confirmed (live) bookings for overlapping times.

**Enforcement:**
1. Redis temporary lock during creation
2. MongoDB partial unique index on `(field, startTime, endTime)` for live statuses
3. Availability service checks blocks, recurring, tournament holds
4. Joogto (recurring weekly) matches **venue wall-clock** on that weekday: `startTimeLocal` `20:00` occupies the 20:00–21:00 cell. Hours are stored as UTC clock hours (not converted from EAT). Same field + weekday + hour is locked for captains, public search, owner boards, and mobile.

---

## BR-004 — Hold expiry

Temporary hold expires after configured duration.

**Default:** 10 minutes (`BOOKING_HOLD_MINUTES`).

**On expiry:** Booking → EXPIRED; Redis lock released; slot available again.

---

## BR-005 — Team B / opponent payment window (demand-based)

After **Team A split payment** succeeds (not `coverFullMatch`):

1. Booking → `PAYMENT_PENDING`
2. Server generates unique **Match Code** `SG-XXXX-XXXX` (letters+digits; unique index; checked before insert) and snapshots **`teamAPayerPhone`** (normalized Somali MSISDN used for Team A payment, else captain phone)
3. Team A sees Somali copy: *Waad bixisay lacagta teamkaaga. Waxaan sugaynaa Team B inuu lacagta ku bixiyo…* and can **Copy** / **Share WhatsApp** (code + instruction to enter Team A phone)
4. **Priority window** starts (`teamBPriorityMinutes`, default **12**). Slot stays locked (existing hold/booking uniqueness)
5. Team B joins via `POST /bookings/join-by-code` (and GET preview) with **`matchCode` + `teamAPhone`** — phone must match Team A payer/captain phone. Optional: Team A locks **`invitePhone`** (expected Team B); then joiner account phone must also match. Or Team A invites by phone (`invite-team-b`) which also sets `invitePhone`
6. Both paid → `CONFIRMED` + receipt/invoice + QR (`bookingCode`). Match Code preview/join never returns QR/`bookingCode`

#### BR-005c — Match Code anti-scam (join binding)

| Rule | Enforcement |
|------|-------------|
| Code alone insufficient | Preview + join require `teamAPhone` (normalized Somali) matching `teamAPayerPhone` and/or Team A captain phone and/or Team A payment MSISDN |
| Optional invite lock | If `invitePhone` set → joiner `User.phone` must equal it |
| Distinct join errors | Wrong Match Code → `MATCH_CODE_NOT_FOUND` (*Ma jiro code-kani*); wrong Team A phone → `TEAM_A_PHONE_MISMATCH` (*Lambarka lacagta laga diray waa khalad*). Rate-limited to limit enumeration |
| Rate limit / lockout | IP limiter on routes + failed-attempt lockout (IP+user, ~8 fails / 15 min) |
| No early QR | `bookingCode` / `qrPayload` omitted from match-code preview; detail QR only when status is CONFIRMED+ |

### BR-005b — Demand-based expiry (not hard cancel at 12 min)

At priority end the scheduler / on-access check does **not** auto-expire:

| Condition | Action |
|-----------|--------|
| No **genuine demand** for same `field`+`startTime` | Extend Team B window by `teamBGraceMinutes` (default 10), up to `teamBMaxGraceExtensions` (default 2). Notify Team B. |
| Genuine demand appears | Notify Team B; start **final grace** (`teamBFinalGraceMinutes`, default 3) |
| Team B payment `PROCESSING` | Do **not** release; protect / bump deadline |
| Competing Book attempts (ACTIVE SlotDemand) count **2 / 3 / 4** | Escalating notifications to Team B (and Team A) |
| **5th** competing demand | Release slot; toast `SLOT_TAKEN_DEMAND`; Team A funds → **wallet credit** (or refund per settings); competing captain creates a **NEW** booking as **NEW Team A** with **NEW Match Code** |
| Final grace ends unpaid | Expire invitation, release slot, refund/credit Team A per policy |

**Genuine demand** = authenticated captain clicked Book / started `createHold` for that slot (Level 2+). **Not** mere search/view.

**SlotDemand model:** `user`, `team`, `fieldId`, `startTime`, `status` ACTIVE/EXPIRED/CONVERTED, `createdAt`, `expiresAt` (~`slotDemandTtlSeconds`, default 180). Idempotent per user+field+startTime while ACTIVE. Rate-limited.

### Platform settings (Super Admin — “Khidmadda & hold-ka ballanka”)

| Key | Default |
|-----|---------|
| `teamBPriorityMinutes` | 12 |
| `teamBGraceMinutes` | 10 |
| `teamBMaxGraceExtensions` | 2 |
| `teamBFinalGraceMinutes` | 3 |
| `slotDemandTtlSeconds` | 180 |
| `autoRefundTeamAOnTeamBTimeout` | true |
| `preferWalletCreditOnDemandRelease` | true |

Legacy `teamBPaymentDeadlineMinutes` syncs with `teamBPriorityMinutes`.

**On release:** Booking → `EXPIRED`; `teamACredit.status` = `CREDITED` \| `REFUNDED` \| `PENDING` with amount; wallet ledger on User when credited.

---

## BR-006 — Confirmation requires verified payments

Booking becomes **CONFIRMED** only when all **required** payments are successfully verified (via provider webhook, not client assertion).

**Required payments:**
- Default (split): Team A share + Team B share
- **Full match cover:** Team A may pay `pricing.totalPrice` in one payment (`coverFullMatch: true`). Then Team B payment is **not** required; booking → `CONFIRMED` with `coveredFullMatch: true`. Invite Team B remains optional (lineup / opponent match pass only).

---

## BR-007 — Match features gated by payment + booking

Lineup, formation, player positions, starting XI, substitutes, match squad, match pass, and QR check-in are enabled only when:

```text
Booking status = CONFIRMED
AND (
  coveredFullMatch = true
  OR (Team A payment = SUCCESS/HELD AND Team B payment = SUCCESS/HELD)
)
```

(Also allowed in later live match states: `CHECKED_IN`, `IN_PROGRESS` — **not** after match end / `COMPLETED`.)

This is **Feature Permission** — separate from raw database write access.

### BR-007e — Match Pass card (CONFIRMED+)

When booking is CONFIRMED+ and `bookingCode` exists, `GET /bookings/:id` returns `matchPass` for captains:

- Shared gate QR (`qrPayload` / `bookingCode`) — same payload owner/manager ScanScreen validates
- Per side (Team A / Team B): captain name, **lambarka lacagta** (`payerPhone`), `paidAt`, payment method (cash/zaad/edahab/hormuud/…), amount, booking `createdAt`, slot start/end, stadium/field
- Clients may save the card as a PNG for offline gate entry; local reminders at **T−30m** (two pulses) and **T−5m** (“ciyaarta waa dhowdahay”)

### BR-007d — Lineup auto-delete when match ends

Lineup documents are retained **only while the match has not ended**. On transition to `COMPLETED` (or when `endTime` has passed / booking is `CANCELLED` / `EXPIRED` / `SETTLED` / `NO_SHOW`), the server **hard-deletes** all `Lineup` docs for that booking. A periodic job (every 5 minutes) sweeps any leftovers. Public search (`/lineups/search`, `/lineups/mine`) only returns lineups whose booking is still live. GET/PUT lineup after end returns 403.

### BR-007a — Lineup feature flag (`lineupEnabled`)

Super Admin may disable captain formation/lineup globally via Platform Settings:

| Field | Default | Effect when OFF |
|-------|---------|-----------------|
| `lineupEnabled` | **`false`** | `GET/PUT` lineup APIs return 403; web/mobile hide lineup UI |

When ON, BR-007 payment gate still applies. Injury marks a player as `injured` and **moves them to bench** (cannot remain a starter); captain must promote a healthy substitute so starter count still equals field capacity.

### BR-007b — Formation size matches field

Starter count and formation slot count **must equal** field `capacity` / players-per-side (e.g. 5v5 → 5 starters, 7v7 → 7). Extra players go on the bench. Server rejects mismatched saves, empty display names, invalid formation keys for that capacity, and non-http(s) / base64 `photoUrl` (Cloudinary URL only). Formation keys are capacity-scoped (e.g. `4-3-3` only for 11-a-side). Clients persist only on Save / Kaydi.

### BR-007b2 — Dual-captain lineups (Team A + Team B)

Each booking stores **up to two** lineup documents, unique on `(booking, team)`:
- Team A captain upserts only Team A’s formation/players.
- Team B captain upserts only Team B’s formation/players.
- Either captain may **GET** both boards for the booking (after BR-007 + `lineupEnabled`).
- Socket.IO `lineup:updated` refreshes both sides live.

Player headshots use Cloudinary URLs (`POST /api/uploads` folder `lineups`) — not base64 in Mongo.

### BR-007c — Published lineups (public discovery)

After a captain saves a lineup (BR-007 gate already passed), the lineup is **`published: true` by default** (publish-on-save). Public clients may:

| Action | Auth | Preconditions |
|--------|------|----------------|
| Search / view published board | Optional / none | `lineupEnabled=true` **and** lineup `published !== false` |
| List my team boards (`GET /lineups/mine`) | Bearer | `lineupEnabled=true`; teams where caller is captain (includes unpublished) |
| Edit / upsert lineup | Captain on booking | `lineupEnabled` + BR-007 (unchanged) |

Captain may pass `published: false` on save to hide from search. Public responses omit captain internals; include team name/logo, formation, capacity, starters, and bench.

---

## BR-008 — Server-side payment verification

Payment status must be updated only after backend verification of payment provider response/webhook.

**Never accept** client JSON such as `{ "paymentStatus": "SUCCESS" }` as authoritative.

---

## BR-009 — Configurable commission

Platform commission defaults to **4%** (`platformCommissionPercent` in Platform Settings / `PLATFORM_COMMISSION_PERCENT`).

Only **Super Admin** may change the default.

**Example:** Total $22 → commission $0.88 → owner gross $21.12 (before provider fees).

**Snapshot rules (historical correctness):**
1. On first successful payment for a booking, the system stores `booking.commissionPercent` from the current policy.
2. At settlement, `commissionAmount` / `ownerPayoutAmount` are computed from that snapshot (not a later rate change).
3. Profit reports prefer stored `commissionAmount`. If missing (legacy rows), they apply `commissionPercent` if present, else the **current** policy % to paid payment totals, and mark the row as estimated. Super Admin may run `POST /api/admin/reports/commission/backfill` to persist missing amounts.

---

## BR-009a — Field subscription (platform monetization)

Super Admin may enable a **monthly subscription per active field** (`fieldSubscriptionEnabled`, `fieldSubscriptionAmount`, default example **$7 USD**/month).

- Obligations are tracked per field per calendar month (`FieldSubscriptionPeriod`: owed / partial / paid / waived).
- Profit = booking commission revenue + subscription **paid** (owed is reported separately).
- Super Admin **Platform Profit Report** (`/super-admin/profit`): on-screen printable view + designed A4 PDF + multi-sheet Excel (`GET /api/admin/reports/profit` and `/export?format=pdf|xlsx`), filtered by period (`day|week|month|quarter|semiannual|year|custom`).
- Optional **city / region** filters (exact match on `Stadium.city` / `Stadium.region`) narrow totals, series, by-stadium/field, and subscription revenue to matching stadiums.
- **Insights** (embedded in profit report + `GET /api/admin/reports/profit/insights`): Top 10 stadiums by **commission** (not subscription); peak hours (0–23) and peak weekdays (0=Sun…6=Sat) from **match slot `startTime`** commission; same cents-safe money rules as BR-009 snapshots.
- MVP collection is **manual/mock** (Super Admin marks periods paid); automated billing is out of scope.

---

## BR-009b — Free match gift campaigns (platform promo)

Super Admin may run an optional **free match gift** campaign (`FreeMatchCampaign`): scoped to a **city**, **region**, both, or **platform-wide** (null geo).

| Rule | Detail |
|------|--------|
| Entry | Team captains enter once per campaign (`FreeMatchEntry` unique on campaign+user). |
| Draw | **Instant lottery on enter** using `crypto.randomInt` vs `winRatePercent`, capped by remaining `maxWinners` (atomic `$inc`). Clients show a short suspense reveal before displaying win/lose. |
| Prize | Single-use voucher code (`FREE-…`) = **100% off one booking** (full match cover). |
| Redeem | Captain redeems on a HELD / PAYMENT_PENDING booking they own as Team A; stadium city/region must match campaign scope; server zeroes pricing, creates `provider: gift_voucher` $0 payment, confirms booking. |
| Rate limit | One entry per user per campaign + IP enter limiter. |

Surfaces: Super Admin `/super-admin/gifts`; captain web dashboard Gift card; mobile captain Dheeraad; redeem on web booking details.

### BR-009c — Gift feature flag (`giftEnabled`)

Super Admin may disable free-match gifts globally via Platform Settings (and a master switch on `/super-admin/gifts`):

| Field | Default | Effect when OFF |
|-------|---------|-----------------|
| `giftEnabled` | **`false`** | `POST …/enter`, preview, redeem → **403**; `GET /gifts/active` and vouchers → empty; web/mobile hide Gift + redeem UI. SA may still create/end campaigns. |

Exposed on `GET /auth/features` as `giftEnabled`.

### BR-009d — Owner commission visibility (`ownerCommissionVisible`)

Super Admin may hide the platform commission from stadium owners (visibility only — settlement math is unchanged).

| Field | Default | Effect when OFF |
|-------|---------|-----------------|
| `ownerCommissionVisible` | **`false`** | Owner/manager APIs null `totalCommission` / `commissionTotal` / booking `commissionAmount` + `commissionPercent`. Owner web/mobile hide commission stats, “4%” hints, and report/export commission rows. Owners still see **their payout** (net). |

When **ON**, owners see commission paid / 4% hint (managers still never see commission). Super Admin profit reports and the commission % editor stay SA-only always.

Exposed on `GET /auth/features` as `ownerCommissionVisible`. Toggle: Platform Settings → Fees.

### BR-009e — Weather play-risk alerts (`weatherEnabled`)

Super Admin may enable **city play-risk alerts** via Platform Settings:

| Field | Default | Effect when OFF |
|-------|---------|-----------------|
| `weatherEnabled` | **`false`** | Weather APIs return **403** (`WEATHER_DISABLED`) for everyone except Super Admin. Captains and staff do not see rain / play-risk banners. The scheduler does not refresh or notify. |

When **ON**, the platform watches Super Admin–tracked cities (seeded: **Hargeisa**, **Muqdisho**, **Burao**, **Borama**; SA may add others e.g. Berbera). Every ~30 minutes it pulls Open-Meteo and scores **match-play risk**:

| Level | Meaning |
|-------|---------|
| `good` | Safe to play |
| `caution` | Play with care (light rain, wind, heat, UV) |
| `poor` | Poor conditions (heavy rain, strong wind) |
| `unplayable` | Unsafe (thunderstorm, severe rain) |

**Alerts** (caution / poor / unplayable) show on Home, stadium browse, captain/owner dashboards, and mobile Hoyga. Stadium staff in matching `Stadium.city` get an in-app `WEATHER_RISK` notification (deduped per city + day + level). Stadium detail still shows the field’s own forecast when a date is selected.

`GET /weather` remains for a stadium GPS / date card. Super Admin manages the city list + live risk board on Platform Settings (no free-text lookup).

Source: Open-Meteo (no API key). Exposed on `GET /auth/features` as `weatherEnabled`.

### BR-009f — Super Admin business planner (what-if)

Super Admin may model **future** platform profit without changing live booking prices.

| Input | Rule |
|-------|------|
| Field fees | Each field keeps its own `calculatePrice` match total. Stadiums are **not** assumed to share one fee. |
| Time of day | Scenario multipliers on that field’s base: morning / afternoon / evening / night. Default afternoon `1.00`, evening `1.50`, night `1.70` (example: $1 afternoon → $1.50 or $1.70 evening on the same pitch). |
| Occupancy | Percent of bookable slots per window (or one all-day %). Observed occupancy from confirmed bookings can prefill. |
| Commission | Uses `calculateCommission` with the scenario % (default: current `platformCommissionPercent`). |
| Subscription | Optional: active (+ planned extra) fields × monthly amount × (days/30). Independent of occupancy. |
| Formula | Optional BODMAS expression (`+ − × ÷ ^`, brackets, `4%` → 0.04) over named totals (`gmv`, `commission`, `subscription`, `profit`, …). Server-side parser only — never `eval`. |

This is a **plan**, not settlement. Live slot prices stay on Field documents until an owner/SA changes them. UI: `/super-admin/planner`. APIs: `GET/POST /api/admin/reports/planner`.

---

## BR-010 — No payout while disputed

Owner payout cannot occur while booking or related payment is in **DISPUTED** state.

Dispute resolution must precede settlement/payout.

---

## BR-011 — Tournament slots blocked

Fields/time slots reserved for a tournament cannot be publicly booked.

Tournament slot generation creates availability blocks or equivalent holds.

---

## BR-012 — Blocked slots not bookable

Slots marked blocked (maintenance, rain, private event, holiday, owner block) cannot be booked.

Block types: `MAINTENANCE`, `RAIN`, `PRIVATE_EVENT`, `HOLIDAY`, `TOURNAMENT`, `OWNER_BLOCK`.

**Stadium-wide lock:** Owner/manager can lock the **entire stadium** (`POST /stadiums/:id/lock`, `scope: stadium`) for a day or range so **no field** accepts public bookings (e.g. closed today, rain day, building work). Field-level blocks still apply to a single field.

**Gate QR start:** Owner/manager must select the stadium they are at. Booking stadium must match. Start (“Bilow ciyaarta”) is allowed only when **both** are true: (1) match-pass QR was successfully scanned/validated for that booking, and (2) now is within ~10 minutes before the booked hour until slot `endTime`. Other hours/days → reject (`too_early` / `expired`) with Somali copy. Late (past no-show grace) still allows start until slot end.

**Walk-in:** Owner/manager may create a booking for a visitor captain (`POST /owner/walk-in`) with pay mode full / Team A half / cash full, and payment method `cash` | `zaad` | `edahab` | `hormuud` (staff-collected).

**Stadium online/offline:** Owner/manager may take a stadium offline (`POST /stadiums/:id/ops`) — manual or scheduled `offlineFrom`–`offlineUntil`. Public holds and walk-in are blocked while closed; API returns Somali `messageSo` (e.g. *Garoonku wuu xidhan yahay ee dooro stadium kale*). Stadium list/detail include `ops` for countdown / reopen copy.

**Field online/offline:** Owner/manager may take a **single field** offline (`POST /fields/:fieldId/ops`) with the same shape. Holds and walk-in for that field are blocked with `409` `FIELD_OFFLINE` and Somali copy (e.g. *Field-kan wuu xidhan yahay ee dooro field kale*). Stadium offline always wins (all fields blocked). There is **no** “close all my stadiums” action — each stadium is managed separately; within a stadium the owner chooses whole-stadium **or** per-field.

**Not the same as AvailabilityBlock:** Time-range locks (`POST /stadiums/:id/lock`, field availability blocks) remain for maintenance/rain/events. Ops online/offline is a venue/field open-closed switch.

---

## BR-012a — Lost / Dhacay hours (past empty slots)

An hour that has already started on the **stadium clock** (`Africa/Mogadishu` wall-clock, same encoding as slot `startTime`) cannot be booked (`SLOT_PAST`).

- **Lost (Dhacay):** empty hour — no paid booking, no hold, no Joogto, no owner block — whose `startTime` ≤ venue now. Inventory that expired unused.
- Occupied hours that already started stay **booked / dooran (hold) / Joogto / blocked**. They are history, not lost.
- **Visible only to** stadium owner, stadium manager, admin, and super admin (web + mobile slot boards + reports). Used to compare booked vs unused past hours in real time.
- **Team captains and public search never see** Dhacay cells. As time passes, empty past hours disappear from their grid; they still see banaan, booked, dooran, Joogto, and blocked.

Enforcement: `GET /fields/:fieldId/slots` omits `state: past` unless `canViewLostSlots(role)`. Booking create still rejects past hours for every role.

---

## BR-013 — Owner stadium isolation

A stadium owner cannot modify another owner's stadium, fields, or payout settings.

**Enforcement:** Resource ownership check on every mutating stadium/field operation.

### BR-013a — Owner / manager reports + staff alerts

- **Reports:** Owner and assigned stadium managers may call `GET /api/owner/reports` and `GET /api/owner/reports/slots` for **scoped** stadiums only (manager = assigned; owner = owned). Managers never receive payout/revenue amounts.
- **Lost slots:** Past bookable hours (field open→close, excluding blocks/recurring) with no CONFIRMED+ booking count as lost inventory.
- **Near-real-time:** On hold create, payment confirm, and match start (gate check-in or scheduler → `IN_PROGRESS`), server notifies stadium **owner + active managers** via `notifyStadiumStaff` (persisted Notification + Socket.IO `user:{id}` / `stadium:{id}` events `booking:created`, `booking:confirmed`, `match:started`). Clients show in-app toast/list; Expo Go must not load remote push APIs.

---

## BR-014 — Admin cannot create or modify Super Admin

Admin role cannot create, promote to, edit, suspend, or delete Super Admin accounts. Admin user lists exclude Super Admin. Admins also cannot create/delete other Admin accounts or change roles — only Super Admin performs admin-of-admins and account provisioning (`POST /admin/users`).

Admin **can** manage captains, stadium owners, and managers; verify stadiums; monitor/settle bookings; and **review** captain payments (OK / flagged) without changing ledger amounts.

---

## BR-015 — Super Admin controls platform configuration

Super Admin controls: commission %, field subscription policy, settlement safety window, payment provider credentials, system rules, regions/cities, audit retention, security settings, platform profit reports, and user administration (suspend/block, soft-delete, safe field edits — not password resets).

---

## BR-015a — Super Admin stadium owner onboarding

Super Admin may register a stadium owner via an **OwnerOnboarding** draft (not public self-signup):

1. Preview Site Content **owner agreement** (So/En), optionally download/print soft A4 template PDF.
2. Capture owner (name, phone, optional/generated email, avatar), stadium, and fields (explicit field count + format + prices).
3. Freeze current Site Content **policies** (terms, privacy, owner agreement — So/En) into the draft; filled A4 PDF includes parties, stadium, field count, and dual signature blocks.
4. Capture **dual signatures** (Super Admin + owner) as Cloudinary image URLs (embedded on filled PDF when present).
5. Confirm **field subscription** collection (manual for MVP; amount aligns with `fieldSubscription*` settings, overridable per draft).
6. On success: create `User` (`stadium_owner`, `mustChangePassword=true`), approved `Stadium`, `Field`s, and paid/waived `FieldSubscriptionPeriod` rows for the covered months.
7. Temporary password is returned **once** to Super Admin (never logged or stored). No mailer in MVP — SA shares credentials out-of-band. Owner must change password on first login (`POST /auth/password/change`).

Status machine: `draft` → `awaiting_signatures` → `subscription_pending` → `active` (or `cancelled` before activate).

Public self-signup as `stadium_owner` is **off by default** (`publicOwnerSignup` on Platform Settings). Super Admin may turn it on so register / Google can create owners; BR-015a onboarding remains the supported path when the flag is off.

---

## Team Draft vs Active Team

| State | Allowed |
|-------|---------|
| **Draft** | Name, logo, basic info |
| **Active** | Full squad + match management (after payment/booking preconditions) |

---

## Price calculation rules

### Per player (`PER_PLAYER`)

```text
Team share = playerCount × pricePerPlayer
Total booking = Team A share + Team B share
```

### Fixed field (`FIXED_FIELD`)

```text
Team share = fieldPrice / 2   (for two-team match)
```

Server recalculates all amounts; client-supplied prices are ignored.

---

## No-show policy

- Grace period after scheduled start (default 15 minutes).
- Partial check-in triggers **NO_SHOW_REVIEW** — not automatic owner payout without policy/evidence.
- Admin resolves per dispute workflow.

---

## Financial ledger separation

Track separately (do not merge):

```text
Gross Amount
Platform Fee (commission)
Provider Fee
Refund
Owner Payout
Net
```
