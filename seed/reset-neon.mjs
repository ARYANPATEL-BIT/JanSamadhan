// Reset Neon database: clear all data, then re-seed with wards + departments
import postgres from "postgres";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

async function main() {
  console.log("🗑️  Clearing all data...");

  // Delete in dependency order (children first)
  await sql`DELETE FROM status_events`;
  await sql`DELETE FROM upvotes`;
  await sql`DELETE FROM report_media`;
  await sql`DELETE FROM reports`;
  await sql`DELETE FROM otp_codes`;
  await sql`DELETE FROM users`;
  await sql`DELETE FROM category_department_map`;
  await sql`DELETE FROM departments`;
  await sql`DELETE FROM wards`;
  await sql`DELETE FROM municipalities`;

  console.log("✅ All tables cleared.");

  console.log("🌱 Re-seeding wards + departments...");

  // Read and execute seed.sql
  const seedSql = readFileSync("seed/seed.sql", "utf-8");
  await sql.unsafe(seedSql);

  console.log("✅ Seed complete.");

  // Verify
  const [{ count: mCount }] = await sql`SELECT count(*) FROM municipalities`;
  const [{ count: wCount }] = await sql`SELECT count(*) FROM wards`;
  const [{ count: dCount }] = await sql`SELECT count(*) FROM departments`;
  const [{ count: cdmCount }] = await sql`SELECT count(*) FROM category_department_map`;
  const [{ count: rCount }] = await sql`SELECT count(*) FROM reports`;
  const [{ count: uCount }] = await sql`SELECT count(*) FROM users`;

  console.log("\n📊 Table counts after reset:");
  console.log(`   municipalities:        ${mCount}`);
  console.log(`   wards:                 ${wCount}`);
  console.log(`   departments:           ${dCount}`);
  console.log(`   category_department_map: ${cdmCount}`);
  console.log(`   users:                 ${uCount}`);
  console.log(`   reports:               ${rCount}`);

  await sql.end();
  console.log("\n🏁 Done. Database is clean and re-seeded.");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
