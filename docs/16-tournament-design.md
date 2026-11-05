# E-GAROON — Tournament Design

**Version:** 1.0  
**Related:** [05-business-rules.md](./05-business-rules.md) (BR-011), [10-database-design.md](./10-database-design.md)

---

## 1. Overview

Stadium Owners create tournaments (cups) on their venues. Teams register and pay a registration fee. The system manages groups, fixtures, standings, knockout rounds, and **blocks public booking** on reserved slots.

**Status:** ✅ **Implemented** — Phase 8 complete. Full backend (models, service, routes) and client UI are live. Knockout bracket advanced view is partial (see [17-development-plan.md](./17-development-plan.md)).

---

## 2. Actors

| Actor | Actions |
|-------|---------|
| Stadium Owner | Create tournament, set rules, reserve fields, record results |
| Team Captain | Browse, register team, pay fee |
| Admin | Moderate, resolve disputes |
| System | Generate fixtures, calculate standings, block slots |

---

## 3. Tournament Configuration

| Field | Description |
|-------|-------------|
| `name` | e.g. "Ramadan Cup 2027" |
| `stadium` | Host stadium |
| `fields` | Reserved fields |
| `numberOfTeams` / `maxTeams` | Capacity |
| `registrationFee` | Per team |
| `startDate`, `endDate` | Tournament window |
| `registrationDeadline` | Last date to register |
| `matchDuration` | Minutes per fixture |
| `format` | See §4 |
| `rules` | Text / structured rules |
| `prize` | `{ winner, runnerUp, ... }` |

---

## 4. Formats

```text
GROUP_STAGE           — round-robin groups only
KNOCKOUT              — single/double elimination only
GROUP_AND_KNOCKOUT    — groups → top N advance to knockout
```

### Group stage

Example Group A:

```text
Hilaac | Onkod | Doctors | University
```

Standings columns:

```text
P  W  D  L  GF  GA  GD  PTS
```

### Knockout

```text
Quarter Final → Semi Final → Final
```

Seeding from group standings or manual draw.

---

## 5. Slot Blocking Flow

```text
Tournament created
      ↓
Owner selects fields + schedule template
      ↓
System generates reserved slots (availabilityBlocks)
      reason = TOURNAMENT
      ↓
Public booking API returns BLOCKED for those slots
      ↓
Fixtures assigned to reserved slots
```

**BR-011:** Tournament-reserved slots cannot be publicly booked.

---

## 6. Registration Flow

```text
Captain browses tournaments
      ↓
POST /tournaments/:id/register { teamId }
      ↓
Validate: deadline, max teams, team eligible
      ↓
Payment for registrationFee (same adapter pattern)
      ↓
tournamentTeams entry: REGISTERED → CONFIRMED on payment
```

---

## 7. Fixture Generation

### Group stage

- Teams divided into groups (draw or seed)
- Round-robin: each pair plays once (or home/away if configured)
- `Fixture` records: `{ group, homeTeam, awayTeam, field, startTime, status }`

### Knockout

- Bracket tree generated from group qualifiers or direct entry
- BYE handling for non-power-of-two team counts
- Extra time / penalties — optional manual result fields

---

## 8. Match Results & Standings

### Record result

```text
PATCH /fixtures/:id/result
Body: { homeScore, awayScore, notes? }
```

### Standings recalculation (group)

For each finished fixture in group:

```text
PTS: win=3, draw=1, loss=0
GD = GF - GA
Sort: PTS desc, GD desc, GF desc
```

### Advancement

Top N teams per group advance to knockout phase. System generates knockout fixtures linked to tournament.

---

## 9. Data Model (Summary)

```text
tournaments
tournamentTeams   { tournament, team, status, paidAt }
groups            { tournament, name, teamIds[] }
fixtures          { tournament, group?, round, home, away, field, start, status, score }
standings         { group, team, P, W, D, L, GF, GA, GD, PTS }  // denormalized cache
```

Reserved slots reuse `availabilityBlocks` with `reason: TOURNAMENT` and `metadata.tournamentId`.

---

## 10. Payments

- Registration fee via PaymentService (escrow until tournament starts or per owner policy)
- Prize distribution — manual/off-platform for v1 or future payout module
- Platform commission on registration fee — configurable (may differ from match booking 4%)

---

## 11. UI Pages (Target)

| Page | Actor |
|------|-------|
| `/tournaments` | Public browse |
| `/tournaments/:id` | Detail + register |
| Owner: tournament wizard | Create/configure |
| Owner: fixture manager | Schedule + results |
| Captain: my tournaments | Registered cups |
| Standings table | Public per group |

---

## 12. Socket.IO Events (Target)

- `tournament:fixture_updated`
- `tournament:standings_updated`
- `tournament:registration_closed`

---

## 13. Edge Cases

| Case | Handling |
|------|----------|
| Team withdraws before start | Admin refund policy |
| Insufficient teams registered | Cancel tournament; release blocks |
| Weather cancellation | Owner reschedules fixture; update block times |
| Tie on knockout | Extra time fields or penalty shootout score |

---

## 14. Acceptance Criteria

See AC-TOURN-001 in [07-acceptance-criteria.md](./07-acceptance-criteria.md).
