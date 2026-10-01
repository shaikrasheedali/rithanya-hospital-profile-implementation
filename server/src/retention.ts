import { prisma } from "./db.js";

type State = { lastRun: Date | null; ledgerPurged: number; auditPurged: number; error: string | null };
const g = globalThis as typeof globalThis & { __rhRetention?: State };
g.__rhRetention ??= { lastRun: null, ledgerPurged: 0, auditPurged: 0, error: null };
export const retentionState = g.__rhRetention;

export async function runRetentionPurge() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffMs = cutoff.getTime();
  try {
    // Select-then-filter in JS (instead of a DB-side date comparison) so storage-format
    // differences can never widen the blast radius. Cap deletions per run as a clock-skew guard.
    const [ledgerRows, auditRows] = await Promise.all([
      prisma.expenseLedger.findMany({ select: { id: true, entryDate: true } }),
      prisma.auditLog.findMany({ select: { id: true, timestamp: true } }),
    ]);
    const ledgerIds = ledgerRows.filter((r) => new Date(r.entryDate).getTime() < cutoffMs).map((r) => r.id).slice(0, 10000);
    const auditIds = auditRows.filter((r) => new Date(r.timestamp).getTime() < cutoffMs).map((r) => r.id).slice(0, 10000);
    const l = ledgerIds.length ? await prisma.expenseLedger.deleteMany({ where: { id: { in: ledgerIds } } }) : { count: 0 };
    const a = auditIds.length ? await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } }) : { count: 0 };
    retentionState.lastRun = new Date();
    retentionState.ledgerPurged += l.count;
    retentionState.auditPurged += a.count;
    retentionState.error = null;
    console.log(`[RETENTION] Purged ${l.count} ledger rows and ${a.count} audit rows older than ${cutoff.toISOString().slice(0, 10)}.`);
  } catch (e) {
    retentionState.error = e instanceof Error ? e.message : String(e);
    console.error("[RETENTION ERROR]", e);
  }
}
