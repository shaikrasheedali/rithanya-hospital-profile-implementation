import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
  withDbRetry,
  DB_READ_MS,
  DB_WRITE_MS,
  isTransientDbError,
} from "./db.js";
import {
  computeModules,
  hashPassword,
  invalidateUserSession,
  registerOfflineUserResolver,
  type ModuleKey,
  type Role,
  type SessionUser,
} from "./auth.js";
import { encryptJson, decryptJson } from "./crypto.js";
import { enqueueOutbox, outboxHasPending, registerOutboxExecutor, wakeOutbox } from "./outbox.js";

export type StoredUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  modules: Record<ModuleKey, boolean>;
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "users-cache.json");

// Default initial accounts matching production credentials
const INITIAL_USERS: StoredUser[] = [
  {
    id: "demo-superadmin",
    username: "superadmin",
    email: "mgrhameed@gmail.com",
    fullName: "Hospital Superadmin",
    role: "SUPERADMIN",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$y9FaRbikQbjko2xdFTRBQw$mRnNdDFOHd4yrUnVEyEOPafHWNdTTG9+6Estrt+p6Ks",
    isActive: true,
    createdById: null,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    modules: computeModules("SUPERADMIN"),
  },
  {
    id: "demo-admin",
    username: "admin",
    email: "admin@rithanyahospital.com",
    fullName: "Administration Desk",
    role: "ADMIN",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$vWs3KyOUG4TCiouPGYfqLQ$f8UI7TLrpDExr4B1s7CZ9Pq/12aZ8DC14CgT44YJDIU",
    isActive: true,
    createdById: "demo-superadmin",
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    modules: computeModules("ADMIN"),
  },
];

let inMemoryUsers: StoredUser[] = loadCache();

function loadCache(): StoredUser[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      // New format: encrypted payload. Legacy: plaintext JSON (read-only migration).
      let parsed: unknown;
      if (raw.startsWith("{") && raw.includes('"cipherText') === false) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      if (!Array.isArray(parsed)) {
        const dec = decryptJson<StoredUser[]>(raw, null as unknown as StoredUser[]);
        parsed = Array.isArray(dec) ? dec : null;
      }
      if (Array.isArray(parsed) && (parsed as StoredUser[]).length > 0) {
        // Purge legacy demo accounts; DB is the credential authority now.
        const users = (parsed as StoredUser[]).filter(
          (u) => u.id !== "demo-staff" && u.username !== "staff",
        );
        // Older cache files stripped password hashes (and older reads kept the
        // built-in placeholder ids). Restore the documented first-install
        // hashes so built-in accounts keep working while the DB is unreachable.
        for (const u of users) {
          if (!u.passwordHash) {
            const initial = INITIAL_USERS.find((x) => x.id === u.id || x.username === u.username);
            if (initial) u.passwordHash = initial.passwordHash;
          }
        }
        return users;
      }
    }
  } catch (err) {
    console.warn("[users] Could not read users cache file:", err);
  }
  return [...INITIAL_USERS];
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // The cache file is AES-256-GCM encrypted at rest (see crypto.ts), so
    // password hashes are deliberately kept: they allow the documented admin
    // accounts to sign in while the shared database is briefly unreachable.
    fs.writeFileSync(CACHE_FILE, encryptJson(inMemoryUsers), "utf-8");
  } catch (err) {
    console.warn("[users] Could not persist users cache file:", err);
  }
}

/** Case-insensitive lookup of a cached account for offline authentication. */
export function findCachedUser(identity: string): StoredUser | undefined {
  const id = identity.trim().toLowerCase();
  if (!id) return undefined;
  return inMemoryUsers.find((u) => u.username.toLowerCase() === id || u.email.toLowerCase() === id);
}

/** True when at least one active cached account can authenticate offline. */
export function hasOfflineCredentials(): boolean {
  return inMemoryUsers.some((u) => u.isActive && Boolean(u.passwordHash));
}

export function canActorManageUser(actor: SessionUser, targetRole: Role, targetId?: string): boolean {
  if (targetId && targetId === actor.id) return false; // Cannot manage own account/permissions
  if (targetRole === "SUPERADMIN" && actor.role !== "SUPERADMIN") return false; // Non-superadmins cannot see or manage Superadmin
  if (actor.role === "SUPERADMIN") {
    // Superadmin can manage Admin and Staff, but not other Superadmins or self
    return targetRole === "ADMIN" || targetRole === "STAFF";
  }
  if (actor.role === "ADMIN") {
    // Admin can ONLY manage Staff
    return targetRole === "STAFF";
  }
  return false;
}

