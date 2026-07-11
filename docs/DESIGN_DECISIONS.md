# Design Decisions

This document collects the major trade-offs made across the build, organized by area. Each entry states the decision, why it was made, and what was given up. Several of these are also documented as code comments at their exact point of relevance — this document is the consolidated version.

## Architecture

### No message broker
Job queuing, locking, and coordination between workers all live in Postgres — no Redis, no RabbitMQ, no SQS. **Why:** the assignment asks for a scheduler built from first principles, not "integrate BullMQ." Reasoning through atomic claiming, race conditions, and locking directly is a stronger demonstration of understanding than wrapping an existing queue library. **Trade-off:** Postgres is not purpose-built as a queue — very high job-creation throughput (tens of thousands/sec) would eventually make row-level polling and advisory locks a bottleneck in a way a dedicated broker wouldn't be. At the scale this system is built for, that ceiling is far away.

### Shared Prisma package
`backend` and `worker` both depend on `packages/db`, one schema and one generated client, rather than each maintaining its own copy. **Why:** both services read and write the *same* tables; two independent schema copies would drift the moment one service's model changed without the other being updated. **Trade-off:** the two services are now coupled to the same Prisma version and can't evolve their data models independently — acceptable since they ship from the same repo and release together.

### Separate backend API and worker processes
Not a single monolithic process. **Why:** mirrors real production topology — an API server and a worker fleet scale independently (many small API instances, a smaller/larger number of workers depending on job volume), and a worker crash shouldn't take down request handling. **Trade-off:** two processes to run in development instead of one; mitigated by both being simple `npm run dev` invocations with no orchestration needed at this scale.

## Database Design

