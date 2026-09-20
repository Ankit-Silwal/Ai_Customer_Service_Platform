import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { organizationParamsSchema, type OrganizationRole } from "./contracts.js";
import { forbidden, unauthorized } from "./errors.js";
import type { IdentityService } from "./identity-service.js";

export interface AuthGuards {
  authenticate: preHandlerHookHandler;
  platformAdmin: preHandlerHookHandler;
  organizationMember: (allowedRoles?: readonly OrganizationRole[]) => preHandlerHookHandler;
}

function readToken(request: FastifyRequest, cookieName: string): string | undefined {
  const bearer = request.headers.authorization;
  if (bearer?.startsWith("Bearer ")) return bearer.slice("Bearer ".length).trim() || undefined;
  return request.cookies[cookieName];
}

export function requirePrincipal(request: FastifyRequest) {
  if (!request.principal) throw unauthorized();
  return request.principal;
}

export function requireOrganizationAccess(request: FastifyRequest) {
  if (!request.organizationAccess) throw forbidden();
  return request.organizationAccess;
}

export function buildAuthGuards(service: IdentityService, cookieName: string): AuthGuards {
  const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = readToken(request, cookieName);
    if (!token) throw unauthorized();
    const principal = await service.resolveSession(token);
    if (!principal) throw unauthorized("The session is invalid or has expired");
    request.principal = principal;
  };

  const platformAdmin = async (request: FastifyRequest, _reply: FastifyReply) => {
    const principal = requirePrincipal(request);
    if (principal.user.platformRole !== "ADMIN") throw forbidden("Platform administrator access is required");
  };

  const organizationMember = (allowedRoles?: readonly OrganizationRole[]) =>
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const principal = requirePrincipal(request);
      const { organizationId } = organizationParamsSchema.parse(request.params);
      const access = await service.findOrganizationAccess(principal.user.id, organizationId);
      if (!access) throw forbidden("You are not an active member of this organization");
      if (allowedRoles && !allowedRoles.includes(access.role)) throw forbidden();
      request.organizationAccess = access;
    };

  return { authenticate, platformAdmin, organizationMember };
}
