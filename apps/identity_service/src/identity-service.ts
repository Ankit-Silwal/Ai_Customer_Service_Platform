import { randomBytes } from "node:crypto";
import type { AppConfig } from "./config.js";
import type {
  AdminCreateUserInput,
  LoginInput,
  OrganizationRole,
  PlatformRole,
  PublicOrganization,
  PublicUser,
  RegisterInput,
  UserStatus,
} from "./contracts.js";
import type { Database } from "./database.js";
import { conflict, forbidden, notFound, unauthorized } from "./errors.js";
import { createSessionToken, hashPassword, hashSessionToken, slugify, verifyPassword } from "./security.js";
import type { OrganizationAccess, SessionPrincipal } from "./types.js";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  platformRole: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicUserRecord = {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicUser(user: PublicUserRecord): PublicUser {
  return { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  updatedAt: Date;
};

function toPublicOrganization(organization: OrganizationRecord, role: OrganizationRole): PublicOrganization {
  return {
    ...organization,
    role,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionResult {
  token: string;
  expiresAt: Date;
}

export class IdentityService {
  public constructor(
    private readonly database: Database,
    private readonly config: Pick<AppConfig, "SESSION_TTL_HOURS">,
  ) {}

  private async createSession(userId: string, metadata: RequestMetadata): Promise<SessionResult> {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.database.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
        ipAddress: metadata.ipAddress?.slice(0, 64),
        userAgent: metadata.userAgent?.slice(0, 512),
      },
    });
    return { token, expiresAt };
  }

  public async register(input: RegisterInput, metadata: RequestMetadata) {
    const existingUser = await this.database.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existingUser) throw conflict("EMAIL_IN_USE", "An account already exists for this email address");

    const passwordHash = await hashPassword(input.password);
    const slug = `${slugify(input.organizationName) || "organization"}-${randomBytes(4).toString("hex")}`;
    const result = await this.database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email: input.email, name: input.name, passwordHash },
        select: publicUserSelect,
      });
      const organization = await transaction.organization.create({
        data: { name: input.organizationName, slug },
      });
      await transaction.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: user.id,
          organizationId: organization.id,
          action: "identity.registered",
          targetType: "user",
          targetId: user.id,
        },
      });
      return { user, organization };
    });
    const session = await this.createSession(result.user.id, metadata);
    return {
      user: toPublicUser(result.user),
      organization: toPublicOrganization(result.organization, "OWNER"),
      session,
    };
  }

  public async login(input: LoginInput, metadata: RequestMetadata) {
    const user = await this.database.user.findUnique({
      where: { email: input.email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("The email address or password is incorrect");
    }
    if (user.status !== "ACTIVE") throw forbidden("This account is suspended");
    const session = await this.createSession(user.id, metadata);
    await this.database.auditEvent.create({
      data: { actorUserId: user.id, action: "identity.logged_in", targetType: "session" },
    });
    return { user: toPublicUser(user), session };
  }

  public async resolveSession(rawToken: string): Promise<SessionPrincipal | null> {
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashSessionToken(rawToken) },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true, name: true, platformRole: true, status: true } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
    await this.database.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { sessionId: session.id, user: session.user };
  }

  public async logout(sessionId: string, actorUserId: string): Promise<void> {
    await this.database.$transaction([
      this.database.session.updateMany({ where: { id: sessionId, userId: actorUserId }, data: { revokedAt: new Date() } }),
      this.database.auditEvent.create({
        data: { actorUserId, action: "identity.logged_out", targetType: "session", targetId: sessionId },
      }),
    ]);
  }

  public async logoutAll(actorUserId: string): Promise<void> {
    await this.database.$transaction([
      this.database.session.updateMany({ where: { userId: actorUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.database.auditEvent.create({
        data: { actorUserId, action: "identity.logged_out_all", targetType: "user", targetId: actorUserId },
      }),
    ]);
  }

  public async getUser(userId: string): Promise<PublicUser> {
    const user = await this.database.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) throw notFound("User");
    return toPublicUser(user);
  }

  public async updateProfile(userId: string, name: string): Promise<PublicUser> {
    const user = await this.database.user.update({ where: { id: userId }, data: { name }, select: publicUserSelect });
    return toPublicUser(user);
  }

  public async findOrganizationAccess(userId: string, organizationId: string): Promise<OrganizationAccess | null> {
    const membership = await this.database.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true, role: true, organization: { select: { status: true } } },
    });
    if (!membership || membership.organization.status !== "ACTIVE") return null;
    return { membershipId: membership.id, organizationId, role: membership.role };
  }

  public async createOrganization(userId: string, name: string): Promise<PublicOrganization> {
    const slug = `${slugify(name) || "organization"}-${randomBytes(4).toString("hex")}`;
    const organization = await this.database.$transaction(async (transaction) => {
      const created = await transaction.organization.create({ data: { name, slug } });
      await transaction.membership.create({ data: { userId, organizationId: created.id, role: "OWNER" } });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          organizationId: created.id,
          action: "organization.created",
          targetType: "organization",
          targetId: created.id,
        },
      });
      return created;
    });
    return toPublicOrganization(organization, "OWNER");
  }

  public async listOrganizations(userId: string): Promise<PublicOrganization[]> {
    const memberships = await this.database.membership.findMany({
      where: { userId, organization: { status: "ACTIVE" } },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map(({ organization, role }) => toPublicOrganization(organization, role));
  }

  public async getOrganization(access: OrganizationAccess): Promise<PublicOrganization> {
    const organization = await this.database.organization.findUnique({ where: { id: access.organizationId } });
    if (!organization) throw notFound("Organization");
    return toPublicOrganization(organization, access.role);
  }

  public async updateOrganization(access: OrganizationAccess, actorUserId: string, name: string) {
    const organization = await this.database.$transaction(async (transaction) => {
      const updated = await transaction.organization.update({ where: { id: access.organizationId }, data: { name } });
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          organizationId: access.organizationId,
          action: "organization.updated",
          targetType: "organization",
          targetId: access.organizationId,
        },
      });
      return updated;
    });
    return toPublicOrganization(organization, access.role);
  }

  public async listMembers(organizationId: string) {
    const members = await this.database.membership.findMany({
      where: { organizationId },
      select: { id: true, role: true, createdAt: true, user: { select: publicUserSelect } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((member) => ({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      user: toPublicUser(member.user),
    }));
  }

  public async addMember(access: OrganizationAccess, actorUserId: string, email: string, role: Exclude<OrganizationRole, "OWNER">) {
    const user = await this.database.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (!user || user.status !== "ACTIVE") throw notFound("Active user");
    const existing = await this.database.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: access.organizationId } },
      select: { id: true },
    });
    if (existing) throw conflict("MEMBERSHIP_EXISTS", "This user is already an organization member");
    const membership = await this.database.$transaction(async (transaction) => {
      const created = await transaction.membership.create({
        data: { userId: user.id, organizationId: access.organizationId, role },
        select: { id: true, role: true, createdAt: true, user: { select: publicUserSelect } },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          organizationId: access.organizationId,
          action: "membership.created",
          targetType: "membership",
          targetId: created.id,
          metadata: { userId: user.id, role },
        },
      });
      return created;
    });
    return { ...membership, createdAt: membership.createdAt.toISOString(), user: toPublicUser(membership.user) };
  }

  public async updateMember(access: OrganizationAccess, actorUserId: string, memberId: string, role: Exclude<OrganizationRole, "OWNER">) {
    const target = await this.database.membership.findFirst({
      where: { id: memberId, organizationId: access.organizationId },
      select: { id: true, role: true, userId: true },
    });
    if (!target) throw notFound("Membership");
    if (target.role === "OWNER") throw forbidden("The owner role cannot be changed through this endpoint");
    if (access.role !== "OWNER" && (target.role === "ADMIN" || role === "ADMIN")) {
      throw forbidden("Only an organization owner can manage administrators");
    }
    const updated = await this.database.$transaction(async (transaction) => {
      const membership = await transaction.membership.update({
        where: { id: memberId },
        data: { role },
        select: { id: true, role: true, createdAt: true, user: { select: publicUserSelect } },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          organizationId: access.organizationId,
          action: "membership.updated",
          targetType: "membership",
          targetId: memberId,
          metadata: { previousRole: target.role, role },
        },
      });
      return membership;
    });
    return { ...updated, createdAt: updated.createdAt.toISOString(), user: toPublicUser(updated.user) };
  }

  public async removeMember(access: OrganizationAccess, actorUserId: string, memberId: string): Promise<void> {
    const target = await this.database.membership.findFirst({
      where: { id: memberId, organizationId: access.organizationId },
      select: { id: true, role: true, userId: true },
    });
    if (!target) throw notFound("Membership");
    if (target.role === "OWNER") throw forbidden("The organization owner cannot be removed");
    if (access.role !== "OWNER" && target.role === "ADMIN") throw forbidden("Only an organization owner can remove administrators");
    await this.database.$transaction([
      this.database.membership.delete({ where: { id: memberId } }),
      this.database.auditEvent.create({
        data: {
          actorUserId,
          organizationId: access.organizationId,
          action: "membership.deleted",
          targetType: "membership",
          targetId: memberId,
          metadata: { userId: target.userId, role: target.role },
        },
      }),
    ]);
  }

  public async adminListUsers(cursor: string | undefined, limit: number) {
    const users = await this.database.user.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: publicUserSelect,
    });
    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;
    return { items: page.map(toPublicUser), nextCursor: hasMore ? page.at(-1)?.id : undefined };
  }

  public async adminCreateUser(actorUserId: string, input: AdminCreateUserInput): Promise<PublicUser> {
    if (await this.database.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw conflict("EMAIL_IN_USE", "An account already exists for this email address");
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.database.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: { email: input.email, name: input.name, passwordHash, platformRole: input.platformRole },
        select: publicUserSelect,
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          action: "admin.user_created",
          targetType: "user",
          targetId: created.id,
          metadata: { platformRole: created.platformRole },
        },
      });
      return created;
    });
    return toPublicUser(user);
  }

  public async adminUpdateUser(
    actorUserId: string,
    userId: string,
    input: { name?: string; platformRole?: PlatformRole; status?: UserStatus },
  ): Promise<PublicUser> {
    if (actorUserId === userId && (input.platformRole === "USER" || input.status === "SUSPENDED")) {
      throw forbidden("Administrators cannot demote or suspend their own account");
    }
    const result = await this.database.$transaction(async (transaction) => {
      const user = await transaction.user.update({ where: { id: userId }, data: input, select: publicUserSelect });
      if (input.status === "SUSPENDED") {
        await transaction.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          action: "admin.user_updated",
          targetType: "user",
          targetId: userId,
          metadata: input,
        },
      });
      return user;
    });
    return toPublicUser(result);
  }

  public async adminListOrganizations(cursor: string | undefined, limit: number) {
    const organizations = await this.database.organization.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    const hasMore = organizations.length > limit;
    const page = hasMore ? organizations.slice(0, limit) : organizations;
    return {
      items: page.map((organization) => ({
        ...organization,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      })),
      nextCursor: hasMore ? page.at(-1)?.id : undefined,
    };
  }

  public async adminUpdateOrganization(
    actorUserId: string,
    organizationId: string,
    input: { name?: string; status?: "ACTIVE" | "SUSPENDED" },
  ) {
    return this.database.$transaction(async (transaction) => {
      const organization = await transaction.organization.update({ where: { id: organizationId }, data: input });
      await transaction.auditEvent.create({
        data: {
          actorUserId,
          organizationId,
          action: "admin.organization_updated",
          targetType: "organization",
          targetId: organizationId,
          metadata: input,
        },
      });
      return {
        ...organization,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      };
    });
  }
}
