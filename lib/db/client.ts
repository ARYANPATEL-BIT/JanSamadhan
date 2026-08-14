import dns from "node:dns";
import net from "node:net";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Neon (and many cloud Postgres hosts) publish AAAA records. Node's happy-eyeballs
// then tries IPv6 first; on networks without v6 that attempt is ENETUNREACH and
// the remaining IPv4 attempts abort in ~250ms → ETIMEDOUT on ST_X feed queries.
dns.setDefaultResultOrder("ipv4first");
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
  net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const ssl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech");

// Reuse the client across HMR reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const client =
  globalForDb._pg ??
  postgres(connectionString, {
    max: 10,
    ssl: ssl ? "require" : false,
    prepare: false, // Neon pooler / PgBouncer cannot use named prepared statements
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
if (process.env.NODE_ENV !== "production") globalForDb._pg = client;

export const db = drizzle(client, { schema });
export { schema };
