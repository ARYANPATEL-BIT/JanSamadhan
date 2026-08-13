/**
 * Canonical schema — mirrors PRD §8.1. If this diverges from the PRD, update
 * docs/PRD.md too (CLAUDE.md rule: schema and PRD must not drift).
 *
 * Custom column types wrap PostGIS geography, pgvector, and bit(64) so
 * drizzle-kit emits the correct DDL. Spatial writes/reads mostly go through
 * raw `sql` (ST_MakePoint / ST_DWithin / ST_AsGeoJSON) in the service layer;
 * these definitions exist for DDL generation and typing.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom types (PostGIS / pgvector)
// ---------------------------------------------------------------------------
// Lowercase typmod (point/polygon) on purpose: PostGIS parses it
// case-insensitively, and drizzle-kit would double-quote a type string
// containing uppercase, producing invalid DDL ("geography(Point,4326)").
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(point,4326)";
  },
});

const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(polygon,4326)";
  },
});

/** CLIP ViT-B/32 image embedding — 512 dims. Populated in sprint 2. */
const vector512 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(512)";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
});

/** 64-bit perceptual hash (DCT pHash). Populated in sprint 2. */
const bit64 = customType<{ data: string; driverData: string }>({
  dataType() {
    return "bit(64)";
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const langEnum = pgEnum("lang", ["en", "hi", "bn", "mr", "ta", "te"]);

// §5.1 category set.
export const categoryEnum = pgEnum("category", [
  "pothole",
  "garbage_dump",
  "streetlight_out",
  "waterlogging",
  "broken_footpath",
  "open_drain",
  "illegal_dumping",
  "damaged_signage",
  "fallen_tree",
  "stray_animal",
  "other",
]);

// Report status machine (CLAUDE.md). POSSIBLE_DUPLICATE is a tag, not a status.
export const reportStatusEnum = pgEnum("report_status", [
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_CITIZEN_VERIFICATION",
  "RESOLVED",
  "REOPENED",
  "REJECTED",
]);

export const mediaKindEnum = pgEnum("media_kind", [
  "REPORT", // citizen's original photo
  "BEFORE", // field staff, before work
  "AFTER", // field staff, after work
  "CORROBORATING", // additional photo on an existing report (honest-duplicate merge)
]);

export const capturePathEnum = pgEnum("capture_path", ["IN_APP", "GALLERY"]);

export const verificationVerdictEnum = pgEnum("verification_verdict", [
  "CONFIRM",
  "REOPEN",
]);

export const escalationTriggerEnum = pgEnum("escalation_trigger", [
  "STALE_30D",
  "REOPENED_TWICE",
  "SLA_BREACH",
]);

// ---------------------------------------------------------------------------
// Tables (PRD §8.1)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: text("name"),
  lang: langEnum("lang").notNull().default("en"),
  civicScore: integer("civic_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Auth infrastructure (not part of the §8.1 domain model). Stores a hashed,
// short-lived OTP per phone for the self-hosted mock OTP flow.
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_codes_phone_ix").on(t.phone)],
);

export const municipalities = pgTable("municipalities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  boundary: geographyPolygon("boundary"),
});

export const wards = pgTable(
  "wards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    municipalityId: uuid("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    wardNo: integer("ward_no").notNull(),
    boundary: geographyPolygon("boundary").notNull(),
  },
  (t) => [index("wards_boundary_gix").using("gist", t.boundary)],
);

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  municipalityId: uuid("municipality_id")
    .notNull()
    .references(() => municipalities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contact: text("contact"),
});

