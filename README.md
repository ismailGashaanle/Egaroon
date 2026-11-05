# E-GAROON

**Football stadium booking, team management, payment, match management, and tournament platform.**

> MERN stack · Redis · Socket.IO · WaafiPay · DahabPay

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or managed)

### Run (development)

```bash
# 1. Backend
cd server
cp .env.example .env    # fill in secrets
npm install
npm run seed            # load demo data
npm run dev

# 2. Frontend (new terminal)
cd client
npm install
npm run dev
```

### Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Team Captain | `captain@demo.kulansiiye` | `Demo1234!` |
| Stadium Owner | `owner@demo.kulansiiye` | `Demo1234!` |
| Admin | `admin@demo.kulansiiye` | `Demo1234!` |
| Super Admin | `super@demo.kulansiiye` | `Demo1234!` |

### Try it

`
/search-fields?from=Hargeisa&date=23-08-2026
→ VIEW SLOTS → hold → pay (mock) → lineup
`

---

## Repository Structure

`
kulansiiye/
├── docs/       ← master documentation (start here)
├── server/     ← Node.js / Express API
├── client/     ← React / Vite SPA
└── README.md
`

---

## Documentation

All design, requirements, and architecture documentation lives in [/docs](./docs/).

| Doc | Topic |
|-----|-------|
| [01-project-overview.md](./docs/01-project-overview.md) | Vision, workflow, status |
| [02-requirements.md](./docs/02-requirements.md) | FR/NFR index |
| [03-srs.md](./docs/03-srs.md) | Full SRS |
| [04-use-cases.md](./docs/04-use-cases.md) | UC-001 – UC-030 |
| [05-business-rules.md](./docs/05-business-rules.md) | BR-001 – BR-015 |
| [06-roles-permissions.md](./docs/06-roles-permissions.md) | RBAC |
| [07-acceptance-criteria.md](./docs/07-acceptance-criteria.md) | Given/When/Then |
| [08-hld.md](./docs/08-hld.md) | High-level design |
| [09-lld.md](./docs/09-lld.md) | Low-level design |
| [10-database-design.md](./docs/10-database-design.md) | MongoDB schema |
| [11-api-contract.md](./docs/11-api-contract.md) | REST API |
| [12-security-design.md](./docs/12-security-design.md) | Security |
| [13-folder-architecture.md](./docs/13-folder-architecture.md) | Repo layout |
| [14-payment-design.md](./docs/14-payment-design.md) | Payments & escrow |
| [15-booking-state-machine.md](./docs/15-booking-state-machine.md) | Booking states |
| [16-tournament-design.md](./docs/16-tournament-design.md) | Tournaments |
| [17-development-plan.md](./docs/17-development-plan.md) | Phased roadmap |
| [IMPLEMENTATION-STATUS.md](./docs/IMPLEMENTATION-STATUS.md) | Feature status |
| [MASTER-AI-PROMPT.md](./docs/MASTER-AI-PROMPT.md) | AI assistant prompt |

---

## Technology Stack

**Frontend:** React, Vite, JavaScript, Tailwind CSS, Redux Toolkit, React Router, Axios, Socket.IO Client

**Backend:** Node.js, Express.js, MongoDB/Mongoose, Redis/ioredis, Socket.IO, JWT, bcrypt, node-cron

**Payments (target):** WaafiPay, DahabPay (mock provider active in dev)

**Infrastructure (target):** AWS, Nginx, PM2, HTTPS

---

## Implementation Status

See [IMPLEMENTATION-STATUS.md](./docs/IMPLEMENTATION-STATUS.md) for the full feature matrix.

**Short version:** Core SaaS is wired end-to-end — booking → pay (mock) → lineup → match pass → tournament. Live payment providers, tests, dispute module, and AWS deployment are next.

---

## Working with AI Assistants

See [MASTER-AI-PROMPT.md](./docs/MASTER-AI-PROMPT.md) for the master prompt to use with Cursor, Claude Code, or ChatGPT. Always point the AI at `/docs` before asking it to implement anything.
"# kulansiiye-project" 
"# kulansiiye-project" 
"# balamiye" 
"# balamiye" 
"# Egaroon" 
