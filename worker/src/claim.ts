import { Job, prisma } from "@job-scheduler/db";

/**
 * Atomically claims up to `limit` claimable jobs from a single queue.
 *
 * A job is claimable if it's QUEUED, or SCHEDULED with runAt in the past.
 * Concurrency is bounded by the queue's concurrencyLimit minus jobs already
 * CLAIMED/RUNNING for that queue.
 *
 * CONCURRENCY BUG THIS FUNCTION WAS REWRITTEN TO FIX (kept as a warning,
 * verified against the automated test in claim.test.ts):
 *
 * The first version ran the advisory lock acquisition and the capacity
 * COUNT in the SAME single SQL statement (as CTEs). That is unsound. In
 * READ COMMITTED (Postgres's default), a statement takes ONE snapshot at
 * the moment it *begins* and uses that snapshot for its whole execution —
 * even if it has to block mid-statement waiting on a lock. Postgres only
 * takes a special "re-check with fresh data" path for the specific row(s)
 * involved in a FOR UPDATE wait; a plain COUNT(*) elsewhere in the same
 * statement does NOT get re-evaluated against fresh data after the wait.
 * So five concurrent callers could all start their statement at the same
 * instant (same snapshot), have the advisory lock correctly serialize
 * *when* each one's FOR UPDATE section ran, and STILL each independently
 * compute "0 jobs claimed so far" for the capacity check — because that
 * COUNT used the snapshot from before any of them had waited or committed
 * anything. This reliably reproduced as an over-claim once five callers
 * genuinely started in the same instant (e.g. reusing warm pooled
 * connections) — see the concurrency test for the exact scenario.
 *
 * The fix: acquire the lock and compute capacity+claim as two SEPARATE
 * statements inside one transaction. The second statement only begins
 * once the lock is actually granted, so it gets its OWN fresh snapshot —
 * one that includes every commit made by whoever held the lock before us.
 */
export async function claimJobsForQueue(
  queueId: string,
  concurrencyLimit: number,
  workerId: string,
  limit: number
): Promise<Job[]> {
  if (limit <= 0) return [];

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${queueId}))`;

    return tx.$queryRaw<Job[]>`
      WITH capacity AS (
        SELECT GREATEST(${concurrencyLimit}::int - COUNT(*)::int, 0) AS available
        FROM "Job"
        WHERE "queueId" = ${queueId} AND status IN ('CLAIMED', 'RUNNING')
      ),
      candidates AS (
        SELECT j.id
        FROM "Job" j, capacity
        WHERE j."queueId" = ${queueId}
          AND (j.status = 'QUEUED' OR (j.status = 'SCHEDULED' AND j."runAt" <= now()))
        ORDER BY j."runAt" ASC
        LIMIT LEAST(${limit}::int, (SELECT available FROM capacity))
        FOR UPDATE OF j SKIP LOCKED
      )
      UPDATE "Job" j
      SET status = 'CLAIMED',
          "workerId" = ${workerId},
          "claimedAt" = now(),
          "updatedAt" = now()
      FROM candidates c
      WHERE j.id = c.id
      RETURNING j.*;
    `;
  });
}
