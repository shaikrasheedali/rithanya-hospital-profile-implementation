import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { audit, getSessionFromReq, hashPassword, signSession, verifyPassword, SESSION_COOKIE, sessionCookieOptions } from "../auth.js";

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
  if (!ident || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const key = `${req.ip}:${ident}`;
  const now = Date.now();
  const cur = failLimiter.get(key);
  if (cur && now - cur.first < 10 * 60 * 1000 && cur.n >= 8) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: ident }, { email: ident }] },
  });
  const ok = user && user.isActive && (await verifyPassword(user.passwordHash, String(password)));
  if (!user || !ok) {
    const e = failLimiter.get(key);
    if (!e || now - e.first > 10 * 60 * 1000) failLimiter.set(key, { n: 1, first: now });
    else e.n += 1;
    res.status(401).json({ error: !user || !user.isActive ? "Invalid credentials or deactivated account" : "Invalid credentials" });
    return;
  }
  failLimiter.delete(key);
  const token = await signSession(user.id, user.role as never);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
  await audit({ id: user.id, fullName: user.fullName }, "LOGIN", "User", user.id, user.username);
  res.json({ ok: true, role: user.role });
});

router.post("/logout", async (req, res) => {
  const user = await getSessionFromReq(req);
  if (user) await audit({ id: user.id, fullName: user.fullName }, "LOGOUT", "User", user.id);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
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
  const count = await prisma.user.count();
  if (count > 0) {
    res.status(403).json({ error: "Already initialized" });
    return;
  }
  const password = String(req.body?.password ?? "Rithanya@2026");
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