export async function loadUsersList(actor?: SessionUser): Promise<Array<{ id: string; username: string; email: string; fullName: string; role: Role; isActive: boolean }>> {
  if (!isDbOnCooldown()) {
    try {
      const [dbUsers, accessRows] = await Promise.all([
        withDbRetry(() => prisma.user.findMany({ orderBy: { createdAt: "asc" } }), DB_READ_MS, 2),
        withDbRetry(() => prisma.userModuleAccess.findMany(), DB_READ_MS, 2),
      ]);
      reportDbSuccess();
      const accessByUser = new Map(accessRows.map((a) => [a.userId, a]));

      for (const u of dbUsers) {
        const access = accessByUser.get(u.id) ?? null;
        const idx = inMemoryUsers.findIndex((x) => x.id === u.id || x.username === u.username);
        if (idx >= 0) {
          // The DB is the authority once reachable: adopt its id (replacing the
          // built-in placeholder ids), credentials and profile. Cached custom
          // permission matrices are kept unless the DB has an access row.
          const entry = inMemoryUsers[idx];
          entry.id = u.id;
          entry.username = u.username;
          entry.fullName = u.fullName;
          entry.email = u.email;
          entry.role = u.role as Role;
          entry.isActive = u.isActive;
          entry.passwordHash = u.passwordHash;
          if (access) entry.modules = computeModules(u.role as Role, access);
        } else {
          inMemoryUsers.push({
            id: u.id,
            username: u.username,
            email: u.email,
            fullName: u.fullName,
            role: u.role as Role,
            passwordHash: u.passwordHash,
            isActive: u.isActive,
            createdById: u.createdById,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
            modules: computeModules(u.role as Role, access),
          });
        }
      }
      persistCache();
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
      console.warn("[users] DB query failed, falling back to resilient user cache:", (err as Error)?.message || err);
    }
  }

  const list = inMemoryUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
  }));

  // Non-superadmin accounts must NEVER see superadmin's account or existence
  if (actor && actor.role !== "SUPERADMIN") {
    return list.filter((u) => u.role !== "SUPERADMIN");
  }

  return list;
}

export async function loadPermissionsMatrix(actor: SessionUser): Promise<Array<{
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  modules: Record<ModuleKey, boolean>;
  editable: boolean;
}>> {
  // Ensure fresh list
  await loadUsersList(actor);

  const list = inMemoryUsers.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    modules: u.modules,
    editable: canActorManageUser(actor, u.role, u.id),
  }));

  // Non-superadmin accounts must NEVER see superadmin's existence
  if (actor.role !== "SUPERADMIN") {
    return list.filter((u) => u.role !== "SUPERADMIN");
  }

  return list;
}

export async function createUserRecord(
  actor: SessionUser,
  body: {
    username?: unknown;
    email?: unknown;
    fullName?: unknown;
    role?: unknown;
    password?: unknown;
  }
): Promise<{ id: string }> {
  const role = String(body.role ?? "STAFF").toUpperCase() as Role;

  // Enforce strict role hierarchy
  if (actor.role === "SUPERADMIN") {
    if (role !== "ADMIN" && role !== "STAFF") {
      const err = new Error("Superadmins can only create Admin or Staff accounts");
      (err as any).status = 400;
      throw err;
    }
  } else if (actor.role === "ADMIN") {
    if (role !== "STAFF") {
      const err = new Error("Admins can only create Staff accounts");
      (err as any).status = 403;
      throw err;
    }
  } else {
    const err = new Error("You do not have permission to create accounts");
    (err as any).status = 403;
    throw err;
  }

  const rawUsername = String(body.username ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (rawUsername.length < 3) {
    const err = new Error("Username must be at least 3 characters");
    (err as any).status = 400;
    throw err;
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    const err = new Error("Please enter a valid email address");
    (err as any).status = 400;
    throw err;
  }

  const fullName = String(body.fullName ?? "").trim();
  if (fullName.length < 2) {
    const err = new Error("Full name is required");
    (err as any).status = 400;
    throw err;
  }

  const password = String(body.password ?? "");
  if (password.length < 8) {
    const err = new Error("Password must be at least 8 characters");
    (err as any).status = 400;
    throw err;
  }

  // Check unique username and email
  const clash = inMemoryUsers.find(
    (u) => u.username.toLowerCase() === rawUsername || u.email.toLowerCase() === email
  );
  if (clash) {
    const err = new Error("Username or email already in use");
    (err as any).status = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const defaultModules = computeModules(role);

  const newUser: StoredUser = {
    id,
    username: rawUsername,
    email,
    fullName,
    role,
    passwordHash,
    isActive: true,
    createdById: actor.id,
    createdAt: now,
    updatedAt: now,
    modules: defaultModules,
  };

  inMemoryUsers.push(newUser);
  persistCache();

  const op = {
    module: "users" as const,
    action: "create" as const,
    key: `user:${id}`,
    payload: {
      id,
      username: rawUsername,
      email,
      fullName,
      role,
      passwordHash,
      createdById: actor.id,
      modules: defaultModules,
    },
  };
  await persistUserWrite(op, () => applyUserCreate(op.payload as never));

  return { id };
}

function accessRowFromModules(mods: Record<ModuleKey, boolean>) {
  return {
    canManageEMR: mods.emr,
    canManageBloodBank: mods.bloodbank,
    canManageCMS: mods.cms,
    canManageStore: mods.store,
    canManageHR: mods.hr,
    canManageFinance: mods.finance,
    canManageDPDP: mods.dpdp,
    canManageSettings: mods.settings,
  };
}

async function applyUserCreate(p: {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  createdById: string;
  modules: Record<ModuleKey, boolean>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: p.id,
        username: p.username,
        email: p.email,
        fullName: p.fullName,
        role: p.role,
        passwordHash: p.passwordHash,
        createdById: p.createdById,
      },
    });
    await tx.userModuleAccess.create({
      data: { userId: p.id, ...accessRowFromModules(p.modules) },
    });
  });
}

