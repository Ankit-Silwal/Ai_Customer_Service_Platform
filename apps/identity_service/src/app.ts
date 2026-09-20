import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import type { Database } from "./database.js";
import { AppError } from "./errors.js";
import { IdentityService } from "./identity-service.js";
import { buildAuthGuards } from "./auth-guards.js";
import { adminRoutes } from "./routes/admin-routes.js";
import { authRoutes } from "./routes/auth-routes.js";
import { organizationRoutes } from "./routes/organization-routes.js";
import "./types.js";

export async function buildApp(config: AppConfig, database: Database) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL }, trustProxy: config.TRUST_PROXY });
  const service = new IdentityService(database, config);
  const guards = buildAuthGuards(service, config.SESSION_COOKIE_NAME);

  app.decorateRequest("principal", null);
  app.decorateRequest("organizationAccess", null);
  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes, { prefix: "/v1/auth", service, guards, config });
  await app.register(organizationRoutes, { prefix: "/v1/organizations", service, guards });
  await app.register(adminRoutes, { prefix: "/v1/admin", service, guards });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } }),
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      });
    }
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    }
    if (prismaError.code === "P2002") {
      return reply.code(409).send({ error: { code: "CONFLICT", message: "A unique value is already in use" } });
    }
    request.log.error({ err: error }, "unhandled request error");
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });

  return app;
}
