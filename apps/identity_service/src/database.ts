import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import type { AppConfig } from "./config.js";

export function createDatabase(config: Pick<AppConfig, "DATABASE_URL">): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
}

export type Database = PrismaClient;
