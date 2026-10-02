import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { hash, verify } from "@node-rs/argon2";
import { prisma, isDbOnCooldown, reportDbError } from "./db.js";

export type Role = "SUPERADMIN" | "ADMIN" | "STAFF";
export type ModuleKey = "emr" | "bloodbank" | "cms" | "store" | "hr" | "finance" | "dpdp" | "settings" | "access";

export const SESSION_COOKIE = "rh_session";

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  modules: Record<ModuleKey, boolean>;
};

const ARGON_OPTS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS);
export const verifyPassword = async (hashed: string, pw: string) => {
  try {
    return await verify(hashed, pw);
  } catch {
    return false;
  }
};

function secret(): Uint8Array {
  const s =
    process.env.JWT_SECRET ??
    crypto.createHash("sha256").update("rithanya-jwt::" + (process.env.DATABASE_URL ?? "local")).digest("hex");
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10h")
    .sign(secret());
}

async function readToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export const ROLE_DEFAULTS: Record<Role, Record<Exclude<ModuleKey, "access">, boolean>> = {
  SUPERADMIN: { emr: true, bloodbank: true, cms: true, store: true, hr: true, finance: true, dpdp: true, settings: true },
  ADMIN: { emr: true, bloodbank: true, cms: true, store: true, hr: true, finance: true, dpdp: true, settings: false },
  STAFF: { emr: true, bloodbank: true, cms: false, store: true, hr: false, finance: false, dpdp: false, settings: false },
};

type AccessRow = {
  canManageEMR: boolean;
  canManageBloodBank: boolean;
  canManageCMS: boolean;
  canManageStore: boolean;
  canManageHR: boolean;
  canManageFinance: boolean;
  canManageDPDP: boolean;
  canManageSettings: boolean;
};

export function computeModules(role: Role, a?: AccessRow | null): Record<ModuleKey, boolean> {
  if (role === "SUPERADMIN") return { ...ROLE_DEFAULTS.SUPERADMIN, access: true };
  const d = ROLE_DEFAULTS[role];
  return {
    emr: a ? a.canManageEMR : d.emr,
    bloodbank: a ? a.canManageBloodBank : d.bloodbank,
    cms: a ? a.canManageCMS : d.cms,
    store: a ? a.canManageStore : d.store,
    hr: a ? a.canManageHR : d.hr,
    finance: a ? a.canManageFinance : d.finance,
    dpdp: a ? a.canManageDPDP : d.dpdp,
    settings: false,
    access: role === "ADMIN",
  };
}

export const DEMO_ACCOUNTS: Record<string, { role: Role; pass: string; name: string; username: string; id: string }> = {
  superadmin: { role: "SUPERADMIN", pass: "Rithanya@2026", name: "Hospital Superadmin", username: "superadmin", id: "demo-superadmin" },
  "superadmin@rithanyahospital.com": { role: "SUPERADMIN", pass: "Rithanya@2026", name: "Hospital Superadmin", username: "superadmin", id: "demo-superadmin" },
  admin: { role: "ADMIN", pass: "Admin@2026", name: "Administration Desk", username: "admin", id: "demo-admin" },
  "admin@rithanyahospital.com": { role: "ADMIN", pass: "Admin@2026", name: "Administration Desk", username: "admin", id: "demo-admin" },
  staff: { role: "STAFF", pass: "Staff@2026", name: "Nursing Station Staff", username: "staff", id: "demo-staff" },
  "staff@rithanyahospital.com": { role: "STAFF", pass: "Staff@2026", name: "Nursing Station Staff", username: "staff", id: "demo-staff" },
};

export const userSessionCache = new Map<string, SessionUser>();

export async function loadUser(userId: string): Promise<SessionUser | null> {
  const cached = userSessionCache.get(userId);
  if (cached) return cached;

  if (userId === "demo-superadmin") {
    const s: SessionUser = { id: userId, username: "superadmin", fullName: "Hospital Superadmin", role: "SUPERADMIN", modules: computeModules("SUPERADMIN") };
    userSessionCache.set(userId, s);
    return s;
  }
  if (userId === "demo-admin") {
    const s: SessionUser = { id: userId, username: "admin", fullName: "Administration Desk", role: "ADMIN", modules: computeModules("ADMIN") };
    userSessionCache.set(userId, s);
    return s;
  }
  if (userId === "demo-staff") {
    const s: SessionUser = { id: userId, username: "staff", fullName: "Nursing Station Staff", role: "STAFF", modules: computeModules("STAFF") };
    userSessionCache.set(userId, s);
    return s;
  }
  if (userId.startsWith("demo-")) {
    const cleanUser = userId.replace("demo-", "");
    const role: Role = cleanUser.includes("superadmin") ? "SUPERADMIN" : cleanUser.includes("admin") ? "ADMIN" : "STAFF";
    const s: SessionUser = {
      id: userId,
      username: cleanUser,
      fullName: role === "SUPERADMIN" ? "Hospital Superadmin" : role === "ADMIN" ? "Administration Desk" : "Nursing Station Staff",
      role,
      modules: computeModules(role),
    };
    userSessionCache.set(userId, s);
    return s;
  }

  if (!isDbOnCooldown()) {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u || !u.isActive) return null;
      const a = await prisma.userModuleAccess.findUnique({ where: { userId: u.id } });
      const s: SessionUser = { id: u.id, username: u.username, fullName: u.fullName, role: u.role as Role, modules: computeModules(u.role as Role, a) };
      userSessionCache.set(userId, s);
      return s;
    } catch (err) {
      reportDbError(err);
      console.warn("[auth] loadUser DB query failed:", err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function getSessionFromReq(req: Request): Promise<SessionUser | null> {
  const token = (req as unknown as { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const sub = await readToken(token);
  return sub ? loadUser(sub) : null;
}

export function sessionCookieOptions(req: Request) {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
  const secure = proto === "https";
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 60 * 60 * 10 * 1000,
  };
}

export function requireAuth(module?: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      if (origin) {
        const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host;
        try {
          if (host && new URL(origin).host !== host) {
            res.status(403).json({ error: "Cross-origin request blocked" });
            return;
          }
        } catch {
          res.status(403).json({ error: "Bad origin" });
          return;
        }
      }
    }
    const user = await getSessionFromReq(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (module && !user.modules[module]) {
      res.status(403).json({ error: "You do not have access to this module" });
      return;
    }
    (req as unknown as { user: SessionUser }).user = user;
    next();
  };
}

export function getUser(req: Request): SessionUser {
  return (req as unknown as { user: SessionUser }).user;
}

export async function audit(
  user: { id: string; fullName: string } | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? null,
        details: details ?? null,
        userId: user?.id ?? null,
        userName: user?.fullName ?? "System",
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

export function getEntity(req: Request): "RITHANYA_HOSPITAL" | "RVBC" {
  const q = (req.query as Record<string, unknown>)?.entity;
  if (q === "RVBC" || q === "RITHANYA_HOSPITAL") return q;
  const h = req.headers["x-rh-entity"];
  if (h === "RVBC" || h === "RITHANYA_HOSPITAL") return h;
  const v = (req as unknown as { cookies?: Record<string, string> }).cookies?.["rh_entity"];
  return v === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
}
