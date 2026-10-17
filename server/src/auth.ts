import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { hash, verify } from "@node-rs/argon2";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout, withDbRetry, DB_READ_MS, isTransientDbError } from "./db.js";

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

/** Loud boot-time diagnostics for weak default secrets in production. */
export function warnIfProductionSecretsWeak(): void {
  if (process.env.NODE_ENV !== "production") return;
  const hasJwt = Boolean(process.env.JWT_SECRET);
  const hasKey = /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_MASTER_KEY ?? "");
  if (!hasJwt || !hasKey) {
    console.warn(
      "\n==============================================================" +
        "\n  SECURITY WARNING" +
        "\n  NODE_ENV=production but " +
        (!hasJwt ? "JWT_SECRET " : "") +
        (!hasJwt && !hasKey ? "and " : "") +
        (!hasKey ? "ENCRYPTION_MASTER_KEY " : "") +
        "not set." +
        "\n  Secrets are currently derived from DATABASE_URL, which is weak." +
        "\n  Set strong JWT_SECRET and a 64-hex ENCRYPTION_MASTER_KEY env var." +
        "\n==============================================================\n",
    );
  }
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

export const userSessionCache = new Map<string, SessionUser>();

/**
 * Offline session resolution. users.ts registers a resolver that maps a user
 * id to the last-known SessionUser from the encrypted users cache, so admin
 * sessions keep working while the shared MySQL is briefly unreachable
 * (cooldown / transient outage) instead of being signed out with a 401.
 */
type OfflineUserResolver = (id: string) => SessionUser | null;
type OfflineUserRemember = (user: SessionUser, passwordHash?: string) => void;
/** Maps a cached (possibly placeholder) session id to the identity keys of the
 *  account, so an id-miss can be reconciled against the authoritative DB row. */
type OfflineUserReconcile = (id: string) => { username: string; email: string } | null;
let offlineUserResolver: OfflineUserResolver | null = null;
let offlineUserRemember: OfflineUserRemember | null = null;
let offlineUserReconcile: OfflineUserReconcile | null = null;

export function registerOfflineUserResolver(
  fn: OfflineUserResolver,
  remember?: OfflineUserRemember,
  reconcile?: OfflineUserReconcile,
): void {
  offlineUserResolver = fn;
  offlineUserRemember = remember ?? null;
  offlineUserReconcile = reconcile ?? null;
}

/**
 * Cache invalidation so permission/password changes take effect immediately.
 * Call after user updates (role change, deactivate, password reset, module
 * matrix change) and on logout. Passing no userId clears the whole cache.
 */
export function invalidateUserSession(userId?: string): void {
  if (userId) userSessionCache.delete(userId);
  else userSessionCache.clear();
}

export async function loadUser(userId: string): Promise<SessionUser | null> {
  const cached = userSessionCache.get(userId);
  if (cached) return cached;

  if (!isDbOnCooldown()) {
    try {
      let u = await withDbRetry(() => prisma.user.findUnique({ where: { id: userId } }), DB_READ_MS, 2);
      if (!u) {
        // Sessions minted from the users cache (built-in first-install accounts,
        // or sign-ins that happened while the DB was unreachable) can carry
        // placeholder ids. Reconcile them against the authoritative DB row by
        // username/email so those sessions survive the reconnect. A genuinely
        // deleted account still resolves to null — never resurrect it.
        const hint = offlineUserReconcile?.(userId);
        if (hint) {
          u = await withDbRetry(
            () => prisma.user.findFirst({ where: { OR: [{ username: hint.username }, { email: hint.email }] } }),
            DB_READ_MS,
            2,
          );
        }
      }
      if (!u || !u.isActive) return null;
      const a = await withDbTimeout(prisma.userModuleAccess.findUnique({ where: { userId: u.id } }), DB_READ_MS);
      const s: SessionUser = {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role as Role,
        modules: computeModules(u.role as Role, a),
      };
      userSessionCache.set(userId, s);
      // Also key the resolution under the DB id so permission/password
      // invalidations (which use DB ids) always find and clear it.
      if (s.id !== userId) userSessionCache.set(s.id, s);
      offlineUserRemember?.(s, u.passwordHash);
      return s;
    } catch (err) {
      if (Date.now() - (loadUserWarnedAt ?? 0) > 30_000) {
        loadUserWarnedAt = Date.now();
        console.warn("[auth] loadUser DB query failed:", err instanceof Error ? err.message : err);
      }
      reportDbError(err);
      // Data-logic errors (e.g. record genuinely missing) end here; transient
      // connectivity failures fall through to the offline cache below.
      if (!isTransientDbError(err)) return null;
    }
  }

  const offline = offlineUserResolver?.(userId) ?? null;
  if (offline) userSessionCache.set(userId, offline);
  return offline;
}

let loadUserWarnedAt = 0;

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
  if (isDbOnCooldown()) return;
  try {
    await withDbTimeout(
      prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId: entityId ?? null,
          details: details ?? null,
          userId: user?.id ?? null,
          userName: user?.fullName ?? "System",
        },
      }),
      1000,
    );
  } catch (e) {
    reportDbError(e);
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
