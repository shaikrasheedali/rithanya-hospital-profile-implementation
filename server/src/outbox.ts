/**
 * Durable write-ahead outbox.
 *
 * Every server-side write goes to MySQL with a generous timeout. If the DB is
 * unreachable or the write times out, the operation is appended to this
 * encrypted on-disk queue and replayed (in order) whenever the database is
 * healthy again. This guarantees admin edits become permanent even when the
 * shared MySQL briefly blips or the process restarts mid-drain.
 *
 * Replay executors must be idempotent (upsert/delete semantics).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { encryptJson, decryptJson } from "./crypto.js";
import { isTransientDbError } from "./db.js";

export type OutboxOp = {
  id: string;
  /** ISO timestamp of when the op was queued */
  at: string;
  /** replay attempts made so far */
  attempts: number;
  /** earliest time (epoch ms) the next replay may run (transient backoff) */
  nextAttemptAt?: number;
  /** logical owner, e.g. "cms" | "media" | "users" | "employees" | "orders" | "payroll" | "finance" | "emr" | "appointments" | "settings" */
  module: string;
  /** module-specific action name, e.g. "create" | "upsert" | "delete" */
  action: string;
  /** optional dedupe key: a newer op replaces an older op with the same key */
  key?: string;
  /** module-specific replay payload (must be JSON-serializable) */
  payload: unknown;
};

type Registry = {
  ops: OutboxOp[];
};
const g = globalThis as typeof globalThis & { __rhOutbox?: Registry };
g.__rhOutbox ??= { ops: [] };
const state = g.__rhOutbox;

const OUTBOX_FILE = path.resolve(process.cwd(), "uploads", "outbox.json");
const OUTBOX_FAILED_FILE = path.resolve(process.cwd(), "uploads", "outbox-failed.log");
const MAX_OPS = 2000;
/** Transient failures retry forever with exponential backoff (never dropped). */
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 30 * 60 * 1000;

export type ReplayExecutor = (op: OutboxOp) => Promise<void>;
const gExec = globalThis as typeof globalThis & { __rhOutboxExecutors?: Map<string, ReplayExecutor> };
gExec.__rhOutboxExecutors ??= new Map<string, ReplayExecutor>();
const executors = gExec.__rhOutboxExecutors;

/** Register the replay logic for a module. Executed sequentially during drain. */
export function registerOutboxExecutor(module: string, fn: ReplayExecutor): void {
  executors.set(module, fn);
}

function persistQueue(): void {
  try {
    const dir = path.dirname(OUTBOX_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // PHI may pass through ops (EMR, users) — keep the queue encrypted at rest.
    const blob = encryptJson({ v: 1, ops: state.ops });
    fs.writeFileSync(OUTBOX_FILE, blob, "utf-8");
  } catch (err) {
    console.warn("[outbox] Could not persist queue:", err instanceof Error ? err.message : err);
  }
}

export function loadOutbox(): void {
  try {
    if (!fs.existsSync(OUTBOX_FILE)) return;
    const raw = fs.readFileSync(OUTBOX_FILE, "utf-8");
    if (!raw.trim()) return;
    let ops: OutboxOp[] | null = null;
    try {
      const parsed = decryptJson<{ v?: number; ops?: OutboxOp[] }>(raw, null as unknown as { v?: number; ops?: OutboxOp[] });
      ops = parsed?.ops ?? null;
    } catch {
      // Decrypt failed — file could be from another master key or corrupted.
      console.warn("[outbox] Queue file could not be decrypted; ignoring.");
      return;
    }
    if (Array.isArray(ops)) state.ops = ops.filter((o) => o && typeof o === "object");
  } catch (err) {
    console.warn("[outbox] Could not load queue:", err instanceof Error ? err.message : err);
  }
}

export function outboxHasPending(module?: string): boolean {
  if (module === undefined) return state.ops.length > 0;
  return state.ops.some((o) => o.module === module);
}

export function outboxHasPendingKey(module: string, key: string): boolean {
  return state.ops.some((o) => o.module === module && o.key === key);
}

export function outboxPendingCount(module?: string): number {
  if (module === undefined) return state.ops.length;
  return state.ops.filter((o) => o.module === module).length;
}

/** Queue a write for durable replay. A newer op with the same key replaces the older one. */
export function enqueueOutbox(op: {
  module: string;
  action: string;
  payload: unknown;
  key?: string;
}): void {
  const entry: OutboxOp = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    attempts: 0,
    module: op.module,
    action: op.action,
    ...(op.key ? { key: op.key } : {}),
    payload: op.payload,
  };
  // Keyed replacement happens BEFORE the capacity check: a superseding update
  // must never displace an unrelated op, and an update to an op that is
  // already beyond the cap still has to be recorded.
  if (op.key) {
    const idx = state.ops.findIndex((o) => o.key === op.key);
    if (idx >= 0) {
      state.ops[idx] = entry;
      persistQueue();
      return;
    }
  }
  if (state.ops.length >= MAX_OPS) {
    // Capacity eviction is real data loss — keep a forensic record of it.
    const evicted = state.ops.shift();
    if (evicted) dropFailed(evicted, `outbox capacity (${MAX_OPS}) exceeded — oldest op evicted`);
  }
  state.ops.push(entry);
  persistQueue();
}