async function applyUserUpdate(p: { id: string; data: Record<string, unknown> }): Promise<void> {
  await prisma.user.update({ where: { id: p.id }, data: p.data as never });
}

/** Awaited user persistence helper: DB first, durable outbox on any failure. */
async function persistUserWrite(
  op: { module: "users"; action: "create" | "update" | "delete" | "modules"; key: string; payload: unknown },
  run: () => Promise<unknown>,
): Promise<void> {
  if (outboxHasPending("users") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(run(), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    console.warn(`[users] DB write failed (${op.action}) — queued for durable retry:`, (err as Error)?.message || err);
    enqueueOutbox(op);
  }
}

// Offline session resolution: while the shared MySQL is unreachable (cooldown
// or transient outage) sessions resolve from the encrypted users cache instead
// of 401-ing the admin out. When a DB load succeeds, the cache is refreshed so
// offline sign-in always compares against the latest known credentials.
registerOfflineUserResolver(
  (id) => {
    const u = inMemoryUsers.find((x) => x.id === id);
    if (!u || !u.isActive) return null;
    return { id: u.id, username: u.username, fullName: u.fullName, role: u.role, modules: u.modules };
  },
  (session, passwordHash) => {
    const entry = inMemoryUsers.find((x) => x.id === session.id || x.username === session.username);
    if (!entry) return;
    entry.id = session.id; // adopt the DB id when it differs from a placeholder
    entry.username = session.username;
    entry.fullName = session.fullName;
    entry.role = session.role;
    entry.modules = session.modules;
    if (passwordHash) entry.passwordHash = passwordHash;
    persistCache();
  },
);

registerOutboxExecutor("users", async (op) => {
  if (op.action === "create") {
    await applyUserCreate(op.payload as never);
    return;
  }
  if (op.action === "update") {
    const p = op.payload as { id: string; data: Record<string, unknown> };
    await prisma.user.update({ where: { id: p.id }, data: p.data as never });
    return;
  }
  if (op.action === "delete") {
    const p = op.payload as { id: string };
    await prisma.user.delete({ where: { id: p.id } });
    return;
  }
  if (op.action === "modules") {
    const p = op.payload as { userId: string; mods: Record<ModuleKey, boolean> };
    await prisma.userModuleAccess.upsert({
      where: { userId: p.userId },
      create: { userId: p.userId, ...accessRowFromModules(p.mods) },
      update: accessRowFromModules(p.mods),
    });
    return;
  }
});

export async function updateUserRecord(
  actor: SessionUser,
  id: string,
  body: {
    fullName?: unknown;
    email?: unknown;
    role?: unknown;
    isActive?: unknown;
    password?: unknown;
  }
): Promise<void> {
  const target = inMemoryUsers.find((u) => u.id === id);
  if (!target || (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN")) {
    const err = new Error("User not found");
    (err as any).status = 404;
    throw err;
  }

  // Hierarchy check
  if (id === actor.id) {
    if (body.isActive === false) {
      const err = new Error("You cannot deactivate your own account");
      (err as any).status = 400;
      throw err;
    }
  } else {
    if (!canActorManageUser(actor, target.role, id)) {
      const err = new Error(actor.role === "ADMIN" ? "Admins can only manage Staff accounts" : "Access denied");
      (err as any).status = 403;
      throw err;
    }
  }

  if (body.fullName !== undefined) target.fullName = String(body.fullName).trim();
  if (body.email !== undefined) target.email = String(body.email).trim().toLowerCase();
  if (body.isActive !== undefined) target.isActive = Boolean(body.isActive);

  if (body.role !== undefined && body.role !== target.role) {
    if (id === actor.id) {
      const err = new Error("You cannot change your own role");
      (err as any).status = 400;
      throw err;
    }
    if (actor.role !== "SUPERADMIN") {
      const err = new Error("Only a Superadmin can change user roles");
      (err as any).status = 403;
      throw err;
    }
    const newRole = String(body.role).toUpperCase() as Role;
    if (newRole !== "ADMIN" && newRole !== "STAFF") {
      const err = new Error("Role must be ADMIN or STAFF");
      (err as any).status = 400;
      throw err;
    }
    target.role = newRole;
    target.modules = computeModules(newRole);
  }

  if (body.password) {
    const pw = String(body.password);
    if (pw.length < 8) {
      const err = new Error("Password must be at least 8 characters");
      (err as any).status = 400;
      throw err;
    }
    target.passwordHash = await hashPassword(pw);
  }

  target.updatedAt = new Date().toISOString();
  persistCache();
  invalidateUserSession(id);

  const op = {
    module: "users" as const,
    action: "update" as const,
    key: `user:${id}`,
    payload: {
      id,
      data: {
        fullName: target.fullName,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
        ...(body.password ? { passwordHash: target.passwordHash } : {}),
      },
    },
  };
  await persistUserWrite(op, () => applyUserUpdate(op.payload as never));
}

export async function deleteUserRecord(actor: SessionUser, id: string): Promise<void> {
  if (id === actor.id) {
    const err = new Error("You cannot delete your own account");
    (err as any).status = 400;
    throw err;
  }

  const target = inMemoryUsers.find((u) => u.id === id);
  if (!target || (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN")) {
    const err = new Error("User not found");
    (err as any).status = 404;
    throw err;
  }

  if (target.role === "SUPERADMIN") {
    const err = new Error("Superadmin accounts cannot be deleted");
    (err as any).status = 403;
    throw err;
  }

  if (!canActorManageUser(actor, target.role, id)) {
    const err = new Error(actor.role === "ADMIN" ? "Admins can only delete Staff accounts" : "Access denied");
    (err as any).status = 403;
    throw err;
  }

  const idx = inMemoryUsers.findIndex((u) => u.id === id);
  if (idx >= 0) inMemoryUsers.splice(idx, 1);
  persistCache();
  invalidateUserSession(id);

  await persistUserWrite(
    { module: "users", action: "delete", key: `user:${id}`, payload: { id } },
    async () => {
      await prisma.userModuleAccess.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    },
  );
}

export async function updatePermissionsRecord(
  actor: SessionUser,
  targetId: string,
  mods: Record<string, boolean>
): Promise<void> {
  if (targetId === actor.id) {
    const err = new Error("You cannot edit your own permissions");
    (err as any).status = 403;
    throw err;
  }

  const target = inMemoryUsers.find((u) => u.id === targetId);
  if (!target || (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN")) {
    const err = new Error("User not found");
    (err as any).status = 404;
    throw err;
  }

  if (target.role === "SUPERADMIN") {
    const err = new Error("Superadmin permissions are fixed with full access");
    (err as any).status = 403;
    throw err;
  }

  if (actor.role === "ADMIN" && target.role !== "STAFF") {
    const err = new Error("Admins can only manage Staff permissions");
    (err as any).status = 403;
    throw err;
  }

  if (actor.role !== "SUPERADMIN" && actor.role !== "ADMIN") {
    const err = new Error("Staff members cannot manage permissions");
    (err as any).status = 403;
    throw err;
  }

  // Update target modules
  const current = { ...target.modules };
  for (const [k, v] of Object.entries(mods)) {
    if (k in current) {
      // Non-superadmins cannot enable settings
      if (k === "settings") {
        current[k as ModuleKey] = false;
      } else {
        current[k as ModuleKey] = Boolean(v);
      }
    }
  }

  target.modules = current;
  target.updatedAt = new Date().toISOString();
  persistCache();
  invalidateUserSession(targetId);

  await persistUserWrite(
    { module: "users", action: "modules", key: `user:${targetId}`, payload: { userId: targetId, mods: current } },
    async () =>
      prisma.userModuleAccess.upsert({
        where: { userId: targetId },
        create: { userId: targetId, ...accessRowFromModules(current) },
        update: accessRowFromModules(current),
      }),
  );
}
