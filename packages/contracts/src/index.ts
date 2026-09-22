import { z } from "zod";

export const idSchema = z.uuid();
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  company: z.string().trim().min(2).max(80),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const botSchema = z.object({
  name: z.string().trim().min(2).max(80),
  greeting: z.string().trim().min(2).max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  published: z.boolean(),
});
export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  requestId: z.uuid(),
});
export const uploadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[^/\\\x00-\x1f]+$/),
  content: z.string().min(1).max(7_000_000),
  type: z.enum(["text/plain", "text/markdown", "application/pdf"]),
});
export const searchSchema = z.object({
  organizationId: idSchema,
  botId: idSchema,
  question: z.string().min(1).max(2000),
});
export const scopeSchema = searchSchema.pick({
  organizationId: true,
  botId: true,
});
export const citationSchema = z.object({
  documentId: idSchema,
  name: z.string(),
  page: z.number(),
  excerpt: z.string(),
});
export const answerSchema = z.object({
  content: z.string(),
  citations: z.array(citationSchema),
  mode: z.enum(["ai", "preview", "fallback"]),
  tokens: z.number(),
});
export const memberSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "AGENT", "VIEWER"]),
});
export type Citation = z.infer<typeof citationSchema>;
export type Bot = z.infer<typeof botSchema> & {
  id: string;
  organization_id: string;
  public_id: string;
};
export type Document = {
  id: string;
  name: string;
  status: "queued" | "processing" | "ready" | "failed";
  bytes: number;
  chunks: number;
  error: string | null;
  created_at: string;
};
export type Message = {
  id: string;
  role: "customer" | "assistant" | "agent" | "system";
  content: string;
  citations: Citation[];
  created_at: string;
};
export type Conversation = {
  id: string;
  title: string;
  mode: "ai" | "waiting" | "human" | "resolved";
  version: number;
  updated_at: string;
  messages: Message[];
};
export type Workspace = {
  id: string;
  name: string;
  role: "OWNER" | "ADMIN" | "AGENT" | "VIEWER";
};
export type Me = {
  user: { id: string; name: string; email: string };
  organizations: Workspace[];
  aiEnabled: boolean;
};
