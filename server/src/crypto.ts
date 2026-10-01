import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function masterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  return crypto
    .createHash("sha256")
    .update("rithanya-emr-master::" + (process.env.DATABASE_URL ?? "local"))
    .digest();
}

export function encryptField(plain: string): string {
  if (!plain) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptField(payload: string | null | undefined): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0].length !== 24) return payload;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey(), Buffer.from(parts[0], "hex"));
    decipher.setAuthTag(Buffer.from(parts[1], "hex"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "[unreadable]";
  }
}

export function encryptJson(value: unknown): string {
  return encryptField(JSON.stringify(value));
}

export function decryptJson<T>(payload: string | null | undefined, fallback: T): T {
  const s = decryptField(payload);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
