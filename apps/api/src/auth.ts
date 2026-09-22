import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "@relay/server/db";
import { hash } from "@relay/server/security";
import { HttpError } from "@relay/server/http";
import { config } from "@relay/server/config";

const principalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});
export const principal = (res: Response) =>
  principalSchema.parse(res.locals.user);
export function cookie(req: Request, name: string) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1) ?? ""
  );
}
export const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 86400_000,
};
export async function authenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = await pool.query(
    "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.suspended",
    [hash(cookie(req, "relay_session"))],
  );
  if (!result.rows[0]) throw new HttpError(401, "Please sign in to continue.");
  res.locals.user = result.rows[0];
  next();
}
export async function membership(
  res: Response,
  organizationId: string,
  roles = ["OWNER", "ADMIN", "AGENT", "VIEWER"],
) {
  const result = await pool.query(
    "SELECT m.role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$2 AND NOT o.suspended",
    [organizationId, principal(res).id],
  );
  if (!result.rows[0] || !roles.includes(result.rows[0].role as string))
    throw new HttpError(403, "You do not have permission to do that.");
}
export async function botAccess(res: Response, id: string, roles?: string[]) {
  const result = await pool.query("SELECT * FROM bots WHERE id=$1", [
    z.uuid().parse(id),
  ]);
  if (!result.rows[0]) throw new HttpError(404, "Bot not found.");
  const bot = result.rows[0] as {
    id: string;
    organization_id: string;
    name: string;
    published: boolean;
  };
  await membership(res, bot.organization_id, roles);
  return bot;
}
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const result = await pool.query(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+make_interval(secs=>$2)) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+make_interval(secs=>$2) ELSE rate_limits.expires_at END RETURNING count`,
    [key, seconds],
  );
  if (result.rows[0].count > limit)
    throw new HttpError(
      429,
      "Too many requests. Please wait a moment and try again.",
    );
}
