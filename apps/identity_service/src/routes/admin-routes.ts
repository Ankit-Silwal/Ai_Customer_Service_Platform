import type { FastifyPluginAsync } from "fastify";
import {
  adminCreateUserSchema,
  adminListQuerySchema,
  adminOrganizationParamsSchema,
  adminUpdateOrganizationSchema,
  adminUpdateUserSchema,
  adminUserParamsSchema,
} from "../contracts.js";
import { requirePrincipal, type AuthGuards } from "../auth-guards.js";
import type { IdentityService } from "../identity-service.js";

interface AdminRoutesOptions {
  service: IdentityService;
  guards: AuthGuards;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, options) => {
  app.addHook("preHandler", options.guards.authenticate);
  app.addHook("preHandler", options.guards.platformAdmin);

  app.get("/users", async (request) => {
    const { cursor, limit } = adminListQuerySchema.parse(request.query);
    return { data: await options.service.adminListUsers(cursor, limit) };
  });

  app.post("/users", async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = adminCreateUserSchema.parse(request.body);
    return reply.code(201).send({ data: await options.service.adminCreateUser(principal.user.id, input) });
  });

  app.patch("/users/:userId", async (request) => {
    const principal = requirePrincipal(request);
    const { userId } = adminUserParamsSchema.parse(request.params);
    const input = adminUpdateUserSchema.parse(request.body);
    return { data: await options.service.adminUpdateUser(principal.user.id, userId, input) };
  });

  app.get("/organizations", async (request) => {
    const { cursor, limit } = adminListQuerySchema.parse(request.query);
    return { data: await options.service.adminListOrganizations(cursor, limit) };
  });

  app.patch("/organizations/:organizationId", async (request) => {
    const principal = requirePrincipal(request);
    const { organizationId } = adminOrganizationParamsSchema.parse(request.params);
    const input = adminUpdateOrganizationSchema.parse(request.body);
    return { data: await options.service.adminUpdateOrganization(principal.user.id, organizationId, input) };
  });
};
