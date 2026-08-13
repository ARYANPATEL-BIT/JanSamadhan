import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Hosted Neon Postgres; connection string lives in .env.local.
    url: process.env.DATABASE_URL ?? "",
  },
  // PostGIS/pgvector are pre-provisioned on Neon, not managed by drizzle.
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
