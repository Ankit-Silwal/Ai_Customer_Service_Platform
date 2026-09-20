import { z } from "zod";

export const platformRoleSchema = z.enum(["USER", "ADMIN"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
export const organizationRoleSchema = z.enum(["OWNER", "ADMIN", "AGENT", "VIEWER"]);
export const organizationStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>;

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const nameSchema = z.string().trim().min(2).max(120);
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z.strictObject({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  organizationName: nameSchema,
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.strictObject({ name: nameSchema });
export const createOrganizationSchema = z.strictObject({ name: nameSchema });
export const updateOrganizationSchema = z.strictObject({ name: nameSchema });
export const organizationParamsSchema = z.strictObject({ organizationId: z.uuid() });
export const membershipParamsSchema = organizationParamsSchema.extend({ memberId: z.uuid() });

export const addMemberSchema = z.strictObject({
  email: emailSchema,
  role: z.enum(["ADMIN", "AGENT", "VIEWER"]),
});

export const updateMemberSchema = z.strictObject({
  role: z.enum(["ADMIN", "AGENT", "VIEWER"]),
});

export const adminUserParamsSchema = z.strictObject({ userId: z.uuid() });
export const adminOrganizationParamsSchema = organizationParamsSchema;
export const adminListQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const adminCreateUserSchema = z.strictObject({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  platformRole: platformRoleSchema.default("USER"),
});
export const adminUpdateUserSchema = z
  .strictObject({
    name: nameSchema.optional(),
    platformRole: platformRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const adminUpdateOrganizationSchema = z
  .strictObject({
    name: nameSchema.optional(),
    status: organizationStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicOrganization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  role: OrganizationRole;
  createdAt: string;
  updatedAt: string;
}
