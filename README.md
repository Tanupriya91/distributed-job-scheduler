# Distributed Job Scheduler

A production-inspired distributed job scheduling platform: multi-tenant project/queue management, immediate/delayed/scheduled/recurring/batch job creation, an atomic-claiming worker fleet, retry-with-backoff and a Dead Letter Queue, and a dashboard for queue health, job exploration, execution logs, and worker monitoring.

Built as four services around one Postgres database — no message broker. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why, [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md) for the schema, [docs/API.md](docs/API.md) for the full REST reference, and [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) for the trade-offs behind the choices below.

## Stack

| Service | Tech |
|---|---|
| Backend API | Node.js, TypeScript, Express, Prisma |
| Worker | Node.js, TypeScript, Prisma + raw SQL for atomic claiming |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, React Query |
| Database | PostgreSQL 16 |

Monorepo, npm workspaces: `backend/`, `worker/`, `frontend/`, `packages/db` (shared Prisma schema + client).

## Prerequisites

- Node.js 20+
- Docker (for Postgres via `docker-compose.yml`)

## Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start Postgres
docker compose up -d

# 3. Copy env files (defaults work as-is for local dev)
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
cp frontend/.env.local.example frontend/.env.local

# 4. Generate the Prisma client and apply migrations
npm run generate --workspace=packages/db
npm run migrate:dev --workspace=packages/db
```

## Running

Each service runs in its own terminal:

```bash
npm run dev --workspace=backend    # http://localhost:4000
npm run dev --workspace=worker     # background job processor, no HTTP port
npm run dev --workspace=frontend   # http://localhost:3000
```

Open `http://localhost:3000`, register (this creates your first user + organization in one step), and the dashboard walks you through creating a project, a queue, and a job.

### Verifying it's up

```bash
curl http://localhost:4000/health      # {"status":"ok",...}
curl http://localhost:4000/health/db   # confirms Postgres connectivity
```

## Testing

```bash
npm run test --workspace=backend   # API integration tests (Vitest + Supertest, real Postgres)
npm run test --workspace=worker    # atomic-claim concurrency test, retry/backoff, execution, recurring-dispatch race test
```

Tests hit the real dev database (deliberately — the atomic-claiming logic in particular depends on genuine Postgres locking semantics that a mocked DB can't reproduce) and clean up the data they create.

## Environment variables

Each service has its own `.env` (see `*.env.example` for defaults):

- **`backend/.env`** — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FRONTEND_ORIGIN` (CORS), `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`/`AUTH_RATE_LIMIT_MAX`
- **`worker/.env`** — `DATABASE_URL`, `WORKER_CONCURRENCY`, `POLL_INTERVAL_MS`, `HEARTBEAT_INTERVAL_MS`, `SHUTDOWN_TIMEOUT_MS`, `RECURRING_CHECK_INTERVAL_MS`
- **`frontend/.env.local`** — `NEXT_PUBLIC_API_URL`

## Project structure

```
backend/     REST API (auth, orgs, projects, queues, jobs, workers, stats)
worker/      Background processor: claims jobs, executes them, retries/DLQs failures, dispatches recurring jobs
frontend/    Next.js dashboard
packages/db/ Shared Prisma schema + generated client, imported by backend and worker
docs/        Architecture, ER diagram, API reference, design decisions
```

## Running multiple workers

The worker is horizontally scalable — start as many as you like, each in its own terminal (`npm run dev --workspace=worker`). They coordinate purely through Postgres (advisory locks + atomic `UPDATE`s), so there's no additional configuration needed to run 1 or 10 of them concurrently.
