import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma, isDbOnCooldown, reportDbError } from "../db.js";
import {
  audit,
  getSessionFromReq,
  hashPassword,
  signSession,
  verifyPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  DEMO_ACCOUNTS,
  loadUser,
} from "../auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const failLimiter = new Map<string, { n: number; first: number }>();

router.post("/login", loginLimiter, async (req, res) => {
  const { username, email, password } = req.body ?? {};
  const ident = String(username ?? email ?? "").trim().toLowerCase();
  const rawPw = String(password ?? "").trim();
  if (!ident || !rawPw) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const key = `${req.ip}:${ident}`;
  const now = Date.now();
  const cur = failLimiter.get(key);
  if (cur && now - cur.first < 10 * 60 * 1000 && cur.n >= 15) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const demo = DEMO_ACCOUNTS[ident];

  // If DB is on cooldown/timeout, immediately authenticate using demo accounts
  if (isDbOnCooldown()) {
    if (demo && rawPw === demo.pass) {
      failLimiter.delete(key);
      const token = await signSession(demo.id, demo.role);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
      await loadUser(demo.id);
      res.json({ ok: true, role: demo.role });
      return;
    }
    res.status(401).json({
      error: "Invalid credentials. Use demo credentials (superadmin / Rithanya@2026, admin / Admin@2026, or staff / Staff@2026).",
    });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: ident }, { email: ident }] },
    });
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

    // Check demo accounts as fallback
    if (demo && rawPw === demo.pass) {
      failLimiter.delete(key);
      const token = await signSession(demo.id, demo.role);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
      await loadUser(demo.id);
      res.json({ ok: true, role: demo.role });
      return;
    }

    const e = failLimiter.get(key);
    if (!e || now - e.first > 10 * 60 * 1000) failLimiter.set(key, { n: 1, first: now });
    else e.n += 1;
    // Generic message to avoid user enumeration.
    res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    reportDbError(err);
    console.warn("[auth/login] DB query failed, authenticating via demo accounts:", err instanceof Error ? err.message : err);
    if (demo && rawPw === demo.pass) {
      failLimiter.delete(key);
      const token = await signSession(demo.id, demo.role);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
      await loadUser(demo.id);
      res.json({ ok: true, role: demo.role });
      return;
    }
    res.status(401).json({
      error: "Invalid credentials. Use demo credentials (superadmin / Rithanya@2026, admin / Admin@2026, or staff / Staff@2026).",
    });
  }
});

router.post("/logout", async (req, res) => {
  const user = await getSessionFromReq(req);
  if (user) await audit({ id: user.id, fullName: user.fullName }, "LOGOUT", "User", user.id);
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
    const count = await prisma.user.count();
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
