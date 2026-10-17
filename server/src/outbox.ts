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

export type OutboxOp = {
  id: string;
  /** ISO timestamp of when the op was queued */
  at: string;
  /** replay attempts made so far */
  attempts: number;
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
const MAX_ATTEMPTS = 50;

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
  if (state.ops.length >= MAX_OPS) state.ops.shift();
  const entry: OutboxOp = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    attempts: 0,
    module: op.module,
    action: op.action,
    ...(op.key ? { key: op.key } : {}),
    payload: op.payload,
  };
  if (op.key) {
    const idx = state.ops.findIndex((o) => o.key === op.key);
    if (idx >= 0) state.ops[idx] = entry;
    else state.ops.push(entry);
  } else {
    state.ops.push(entry);
  }
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
        // Conflict already resolved in DB (duplicate slug/unique) — drop.
        if (code === "P2002" || code === "P2025") {
          console.warn(`[outbox] Op ${op.module}/${op.action} already resolved (${code}); dropping.`);
          state.ops.shift();
          persistQueue();
          continue;
        }
        if (op.attempts >= MAX_ATTEMPTS) {
          dropFailed(op, msg.slice(0, 200));
          state.ops.shift();
          persistQueue();
          continue;
        }
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
