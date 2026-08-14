// Seed reference data (Ranchi municipality + wards + departments + routing map)
// into the hosted Neon database. Non-destructive to reports/users — seed.sql
// only replaces the seed municipality (cascades to its wards/departments). It
// will error if existing reports reference those rows; use `npm run db:reset`
// (reset-neon.mjs) to wipe-and-reseed in that case.
//
// Run: node --env-file=.env.local seed/seed.mjs
import postgres from "postgres";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set (did you pass --env-file=.env.local?)");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

async function main() {
  console.log("🌱 Seeding wards + departments (seed/seed.sql)…");
  await sql.unsafe(readFileSync("seed/seed.sql", "utf-8"));
  console.log("🌱 Seeding department staff (seed/staff.sql)…");
  await sql.unsafe(readFileSync("seed/staff.sql", "utf-8"));

  const [{ count: mCount }] = await sql`SELECT count(*) FROM municipalities`;
  const [{ count: wCount }] = await sql`SELECT count(*) FROM wards`;
  const [{ count: dCount }] = await sql`SELECT count(*) FROM departments`;
  const [{ count: cdmCount }] = await sql`SELECT count(*) FROM category_department_map`;

  console.log("\n📊 Reference-data counts:");
  console.log(`   municipalities:          ${mCount}`);
  console.log(`   wards:                   ${wCount}`);
  console.log(`   departments:             ${dCount}`);
  console.log(`   category_department_map: ${cdmCount}`);

  await sql.end();
  console.log("\n✅ Seed complete.");
}

main().catch((e) => {
  console.error("❌ Seed error:", e.message);
  process.exit(1);
});
