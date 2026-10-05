import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { computeModules, hashPassword, type ModuleKey, type Role, type SessionUser } from "./auth.js";

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
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enforce production superadmin and admin credentials, and purge legacy demo-staff
        const filtered = parsed.filter((u: StoredUser) => u.id !== "demo-staff" && u.username !== "staff");
        const sa = filtered.find((u: StoredUser) => u.username === "superadmin");
        if (sa) {
          sa.email = "mgrhameed@gmail.com";
          sa.passwordHash = "$argon2id$v=19$m=65536,t=3,p=4$y9FaRbikQbjko2xdFTRBQw$mRnNdDFOHd4yrUnVEyEOPafHWNdTTG9+6Estrt+p6Ks";
        }
        const adm = filtered.find((u: StoredUser) => u.username === "admin");
        if (adm) {
          adm.email = "admin@rithanyahospital.com";
          adm.passwordHash = "$argon2id$v=19$m=65536,t=3,p=4$vWs3KyOUG4TCiouPGYfqLQ$f8UI7TLrpDExr4B1s7CZ9Pq/12aZ8DC14CgT44YJDIU";
        }
        return filtered;
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
    fs.writeFileSync(CACHE_FILE, JSON.stringify(inMemoryUsers, null, 2), "utf-8");
  } catch (err) {
    console.warn("[users] Could not persist users cache file:", err);
  }
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
      const dbUsers = await withDbTimeout(
        prisma.user.findMany({
          orderBy: { createdAt: "asc" },
        }),
        2000
      );

      for (const u of dbUsers) {
        // Skip any legacy staff from DB if not desired
        const idx = inMemoryUsers.findIndex((x) => x.id === u.id || x.username === u.username);
        if (idx >= 0) {
          inMemoryUsers[idx].fullName = u.fullName;
          inMemoryUsers[idx].email = u.email;
          inMemoryUsers[idx].role = u.role as Role;
          inMemoryUsers[idx].isActive = u.isActive;
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
            modules: computeModules(u.role as Role),
          });
        }
      }
      persistCache();
    } catch (err) {
      reportDbError(err);
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

  // Background DB sync if available
  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id,
            username: rawUsername,
            email,
            fullName,
            role,
            passwordHash,
            createdById: actor.id,
          },
        });
        await tx.userModuleAccess.create({
          data: {
            userId: id,
            canManageEMR: defaultModules.emr,
            canManageBloodBank: defaultModules.bloodbank,
            canManageCMS: defaultModules.cms,
            canManageStore: defaultModules.store,
            canManageHR: defaultModules.hr,
            canManageFinance: defaultModules.finance,
            canManageDPDP: defaultModules.dpdp,
            canManageSettings: defaultModules.settings,
          },
        });
      }),
      3500
    ).catch((err) => {
      reportDbError(err);
      console.warn("[users] Background DB sync for user create failed:", err?.message || err);
    });
  }

  return { id };
}

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

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.user.update({
        where: { id },
        data: {
          fullName: target.fullName,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
          passwordHash: target.passwordHash,
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
    });
  }
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

  if (!isDbOnCooldown()) {
    withDbTimeout(prisma.user.delete({ where: { id } }), 2500).catch((err) => {
      reportDbError(err);
    });
  }
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

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.userModuleAccess.upsert({
        where: { userId: targetId },
        create: {
          userId: targetId,
          canManageEMR: current.emr,
          canManageBloodBank: current.bloodbank,
          canManageCMS: current.cms,
          canManageStore: current.store,
          canManageHR: current.hr,
          canManageFinance: current.finance,
          canManageDPDP: current.dpdp,
          canManageSettings: false,
        },
        update: {
          canManageEMR: current.emr,
          canManageBloodBank: current.bloodbank,
          canManageCMS: current.cms,
          canManageStore: current.store,
          canManageHR: current.hr,
          canManageFinance: current.finance,
          canManageDPDP: current.dpdp,
          canManageSettings: false,
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
    });
  }
}
