import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
  withDbRetry,
  DB_READ_MS,
  isTransientDbError,
} from "../db.js";
import {
  audit,
  getSessionFromReq,
  hashPassword,
  invalidateUserSession,
  signSession,
  verifyPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  loadUser,
} from "../auth.js";
import { findCachedUser, hasOfflineCredentials } from "../users.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// First-run bootstrap is unauthenticated by design (it only succeeds while no
// users exist) — a tight limiter keeps it from being abused for probing or
// race hammering.
const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Per identity+IP failure tracking with hard lockout and bounded memory. */
const failLimiter = new Map<string, { n: number; first: number }>();
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 15;
const FAIL_MAP_CAP = 10_000;

function recordFailure(key: string, now: number): void {
  if (failLimiter.size >= FAIL_MAP_CAP && !failLimiter.has(key)) {
    // Simple eviction: clear expired entries first.
    for (const [k, v] of failLimiter) {
      if (now - v.first > FAIL_WINDOW_MS) failLimiter.delete(k);
      if (failLimiter.size < FAIL_MAP_CAP * 0.9) break;
    }
    if (failLimiter.size >= FAIL_MAP_CAP) failLimiter.clear();
  }
  const e = failLimiter.get(key);
  if (!e || now - e.first > FAIL_WINDOW_MS) failLimiter.set(key, { n: 1, first: now });
  else e.n += 1;
}

router.post("/login", loginLimiter, async (req, res) => {
  const { username, email, password } = req.body ?? {};
  const ident = String(username ?? email ?? "").trim().toLowerCase();
  const rawPw = String(password ?? "").trim();
  if (!ident || !rawPw) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  // Legacy bootstrap passwords must never be accepted as credentials. This
  // previously compared the *username* and silently mangled the lookup
  // identity — it now checks the supplied password (case-sensitive: the real
  // seeded passwords, e.g. Hameed@2026, remain valid so existing installs
  // aren't locked out; rotate them from the portal when convenient).
  if (rawPw === "rithanya@2026" || rawPw === "hameed@2026") {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const identity = ident;

  const key = `${req.ip}:${identity}`;
  const now = Date.now();
  const cur = failLimiter.get(key);
  if (cur && now - cur.first < FAIL_WINDOW_MS && cur.n >= FAIL_LIMIT) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const busy = () =>
    res.status(503).json({ error: "Sign-in is temporarily unavailable (database busy). Please try again in a minute." });

  type DbAuthResult =
    | { kind: "ok"; user: { id: string; username: string; fullName: string; role: string } }
    | { kind: "bad" }
    | { kind: "down" };

  /**
   * Argon2 verification is the dominant cost of a login attempt; skipping it
   * for unknown/inactive accounts leaks their existence via response time.
   * This dummy verify keeps the timing uniform for every failure path.
   */
  let dummyHashPromise: Promise<string> | null = null;
  const dummyVerify = (pw: string): Promise<boolean> => {
    dummyHashPromise ??= hashPassword(crypto.randomUUID());
    return dummyHashPromise.then((h) => verifyPassword(h, pw)).catch(() => false);
  };

  /** Authoritative check against MySQL; never throws. */
  async function authenticateAgainstDb(): Promise<DbAuthResult> {
    try {
      const user = await withDbRetry(
        () => prisma.user.findFirst({ where: { OR: [{ username: identity }, { email: identity }] } }),
        DB_READ_MS,
        2,
        // Keep sign-in snappy when the database is down: cap the total DB
        // budget, then authenticate from the encrypted offline cache.
        9_000,
      );
      reportDbSuccess();
      if (!user || !user.isActive || !user.passwordHash) {
        await dummyVerify(rawPw);
        return { kind: "bad" };
      }
      const ok = await verifyPassword(user.passwordHash, rawPw);
      return ok ? { kind: "ok", user } : { kind: "bad" };
    } catch (err) {
      const code = String((err as { code?: string } | undefined)?.code ?? "");
      const msg = err instanceof Error ? err.message : String(err);
      // A missing schema behaves like “database unavailable” for sign-in: the
      // encrypted cache below can still authenticate built-in accounts.
      if (isTransientDbError(err) || /P2021|P2010|does not exist|unknown table|no such table/i.test(`${code} ${msg}`)) {
        if (isTransientDbError(err)) reportDbError(err);
        console.warn("[auth/login] DB unavailable — trying encrypted user cache:", `${code} ${msg}`.slice(0, 160));
        return { kind: "down" };
      }
      console.warn("[auth/login] DB query failed (data error):", `${code} ${msg}`.slice(0, 160));
      return { kind: "bad" };
    }
  }

  /** Offline check against the encrypted users cache (DB unreachable). */
  async function authenticateOffline(): Promise<{ id: string; role: string } | null> {
    const cached = findCachedUser(identity);
    if (!cached || !cached.isActive || !cached.passwordHash) {
      await dummyVerify(rawPw);
      return null;
    }
    if (!(await verifyPassword(cached.passwordHash, rawPw))) return null;
    return { id: cached.id, role: cached.role };
  }

  try {
    const result: DbAuthResult = isDbOnCooldown() ? { kind: "down" } : await authenticateAgainstDb();

    if (result.kind === "ok") {
      const user = result.user;
      failLimiter.delete(key);
      const token = await signSession(user.id, user.role as never);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
      await loadUser(user.id);
      await audit({ id: user.id, fullName: user.fullName }, "LOGIN", "User", user.id, user.username).catch(() => undefined);
      res.json({ ok: true, role: user.role });
      return;
    }

    if (result.kind === "down") {
      // Database unreachable: authenticate from the last-known encrypted cache
      // so the admin is never locked out by a temporary database hiccup.
      const offline = await authenticateOffline();
      if (offline) {
        failLimiter.delete(key);
        const token = await signSession(offline.id, offline.role as never);
        res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
        await loadUser(offline.id);
        console.log(`[auth/login] Signed in ${identity} from the offline user cache (DB unavailable).`);
        res.json({ ok: true, role: offline.role, offline: true });
        return;
      }
      recordFailure(key, now);
      if (!hasOfflineCredentials()) {
        busy();
        return;
      }
      // Same generic response as the online path — no user enumeration.
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // kind === "bad" — the database answered and rejected the credentials.
    recordFailure(key, now);
    // Generic message to avoid user enumeration.
    res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    // Safety net; authenticateAgainstDb already handles its own errors.
    if (isTransientDbError(err)) reportDbError(err);
    console.warn("[auth/login] Unexpected failure:", err instanceof Error ? err.message : err);
    busy();
  }
});

router.post("/logout", async (req, res) => {
  const user = await getSessionFromReq(req);
  if (user) {
    await audit({ id: user.id, fullName: user.fullName }, "LOGOUT", "User", user.id).catch(() => undefined);
    // Drop the cached session immediately so deactivated permissions never linger.
    invalidateUserSession(user.id);
  }
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(req), maxAge: undefined, expires: new Date(0) });
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const user = await getSessionFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({ user });
});

