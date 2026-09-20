import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("identity_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(168),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".") || "environment").join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return result.data;
}
