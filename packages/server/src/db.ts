import pg from "pg";
import { config } from "./config.ts";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 12,
});
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function audit(
  organizationId: string,
  actorId: string | null,
  action: string,
  targetId: string,
  client: pg.Pool | pg.PoolClient = pool,
) {
  await client.query(
    "INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
    [organizationId, actorId, action, targetId],
  );
}
