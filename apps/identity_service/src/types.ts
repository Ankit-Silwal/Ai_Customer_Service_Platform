import type { OrganizationRole, PlatformRole, UserStatus } from "./contracts.js";

export interface SessionPrincipal {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string;
    platformRole: PlatformRole;
    status: UserStatus;
  };
}

export interface OrganizationAccess {
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
}

declare module "fastify" {
  interface FastifyRequest {
    principal: SessionPrincipal | null;
    organizationAccess: OrganizationAccess | null;
  }
}