### `cuid()` primary keys, not autoincrement or UUIDv4
Covered in [ER_DIAGRAM.md](ER_DIAGRAM.md#primary-keys-cuid-everywhere). Autoincrement leaks row counts and can't be generated without a DB round-trip; plain UUIDv4 fragments B-tree indexes more than `cuid()`'s semi-sequential output.

### Explicit `OrganizationMembership` join model
Covered in [ER_DIAGRAM.md](ER_DIAGRAM.md#why-organizationmembership-is-an-explicit-join-model-not-implicit-many-to-many). A per-pair attribute (`role`) forces an explicit join model instead of Prisma's implicit many-to-many.

### Retry policy snapshotted onto `Job`, not a live join
Covered in [ER_DIAGRAM.md](ER_DIAGRAM.md#retry-policy-snapshotted-onto-job-not-a-live-foreign-key). Editing a queue's retry defaults shouldn't retroactively change jobs already in flight.

### `JobExecution` as an append-only table, not fields on `Job`
Covered in [ER_DIAGRAM.md](ER_DIAGRAM.md#jobexecution-append-only-attempt-history-separate-from-job). The assignment requires queryable retry history, not just "what happened last."

### `DeadLetterQueue` as its own table, not just `Job.status = DEAD_LETTER`
The status value alone would let you filter for dead-lettered jobs, but the assignment's DB design explicitly calls for a DLQ entity — and a dedicated table gives a natural home for DLQ-specific fields (`reason`, `failedAt`, `retriedAt`) without overloading `Job`, and a purpose-built endpoint (`GET .../dead-letter-queue`) for the dashboard's DLQ view, distinct from the general job explorer.

## Concurrency & Reliability

### Atomic job claiming
The single most important piece of reliability logic in the system, and the one that took the most iteration:

**First version:** a single SQL statement combining `pg_advisory_xact_lock` + a capacity `COUNT` + `FOR UPDATE SKIP LOCKED` as CTEs. It looked correct and passed ad-hoc manual testing. **The automated concurrency test caught that it wasn't.**

**Root cause:** Postgres's READ COMMITTED isolation takes one snapshot per *statement*, fixed at the moment the statement begins — even if the statement blocks mid-execution waiting on a lock. Five concurrent callers starting at the same instant all got the same snapshot; the advisory lock correctly serialized *when* each one's row-locking ran, but each one's capacity `COUNT` still saw "zero jobs claimed so far," because that's what was true when they all started. Three of five callers claimed 3 jobs each against a `concurrencyLimit` of 3.

**Fix:** acquire the lock and compute capacity+claim as two separate statements inside one transaction. The second statement only begins once the lock is actually granted, so it gets its own fresh snapshot — one that includes whatever the previous lock-holder just committed.

This is written up in full, with the exact reproduction steps, in `worker/src/claim.ts`'s doc comment, and verified by `worker/src/claim.test.ts` (5 concurrent claimers against a `concurrencyLimit=3` queue, asserting the total claimed never exceeds 3 and no job is claimed twice). It's also the reason integration tests run against a real Postgres instead of a mocked one — this exact bug would never surface against a mock, because a mock wouldn't reproduce Postgres's actual snapshot-isolation semantics.

### Race-safe recurring dispatch without an advisory lock
`RecurringJob` firing uses a plain conditional `UPDATE ... WHERE id = ? AND nextRunAt <= now()`, with no advisory lock. **Why this is safe despite the claim-query lesson above:** the condition being checked (`nextRunAt`) *is* the row being updated, so Postgres's normal row-locking gives a fresh re-check for free — this is the same special-case behavior (documented in Postgres's own docs on `UPDATE`/concurrent writes) that the claim-query bug fell victim to for a *different, non-target* row. Verified by `worker/src/recurring.test.ts`: 5 concurrent dispatch ticks against one due definition spawn exactly one `Job`.

### Idempotent job creation, race-safe
A job's optional `idempotencyKey` is unique per queue. Rather than check-then-insert (racy under concurrent identical requests), `createJob` attempts the insert and catches the resulting `P2002` unique-violation, then re-fetches and returns the *existing* job with `200`. The database's constraint is the source of truth, not an application-level check that could lose a race.

### Backoff strategies capped at `maxDelaySeconds`
FIXED/LINEAR/EXPONENTIAL are all clamped to a maximum, so a misconfigured queue (or an exponential curve on a long-running failure) can't schedule a retry days into the future by accident.

### Known limitation: no stale-claim reclaim
If a worker crashes mid-execution, its claimed job stays in `RUNNING` forever — nothing currently notices the worker went silent and reclaims the job. This is a real, acknowledged gap, not an oversight: fixing it properly (a lease/heartbeat-per-job with a reclaim sweep) is meaningfully more design work than the phases covered here budgeted for, and doing it as an afterthought risked getting the concurrency subtly wrong the same way the claim query did on the first pass. Documented rather than silently shipped.

## Security & Authorization

### Stateless JWT, no server-side session store
Bearer tokens, no revocation list. **Trade-off:** there's no way to force-logout a compromised token before it expires (`JWT_EXPIRES_IN`, default 7 days) — acceptable for this project's scope, a real gap for production (would need a token blocklist or short-lived access + refresh tokens).

### `bcryptjs` instead of native `bcrypt`
Pure-JS implementation, no native compilation step — avoids `node-gyp` friction on Windows dev machines, at a small performance cost irrelevant at this scale.

### Three-layer authorization middleware, composed per-route
`authenticate` (valid token?) → `requireOrgMembership` (member of this tenant?) → `requireRole(...)` (allowed to do *this*?) are three separate, composable middlewares rather than one combined check. Read-only routes stop at membership; mutating routes add the role check — each route declares exactly what it needs.

### Workers are global infrastructure, not tenant-scoped
The worker fleet processes jobs from every organization's queues — there's no per-tenant worker isolation. Queue-level `concurrencyLimit` and `isPaused` are the fairness/isolation mechanisms between tenants sharing the fleet, not separate worker pools. `GET /api/workers` is deliberately **not** nested under `/organizations` for this reason, and requires only authentication (not org membership), since it never exposes tenant job payloads — only operational metadata (hostname, concurrency, heartbeats).

## API Design

### `DELETE` on a job is a soft cancel, not a hard delete
`DELETE .../jobs/:jobId` transitions `status → CANCELLED` and keeps the row — the assignment requires full history "for every job," so an actual deletion would contradict that. Only allowed from `SCHEDULED`/`QUEUED` (`409` otherwise), since cancelling a job that's already running or finished doesn't mean anything.

### Consistent structured error contract
Every error, regardless of source (validation, auth, Prisma constraint violation, unhandled exception), is normalized to `{error:{code,message,details?}}` by one central error-handling middleware — callers never need to branch on error *shape*, only on `code`.

## Frontend

### Client-rendered dashboard
Every page is a `'use client'` component fetching via React Query; the JWT lives in `localStorage`. **Why:** this is an authenticated internal admin tool, not a public/SEO-sensitive site — SSR's main benefits don't apply, and building cookie-based auth + Next.js middleware for a token scheme the backend already implements as Bearer headers would be pure incidental complexity. **Trade-off:** no server-rendered first paint (a brief loading spinner on first load) — a non-issue for a tool used by logged-in operators, not first-time visitors.

### Polling over WebSockets
`refetchInterval` on React Query (4-5s) drives "live" updates for job lists, queue stats, and worker health. The assignment explicitly allows either; polling is simpler to reason about, debug, and test, at the cost of being less real-time and slightly more request volume than a push-based approach. WebSocket live updates remain a listed bonus feature, not built here.

### Hand-rolled Tailwind UI primitives, not a component library
Button/Card/Badge/Modal/Table are small hand-written components rather than shadcn/ui or similar. Keeps the dependency tree small and avoids the additional scaffolding (Radix primitives, CVA, a CLI init step) a component library would add for a dashboard of this size.

## Testing Strategy

### Integration tests against a real Postgres, not mocks
Every automated test — backend API tests via Supertest, worker concurrency/execution tests — runs against the actual dev database, not a mocked Prisma client. This was a deliberate choice reinforced by direct experience: the claim-query concurrency bug (above) is a genuine Postgres MVCC/locking behavior that a mock would never reproduce, since a mock has no concept of snapshot isolation. Testing the real thing is what caught a real bug; a passing mock-based test suite would have shipped it.

## Explicitly deferred / not built

Named here so it's clear these are scoping decisions, not gaps discovered by omission:

- **Stale-claim reclaim** for crashed-mid-execution workers (see above)
- **Batch job creation UI** — the API (`POST .../job-batches`) is built and tested; no dashboard form was added for it
- **Workflow dependencies, rate limiting, distributed locking (beyond the queue-claim advisory lock), queue sharding, event-driven execution, WebSocket live updates, AI-generated failure summaries** — all listed as *bonus* features in the assignment; none were built, in favor of making the core requirements as solid as the claim-query story above
- **Prisma 5.22 → 7.x** and **Next.js 14 → 16** upgrades were flagged when the tooling surfaced them (a version-update notice, an `npm audit` advisory range) and deliberately not applied — both are breaking major-version changes that don't belong in the middle of a feature build, and are noted here rather than silently left unmentioned