// (category, ward) → department. Keyed per municipality because the same
// category maps to different departments in different cities (§5.1).
export const categoryDepartmentMap = pgTable(
  "category_department_map",
  {
    municipalityId: uuid("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    category: categoryEnum("category").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    slaHours: integer("sla_hours").notNull(),
  },
  (t) => [primaryKey({ columns: [t.municipalityId, t.category] })],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    category: categoryEnum("category").notNull(),
    categoryConfidence: real("category_confidence"),
    location: geographyPoint("location").notNull(),
    wardId: uuid("ward_id").references(() => wards.id),
    departmentId: uuid("department_id").references(() => departments.id),
    status: reportStatusEnum("status").notNull().default("SUBMITTED"),
    priorityScore: real("priority_score").notNull().default(0),
    upvoteCount: integer("upvote_count").notNull().default(0),
    // set when this submission was merged as a duplicate of another report
    parentReportId: uuid("parent_report_id"),
    captureTrust: real("capture_trust"),
    // --- AI fields (sprint 2) ---
    spamFlag: boolean("spam_flag").notNull().default(false),
    duplicateFlag: boolean("duplicate_flag").notNull().default(false),
    /** completed | failed | pending | skipped */
    aiAnalysisStatus: text("ai_analysis_status").default("pending"),
    aiReason: text("ai_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reopenCount: integer("reopen_count").notNull().default(0),
  },
  (t) => [
    index("reports_location_gix").using("gist", t.location),
    index("reports_status_ix").on(t.status),
    index("reports_ward_ix").on(t.wardId),
    index("reports_department_ix").on(t.departmentId),
    index("reports_category_ix").on(t.category),
  ],
);

export const reportMedia = pgTable(
  "report_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull().default("REPORT"),
    url: text("url").notNull(),
    phash: bit64("phash"),
    sha256: varchar("sha256", { length: 64 }),
    embedding: vector512("embedding"),
    capturePath: capturePathEnum("capture_path").notNull().default("IN_APP"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    gpsAccuracyM: real("gps_accuracy_m"),
    exifPresent: boolean("exif_present").notNull().default(false),
  },
  (t) => [
    index("report_media_report_ix").on(t.reportId),
    index("report_media_sha256_ix").on(t.sha256),
  ],
);

export const upvotes = pgTable(
  "upvotes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reportId] })],
);

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
});

export const statusEvents = pgTable("status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  fromStatus: reportStatusEnum("from_status"),
  toStatus: reportStatusEnum("to_status").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  note: text("note"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  verdict: verificationVerdictEnum("verdict").notNull(),
  rating: integer("rating"), // 1-5, only on CONFIRM
  reason: text("reason"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const escalations = pgTable("escalations", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  trigger: escalationTriggerEnum("trigger").notNull(),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// AI audit tables (sprint 2 — Gemini integration)
// ---------------------------------------------------------------------------

/**
 * Caches AI analysis results per image SHA-256. Prevents re-calling Gemini
 * for the same image, and provides an audit trail for AI decisions.
 */
export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageSha256: varchar("image_sha256", { length: 64 }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    isCivicIssue: boolean("is_civic_issue"),
    category: categoryEnum("category"),
    confidence: real("confidence"),
    spamSuspected: boolean("spam_suspected"),
    reason: text("reason"),
    bbox: text("bbox"), // JSON-encoded [x,y,w,h]
    /** completed | failed | timeout */
    status: text("status").notNull().default("completed"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_analyses_sha256_ix").on(t.imageSha256),
  ],
);

/**
 * Records AI image-comparison results (duplicate check or before/after
 * resolution verification). Advisory only — these FLAGS, not decisions.
 */
export const aiComparisonResults = pgTable(
  "ai_comparison_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }),
    /** "duplicate" or "resolution" */
    comparisonType: text("comparison_type").notNull(),
    image1Sha256: varchar("image1_sha256", { length: 64 }).notNull(),
    image2Sha256: varchar("image2_sha256", { length: 64 }).notNull(),
    samePhysicalIssue: boolean("same_physical_issue"),
    sameScene: boolean("same_scene"),
    issueAddressed: boolean("issue_addressed"),
    confidence: real("confidence"),
    reason: text("reason"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_comparisons_report_ix").on(t.reportId),
  ],
);
