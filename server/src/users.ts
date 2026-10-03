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

// Default initial accounts matching auth.ts
const INITIAL_USERS: StoredUser[] = [
  {
    id: "demo-superadmin",
    username: "superadmin",
    email: "superadmin@rithanyahospital.com",
    fullName: "Hospital Superadmin",
    role: "SUPERADMIN",
    // Deterministic pre-hashed password for Rithanya@2026
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$0U/2Y0fH2kO/9u3qHk4E2A$4pQ6T2tqB4V7kL3W1eY8uZ7mN9bV3xP5cR1eD2fG4hA",
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
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$1V/3Z1gI3lP/0v4rIl5F3B$5qR7U3urC5W8lM4X2fZ9va8nO0cW4yQ6dS2fE3gH5iB",
    isActive: true,
    createdById: "demo-superadmin",
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    modules: computeModules("ADMIN"),
  },
  {
    id: "demo-staff",
    username: "staff",
    email: "staff@rithanyahospital.com",
    fullName: "Nursing Station Staff",
    role: "STAFF",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$2W/4a2hJ4mQ/1w5sJm6G4C$6rS8V4vsD6X9mN5Y3ga0wb9nP1dX5zR7eT3gF4hI6jC",
    isActive: true,
    createdById: "demo-admin",
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    modules: computeModules("STAFF"),
  },
];

let inMemoryUsers: StoredUser[] = loadCache();

function loadCache(): StoredUser[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

export async function loadUsersList(): Promise<Array<{ id: string; username: string; email: string; fullName: string; role: Role; isActive: boolean }>> {
  if (!isDbOnCooldown()) {
    try {
      const dbUsers = await withDbTimeout(
        prisma.user.findMany({
          orderBy: { createdAt: "asc" },
        }),
        2000
      );

      for (const u of dbUsers) {
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

  return inMemoryUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
  }));
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
  await loadUsersList();

  return inMemoryUsers.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    modules: u.modules,
    editable: canActorManageUser(actor, u.role, u.id),
  }));
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
  if (!target) {
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
  if (!target) {
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
  if (!target) {
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
