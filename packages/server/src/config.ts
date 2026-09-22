import { z } from "zod";
export const config = z
  .object({
    DATABASE_URL: z.string().min(1),
    INTERNAL_SECRET: z.string().min(32),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    KNOWLEDGE_URL: z.url().default("http://localhost:4101"),
    S3_ENDPOINT: z.url(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(8),
    S3_BUCKET: z.string().default("relay-documents"),
    AI_API_KEY: z.string().default(""),
    AI_BASE_URL: z.url().default("https://api.openai.com/v1"),
    AI_MODEL: z.string().default("gpt-4.1-mini"),
    AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  })
  .parse(process.env);
