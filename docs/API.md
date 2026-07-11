# API Reference

Base URL: `http://localhost:4000` (dev). All request/response bodies are JSON.

## Conventions

**Auth.** Protected routes require `Authorization: Bearer <token>`, obtained from `/api/auth/register` or `/api/auth/login`. Missing/invalid tokens → `401`.

**Errors.** Every error response has the same shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { } } }
```
Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

**Rate limiting.** Every `/api` route is limited to `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS` per client (default 300/minute). `POST /api/auth/register` and `/login` have a stricter, separate limit (`AUTH_RATE_LIMIT_MAX`, default 20 per 15 minutes) to blunt credential-stuffing and spam-registration specifically. Exceeding either returns `429` with the standard error shape, `code:"RATE_LIMITED"`.

**Pagination.** List endpoints accept `?page=1&pageSize=20` (`pageSize` max 100) and return:
```json
{ "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
```

**Authorization layers.** Routes under `/api/organizations/:organizationId/...` require, in order: (1) a valid token, (2) the caller must be a member of that organization (else `403`), (3) some routes additionally require the `OWNER` or `ADMIN` role (else `403`) — marked **[OWNER/ADMIN]** below. Routes without that marker are open to any role including `MEMBER`.

**URL nesting.** Everything below `/api/organizations/:organizationId/projects/:projectId/queues/:queueId/` is scoped three levels deep — a queue only exists within a project, which only exists within an org. Cross-scope access (e.g. a queue ID from org A fetched through org B's URL) returns `404`, not the resource.

---

## Health

| | |
|---|---|
| `GET /health` | Liveness check. `200 {status,service,timestamp}` |
| `GET /health/db` | Confirms Postgres connectivity. `200` or `500 {status:"error",database:"unreachable"}` |

## Auth — `/api/auth`

### `POST /api/auth/register`
Creates a user **and** their first organization (as `OWNER`) in one call.
```json
{ "email": "a@b.com", "password": "password123", "name": "optional", "organizationName": "Acme Inc" }
```
→ `201 { user: {id,email,name}, organization, token }` · `409` if email taken · `400` on validation failure.

### `POST /api/auth/login`
```json
{ "email": "a@b.com", "password": "password123" }
```
→ `200 { user, token }` · `401` on bad credentials.

### `GET /api/auth/me` 🔒
→ `200 { id, email, name, organizations: [{id,name,slug,role}] }`

---

## Organizations — `/api/organizations` 🔒

| | |
|---|---|
| `POST /` | `{ "name": "..." }` → `201` new org, caller becomes `OWNER` |
| `GET /` | → `200` array of `{id,name,slug,role}` for the caller's orgs |

---

## Projects — `/api/organizations/:organizationId/projects` 🔒

| | |
|---|---|
| `POST /` **[OWNER/ADMIN]** | `{ "name": "..." }` → `201` project (slug auto-generated, unique per org) |
| `GET /?page=&pageSize=&search=` | → `200` paginated projects |
| `GET /:projectId` | → `200` project |
| `PATCH /:projectId` **[OWNER/ADMIN]** | `{ "name"?: "..." }` → `200` |
| `DELETE /:projectId` **[OWNER/ADMIN]** | → `204` |
| `GET /:projectId/stats` | → `200 { queueCount, activeQueueCount, statusCounts }` — job status counts aggregated across every queue in the project |

---

## Queues — `.../projects/:projectId/queues` 🔒

### `POST /` **[OWNER/ADMIN]**
```json
{
  "name": "email-queue",
  "priority": 0,
  "concurrencyLimit": 5,
  "retryPolicy": { "strategy": "FIXED", "maxAttempts": 3, "baseDelaySeconds": 30, "maxDelaySeconds": 3600 }
}
```
All fields except `name` are optional with the defaults shown. `strategy` ∈ `FIXED | LINEAR | EXPONENTIAL`. `maxDelaySeconds` must be ≥ `baseDelaySeconds`. → `201` queue with nested `retryPolicy` · `409` if name taken in this project.

| | |
|---|---|
| `GET /?page=&pageSize=&search=` | → `200` paginated, ordered by priority desc then newest first |
| `GET /:queueId` | → `200` queue |
| `PATCH /:queueId` **[OWNER/ADMIN]** | Same shape as create, all fields optional (including `isPaused`) |
| `DELETE /:queueId` **[OWNER/ADMIN]** | → `204` |
| `POST /:queueId/pause` **[OWNER/ADMIN]** | → `200` queue, `isPaused:true` |
| `POST /:queueId/resume` **[OWNER/ADMIN]** | → `200` queue, `isPaused:false` |
| `GET /:queueId/stats` | → `200 { statusCounts, throughputLastHour: {completed,deadLettered,failedAttempts}, avgExecutionMs }` |
| `GET /:queueId/executions?status=COMPLETED\|FAILED` | → `200` paginated execution-attempt feed across *all* jobs in the queue, each with a `job:{id,name,status}` summary |
| `GET /:queueId/dead-letter-queue` | → `200` paginated DLQ entries, each with `job:{id,name,payload,attempts}` |

---

## Jobs — `.../queues/:queueId/jobs` 🔒 (any role, including MEMBER)

### `POST /` — create
Body is a **discriminated union on `type`**:

```json
// IMMEDIATE — runs as soon as a worker is free
{ "type": "IMMEDIATE", "name": "send-email", "payload": {}, "idempotencyKey": "optional" }

// DELAYED — runs after delaySeconds
{ "type": "DELAYED", "name": "send-email", "delaySeconds": 60, "payload": {} }

// SCHEDULED — runs at a specific future timestamp
{ "type": "SCHEDULED", "name": "send-email", "runAt": "2026-08-01T00:00:00.000Z", "payload": {} }
```
`name` is the registered worker handler to invoke. `retryPolicy` may be included on any variant to override the queue's default for this job only. `runAt` on `SCHEDULED` must be in the future (`400` otherwise).

→ `201` new job. **Idempotency:** if `idempotencyKey` matches an existing job in the same queue, returns that **existing** job with `200` instead of creating a duplicate or erroring — safe to retry the request.

| | |
|---|---|
| `GET /?page=&pageSize=&status=&type=&batchId=` | `status` ∈ the 8 lifecycle states; `type` ∈ `IMMEDIATE\|DELAYED\|SCHEDULED\|RECURRING` |
| `GET /:jobId` | → `200` job |
| `DELETE /:jobId` — cancel | Only from `SCHEDULED`/`QUEUED` → `200` job with `status:"CANCELLED"`; any other status → `409` |
| `POST /:jobId/retry` | Only from `DEAD_LETTER` → resets attempts to 0, `status:"QUEUED"`, marks the DLQ entry's `retriedAt`; any other status → `409` |
| `GET /:jobId/executions` | → `200 { data: [...attempts ordered oldest-first] }` |

### Job lifecycle

```
SCHEDULED ──(runAt arrives)──▶ QUEUED ──(claimed)──▶ CLAIMED ──▶ RUNNING ──▶ COMPLETED
                                                                      │
                                                                      ├──▶ SCHEDULED (retry, backoff delay)
                                                                      └──▶ DEAD_LETTER (retries exhausted)

QUEUED/SCHEDULED ──(cancel)──▶ CANCELLED
DEAD_LETTER ──(manual retry)──▶ QUEUED
```

---

## Recurring Jobs — `.../queues/:queueId/recurring-jobs` 🔒

Cron-based definitions that periodically spawn real `Job` rows (`type:"RECURRING"`).

| | |
|---|---|
| `POST /` **[OWNER/ADMIN]** | `{ "name", "cronExpression", "payload"?, "retryPolicy"? }` — cron validated at creation (`400` if unparseable); supports an optional leading seconds field (e.g. `*/10 * * * * *` = every 10s) → `201`, `nextRunAt` computed |
| `GET /?page=&pageSize=&search=` | → `200` paginated |
| `GET /:recurringJobId` | → `200` |
| `PATCH /:recurringJobId` **[OWNER/ADMIN]** | All fields optional; changing `cronExpression` recomputes `nextRunAt` from now |
| `DELETE /:recurringJobId` **[OWNER/ADMIN]** | → `204` (spawned `Job` rows survive, `recurringJobId` set to null) |
| `POST /:recurringJobId/pause` / `/resume` **[OWNER/ADMIN]** | → `200` toggling `isPaused` |

---

## Job Batches — `.../queues/:queueId/job-batches` 🔒

Bulk job submission with aggregate progress tracking.

### `POST /`
```json
{ "name": "welcome-emails", "jobs": [{ "name": "send-email", "payload": {} }, ...] }
```
1–1000 jobs per request, all created as `IMMEDIATE` using the queue's default retry policy. → `201` batch with nested `jobs`.

| | |
|---|---|
| `GET /?page=&pageSize=` | → `200` paginated batches |
| `GET /:batchId` | → `200 { ...batch, progress: { total, byStatus: {COMPLETED: 2, DEAD_LETTER: 1, ...} } }` |

(Filter a batch's individual jobs via `GET .../jobs?batchId=<id>`.)

---

## Workers — `/api/workers` 🔒

Deliberately **not** nested under `/organizations` — workers are shared infrastructure across every tenant, not owned by one org.

| | |
|---|---|
| `GET /?page=&pageSize=` | → `200` paginated workers, each with `isHealthy` (`ACTIVE` + heartbeat within 30s) |
| `GET /:workerId` | → `200 { ...worker, isHealthy, activeJobCount, recentHeartbeats: [...last 20] }` · `404` if not found |