function dropFailed(op: OutboxOp, reason: string): void {
  try {
    const dir = path.dirname(OUTBOX_FAILED_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      OUTBOX_FAILED_FILE,
      `${new Date().toISOString()} ${op.module}/${op.action}${
        op.key ? ` (${op.key})` : ""
      } dropped after ${op.attempts} attempts: ${reason}\n`,
      "utf-8",
    );
  } catch {
    /* best effort */
  }
  console.error(`[outbox] Op ${op.module}/${op.action} dropped permanently: ${reason}`);
}

let draining = false;
let pendingWake = false;

/** Drain as many queued ops as possible. Safe to call concurrently. */
export async function drainOutbox(): Promise<void> {
  if (draining) {
    pendingWake = true;
    return;
  }
  draining = true;
  try {
    while (state.ops.length > 0) {
      // Splice-first so a crash mid-replay never loses an op.
      const op = state.ops[0];
      // Exponential backoff after a transient failure — skip until due.
      if (op.nextAttemptAt && op.nextAttemptAt > Date.now()) return;
      const fn = executors.get(op.module);
      if (!fn) {
        // No executor registered yet (module not loaded) — wait; do not spin.
        return;
      }
      op.attempts += 1;
      try {
        await fn(op);
        state.ops.shift();
        persistQueue();
      } catch (err: any) {
        const code = err?.code ?? "";
        const msg = String(err?.message ?? err);
        // P2002: a unique conflict means the row already exists — the write is
        // effectively applied, replaying can never succeed.
        if (code === "P2002") {
          console.warn(`[outbox] Op ${op.module}/${op.action} already applied (${code}); dropping.`);
          state.ops.shift();
          persistQueue();
          continue;
        }
        // P2025 ("record not found"): for deletes the target is already gone
        // (idempotent — resolved). For updates/creates the missing row means
        // the write did NOT happen (e.g. a queued order whose product vanished
        // mid-transaction) — dropping it would silently lose the edit, so keep
        // it and retry with backoff like a transient failure.
        if (code === "P2025" && /delete|remove|purge|erase/i.test(op.action)) {
          console.warn(`[outbox] Op ${op.module}/${op.action} already resolved (${code}); dropping.`);
          state.ops.shift();
          persistQueue();
          continue;
        }
        // Deterministic data error (validation, bad payload, …): replaying can
        // never succeed. Drop it and KEEP draining — otherwise one poisoned op
        // blocks every later write of its module (the module gate queues new
        // writes) and the whole queue behind it.
        if (!isTransientDbError(err) && code !== "P2025") {
          dropFailed(op, msg.slice(0, 600));
          state.ops.shift();
          persistQueue();
          continue;
        }
        // Transient (or retryable P2025): never drop — back off exponentially
        // (capped) and keep the op until the database is healthy again.
        op.nextAttemptAt = Date.now() + Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.min(op.attempts - 1, 12));
        state.ops[0] = op;
        persistQueue();
        // DB still unhealthy — stop draining; retried on wake/timer.
        return;
      }
    }
  } finally {
    draining = false;
    if (pendingWake && state.ops.length > 0 && executors.size > 0) {
      pendingWake = false;
      setImmediate(() => {
        drainOutbox().catch(() => undefined);
      });
    }
  }
}

/** Fire-and-forget drain trigger (used after successful DB operations). */
export function wakeOutbox(): void {
  if (state.ops.length === 0) return;
  setImmediate(() => {
    drainOutbox().catch(() => undefined);
  });
}

/** Periodic safety net so queued ops replay even without traffic. */
export function startOutboxTimer(): void {
  setInterval(() => {
    if (state.ops.length > 0) drainOutbox().catch(() => undefined);
    // prune failed-log growth
    try {
      if (fs.existsSync(OUTBOX_FAILED_FILE)) {
        const st = fs.statSync(OUTBOX_FAILED_FILE);
        if (st.size > 1024 * 1024) fs.rmSync(OUTBOX_FAILED_FILE, { force: true });
      }
    } catch {
      /* ignore */
    }
  }, 60_000).unref?.();
}
