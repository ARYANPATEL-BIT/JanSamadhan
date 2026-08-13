import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://civic:civic@localhost:5432/civic",
  },
  // PostGIS/pgvector extensions are created by docker/db-init, not by drizzle.
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
