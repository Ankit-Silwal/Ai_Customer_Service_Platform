import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 32 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  })) as Buffer;
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltText, hashText] = encoded.split("$");
  if (!algorithm || algorithm !== "scrypt" || !costText || !blockText || !parallelText || !saltText || !hashText) {
    return false;
  }
  const cost = Number(costText);
  const blockSize = Number(blockText);
  const parallelization = Number(parallelText);
  if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) return false;
  const expected = Buffer.from(hashText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = (await scrypt(password, Buffer.from(saltText, "base64url"), KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEMORY,
  })) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