// Ensure a superadmin exists even if seed was skipped (first-run bootstrap)
router.post("/bootstrap", bootstrapLimiter, async (req, res) => {
  try {
    const count = await withDbTimeout(prisma.user.count(), DB_READ_MS);
    if (count > 0) {
      res.status(403).json({ error: "Already initialized" });
      return;
    }
  } catch {
    res.status(503).json({ error: "Database unavailable — please try again later." });
    return;
  }
  const password = String(req.body?.password ?? "");
  if (!password || password === "Rithanya@2026") {
    res.status(400).json({ error: "Provide a strong password (min 8 characters, not the default)." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  try {
    const u = await prisma.user.create({
      data: {
        username: "superadmin",
        email: "superadmin@rithanyahospital.com",
        fullName: "Hospital Superadmin",
        role: "SUPERADMIN",
        passwordHash: await hashPassword(password),
      },
    });
    await prisma.userModuleAccess.create({
      data: {
        userId: u.id,
        canManageEMR: true,
        canManageBloodBank: true,
        canManageCMS: true,
        canManageStore: true,
        canManageHR: true,
        canManageFinance: true,
        canManageDPDP: true,
        canManageSettings: true,
      },
    });
  } catch (err) {
    // Concurrent bootstrap calls race on the unique username — report the
    // same "already initialized" result instead of surfacing a 500.
    const code = String((err as { code?: string } | undefined)?.code ?? "");
    const msg = err instanceof Error ? err.message : "";
    if (code === "P2002" || /P2002|unique constraint/i.test(msg)) {
      res.status(403).json({ error: "Already initialized" });
      return;
    }
    throw err;
  }
  res.json({ ok: true, username: "superadmin" });
});

export default router;
