import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("hex");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function signScope(scope: object, secret: string) {
  const body = Buffer.from(
    JSON.stringify({ ...scope, expires: Date.now() + 60_000 }),
  ).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("hex")}`;
}
export function readScope(value: string, secret: string): unknown {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const result = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      expires: number;
    };
    return result.expires > Date.now() ? result : null;
  } catch {
    return null;
  }
}
