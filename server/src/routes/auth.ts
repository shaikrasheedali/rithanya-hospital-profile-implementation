import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
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

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
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

  // Bootstrap password must never be accepted as a real credential.
  const identity = ident === "rithanya@2026" || ident === "hameed@2026" ? "" : ident;

  const key = `${req.ip}:${identity}`;
  const now = Date.now();
  const cur = failLimiter.get(key);
  if (cur && now - cur.first < FAIL_WINDOW_MS && cur.n >= FAIL_LIMIT) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  if (isDbOnCooldown()) {
    res.status(503).json({ error: "Sign-in is temporarily unavailable (database busy). Please try again in a minute." });
    return;
  }

  try {
    const user = await withDbTimeout(
      prisma.user.findFirst({ where: { OR: [{ username: identity }, { email: identity }] } }),
      DB_READ_MS,
    );
    reportDbSuccess();
    const ok = user && user.isActive && (await verifyPassword(user.passwordHash, rawPw));
    if (user && ok) {
      failLimiter.delete(key);
      const token = await signSession(user.id, user.role as never);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
      await loadUser(user.id);
      await audit({ id: user.id, fullName: user.fullName }, "LOGIN", "User", user.id, user.username).catch(() => undefined);
      res.json({ ok: true, role: user.role });
      return;
    }

    recordFailure(key, now);
    // Generic message to avoid user enumeration.
    res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    if (isTransientDbError(err)) {
      reportDbError(err);
      console.warn("[auth/login] DB query failed:", err instanceof Error ? err.message : err);
      res.status(503).json({ error: "Sign-in is temporarily unavailable (database busy). Please try again in a minute." });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
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
router.post("/bootstrap", async (req, res) => {
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
  res.json({ ok: true, username: "superadmin" });
});

export default router;
