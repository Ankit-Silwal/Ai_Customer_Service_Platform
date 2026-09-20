import type { FastifyPluginAsync } from "fastify";
import {
  addMemberSchema,
  createOrganizationSchema,
  membershipParamsSchema,
  updateMemberSchema,
  updateOrganizationSchema,
} from "../contracts.js";
import { requireOrganizationAccess, requirePrincipal, type AuthGuards } from "../auth-guards.js";
import type { IdentityService } from "../identity-service.js";

interface OrganizationRoutesOptions {
  service: IdentityService;
  guards: AuthGuards;
}

const manageRoles = ["OWNER", "ADMIN"] as const;

export const organizationRoutes: FastifyPluginAsync<OrganizationRoutesOptions> = async (app, options) => {
  app.post("/", { preHandler: [options.guards.authenticate] }, async (request, reply) => {
    const principal = requirePrincipal(request);
    const { name } = createOrganizationSchema.parse(request.body);
    const organization = await options.service.createOrganization(principal.user.id, name);
    return reply.code(201).send({ data: organization });
  });

  app.get("/", { preHandler: [options.guards.authenticate] }, async (request) => {
    const principal = requirePrincipal(request);
    return { data: await options.service.listOrganizations(principal.user.id) };
  });

  app.get(
    "/:organizationId",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember()] },
    async (request) => ({ data: await options.service.getOrganization(requireOrganizationAccess(request)) }),
  );

  app.patch(
    "/:organizationId",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember(manageRoles)] },
    async (request) => {
      const { name } = updateOrganizationSchema.parse(request.body);
      const principal = requirePrincipal(request);
      return {
        data: await options.service.updateOrganization(requireOrganizationAccess(request), principal.user.id, name),
      };
    },
  );

  app.get(
    "/:organizationId/members",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember()] },
    async (request) => ({ data: await options.service.listMembers(requireOrganizationAccess(request).organizationId) }),
  );

  app.post(
    "/:organizationId/members",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember(manageRoles)] },
    async (request, reply) => {
      const input = addMemberSchema.parse(request.body);
      const principal = requirePrincipal(request);
      const member = await options.service.addMember(
        requireOrganizationAccess(request),
        principal.user.id,
        input.email,
        input.role,
      );
      return reply.code(201).send({ data: member });
    },
  );

  app.patch(
    "/:organizationId/members/:memberId",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember(manageRoles)] },
    async (request) => {
      const { memberId } = membershipParamsSchema.parse(request.params);
      const { role } = updateMemberSchema.parse(request.body);
      const principal = requirePrincipal(request);
      return {
        data: await options.service.updateMember(
          requireOrganizationAccess(request),
          principal.user.id,
          memberId,
          role,
        ),
      };
    },
  );

  app.delete(
    "/:organizationId/members/:memberId",
    { preHandler: [options.guards.authenticate, options.guards.organizationMember(manageRoles)] },
    async (request, reply) => {
      const { memberId } = membershipParamsSchema.parse(request.params);
      const principal = requirePrincipal(request);
      await options.service.removeMember(requireOrganizationAccess(request), principal.user.id, memberId);
      return reply.code(204).send();
    },
  );
};
