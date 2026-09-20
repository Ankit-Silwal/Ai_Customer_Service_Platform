import type { FastifyPluginAsync } from "fastify";
import { loginSchema, registerSchema, updateProfileSchema } from "../contracts.js";
import type { AppConfig } from "../config.js";
import type { IdentityService } from "../identity-service.js";
import { requirePrincipal, type AuthGuards } from "../auth-guards.js";

interface AuthRoutesOptions {
  service: IdentityService;
  guards: AuthGuards;
  config: Pick<AppConfig, "NODE_ENV" | "SESSION_COOKIE_NAME">;
}

function metadata(request: { ip: string; headers: { [key: string]: string | string[] | undefined } }) {
  const userAgent = request.headers["user-agent"];
  return { ipAddress: request.ip, userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent };
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const cookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: options.config.NODE_ENV === "production",
  };

  app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await options.service.register(input, metadata(request));
    reply.setCookie(options.config.SESSION_COOKIE_NAME, result.session.token, {
      ...cookieOptions,
      expires: result.session.expiresAt,
    });
    return reply.code(201).send({
      data: { user: result.user, organization: result.organization, sessionExpiresAt: result.session.expiresAt.toISOString() },
    });
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await options.service.login(input, metadata(request));
    reply.setCookie(options.config.SESSION_COOKIE_NAME, result.session.token, {
      ...cookieOptions,
      expires: result.session.expiresAt,
    });
    return { data: { user: result.user, sessionExpiresAt: result.session.expiresAt.toISOString() } };
  });

  app.post("/logout", { preHandler: [options.guards.authenticate] }, async (request, reply) => {
    const principal = requirePrincipal(request);
    await options.service.logout(principal.sessionId, principal.user.id);
    reply.clearCookie(options.config.SESSION_COOKIE_NAME, cookieOptions);
    return reply.code(204).send();
  });

  app.post("/logout-all", { preHandler: [options.guards.authenticate] }, async (request, reply) => {
    const principal = requirePrincipal(request);
    await options.service.logoutAll(principal.user.id);
    reply.clearCookie(options.config.SESSION_COOKIE_NAME, cookieOptions);
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: [options.guards.authenticate] }, async (request) => {
    const principal = requirePrincipal(request);
    return { data: await options.service.getUser(principal.user.id) };
  });

  app.patch("/me", { preHandler: [options.guards.authenticate] }, async (request) => {
    const principal = requirePrincipal(request);
    const { name } = updateProfileSchema.parse(request.body);
    return { data: await options.service.updateProfile(principal.user.id, name) };
  });
};
