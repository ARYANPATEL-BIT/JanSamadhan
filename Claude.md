# CLAUDE.md — Civic Issue Reporting System

This file is read by Claude Code at the start of every session in this repo. Keep it current as decisions change.

## What this is

A crowdsourced civic issue reporting & resolution platform (SIH 2025 PS 25031, mock hackathon build). Citizens report issues via photo, the system auto-detects category and department, routes it, tracks resolution with mandatory before/after photos, and scores both citizens and departments.

Full product spec: `docs/PRD.md`. Read it before implementing any feature you're unsure about — it also documents which features are simplified/stubbed vs full-strength and why (Aadhaar, ministry escalation, scheme benefits are intentionally stubbed — see PRD §9).

Flowcharts: `docs/flow-main.mermaid` (end-to-end app flow), `docs/flow-antispam.mermaid` (3-layer duplicate/spam pipeline). Render these mentally before touching the report-submission or duplicate-detection code — the state machine matters more than any individual endpoint.

## Build order — do not skip ahead

1. **Phase 1: Next.js web app.** This is the only target right now.
2. **Phase 2: React Native app**, sharing the same backend/API — not started yet, don't scaffold it.

Within Phase 1, sprint order (see PRD §10):
1. Auth, data model + PostGIS, report submission with in-app camera, public feed, map view
2. ML service (YOLO + CLIP + pHash), 3-layer pipeline, duplicate-interception UI, auto department detection
3. Departmental panel — queue, assignment, before/after capture, closure flow, citizen verification/reopen
4. Admin panel — department scorecards, escalation queue, civic score ledger, i18n, polish

Don't build sprint 3 features before sprint 1-2 are solid. If asked to jump ahead, flag it rather than silently doing it.

## Stack — do not substitute without asking

| Layer | Choice |
|---|---|
| Web framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind + shadcn/ui |
| API | Versioned `/api/v1` — treat this as a real API boundary even though it's currently only consumed by the Next app. The React Native app will hit these same endpoints in Phase 2. Don't leak business logic into page-level server actions that a mobile client couldn't reach. |
| DB | Postgres + **PostGIS** extension (required — duplicate detection depends on `ST_DWithin`, don't hand-roll haversine math) + **pgvector** (for CLIP embedding similarity) |
| Auth | Phone OTP (Supabase Auth free tier, or self-hosted equivalent) |
| Storage | Cloudflare R2 (free tier) or MinIO locally for images |
| ML service | Separate FastAPI service, Python, PyTorch — YOLOv8n, CLIP ViT-B/32, pHash, Whisper-small, NLLB-600M |
| Maps | MapLibre GL + OpenStreetMap tiles — **not** Google Maps (billing) |
| Realtime | Postgres LISTEN/NOTIFY → SSE — **not** a paid websocket service |
| i18n | next-intl, shared locale JSON |

## Hard constraints — these are non-negotiable, not preferences

- **Zero budget.** No paid APIs, no paid cloud tier beyond free-tier limits. If a feature seems to need a paid service, stop and propose a free/self-hosted alternative before implementing.
- **GPU:** primary dev machine is Windows + RTX 5070 laptop GPU, 8GB VRAM. Teammate is on a MacBook (no CUDA). Every ML component needs a CPU/MPS fallback path — don't write CUDA-only code.
- Models must fit comfortably in 8GB VRAM: YOLOv8n and CLIP ViT-B/32 are fine; don't reach for larger variants without checking.

## Domain rules that are easy to get wrong

- **pHash duplicate threshold is ≤12 bits Hamming distance** for "likely duplicate," ≤6 for "near-certain." NOT a 70% raw-similarity framing — that's too loose and produces false positives constantly. See PRD §9.5 for the full reasoning.
- **Geo-radius for duplicate candidates is 30m for point issues, 60m for linear issues** (e.g. a stretch of broken road) — not 10m. Consumer GPS accuracy is 5-20m; a 10m radius misses real duplicates.
- **pHash alone will not catch the common duplicate case** (two people photographing the same pothole from different angles). That requires geospatial clustering + category match + CLIP embedding cosine similarity (≥0.85) as a separate signal. Don't treat pHash as sufficient on its own.
- **Layer 1 (AI legitimacy check) flags, it never hard-blocks.** A false negative silently discards a real civic problem — worse than letting a spam report reach human review. Confidence <0.40 → warn but allow submit. 0.40-0.75 → accept, route to manual review lane. ≥0.75 → auto-accept.
- **Layer 3 is capture attestation, not EXIF reading.** EXIF is routinely stripped (canvas processing kills it, `getUserMedia` never had it) and trivially forged. The trust signal comes from binding device geolocation + server timestamp at the moment of in-app capture, not from parsing metadata off an uploaded file. EXIF is read opportunistically for gallery uploads only, as a low-weight bonus signal, and those uploads are always routed to manual review.
- **Department score must include a reopen-rate term and be normalised by report volume/category mix.** A naive time-to-resolve score rewards closing tickets without fixing anything. Don't implement the scoring formula without the reopen penalty — see PRD §5.4 and §9.9.
- **Civic score (revised by product owner, overrides PRD §5.3):** plain running integer, no tiers (Bronze/Silver/… and the `tier` column were removed). Points are awarded at **submission of a novel report** — one the pipeline did not flag as a duplicate — via `CIVIC_POINTS_PER_NEW_REPORT` in `lib/services/reports.ts`. ⚠️ Known tradeoff: this drops the PRD's original spam guard (award only on *verified/resolved* reports, with a −40 rejection penalty larger in expected value than a fabricated report's reward). If spam becomes a problem, reintroduce that guard.
- **Before/after photos are a hard gate**, geofenced within 50m of the report location, after-photo timestamp must postdate before-photo. A report cannot reach `PENDING_CITIZEN_VERIFICATION` without both.

## Explicitly out of scope for this build — do not implement, stub instead

- **Real Aadhaar/UIDAI verification.** Not legally accessible without an AUA/KUA licence. Use phone OTP as identity anchor. If a UI needs to show "verified resident" styling, mock it and label it clearly as mocked — never store anything in Aadhaar number format, even as test data.
- **Real government scheme benefit disbursement.** Build the eligibility/recommendation surface only.
- **Real ministry escalation API.** Build the detection logic and a generated PDF/email dossier. There is no real endpoint to send it to.
- Payments, tendering, contractor management, offline-first sync (that's Phase 2/React Native).

## Data model

Canonical schema is in PRD §8.1 (`docs/PRD.md`). Key tables: `users`, `municipalities`, `wards` (PostGIS polygons), `departments`, `category_department_map`, `reports` (PostGIS point + status machine), `report_media` (pHash bit(64) + pgvector embedding + sha256), `upvotes`, `assignments`, `status_events`, `verifications`, `escalations`. Treat this as the source of truth — if a migration needs to diverge from it, update the PRD too, don't let them drift apart.

## Report status machine

`SUBMITTED → ASSIGNED → IN_PROGRESS → PENDING_CITIZEN_VERIFICATION → RESOLVED`
Branches: `REOPENED` (loops back to `ASSIGNED`), `REJECTED` (terminal, spam/fake), `POSSIBLE_DUPLICATE` (tag, not a status). Full flow in `docs/flow-main.mermaid`.

## Working conventions

- Every ML-pipeline decision (accept/flag/reject) must be explainable — store the confidence scores and thresholds that produced the verdict on the report record, not just the final verdict. This matters for the department manual-review UI and for debugging false positives later.
- When implementing a feature flagged ⚠️ or ❌ in PRD §9.12, implement the modified/stubbed version described there, not the original naive spec from the reference flowchart.
- Prefer Server Components and Route Handlers over client-heavy patterns where the Next.js App Router makes that natural — but the ML service is always a separate FastAPI call, never inline Python in a route handler.

## Sprint 1 — decisions & local dev (built)

Decisions made this sprint (recorded so docs don't drift):

- **Migration tool: Drizzle** (not Prisma). Prisma can't query PostGIS `geography`/pgvector `vector` columns through its client — it forces `Unsupported(...)` + raw SQL for exactly the `ST_DWithin`/`ST_Contains`/cosine queries that are the core of this app. Drizzle declares those as custom column types and writes spatial predicates via `sql`. Schema lives in `lib/db/schema.ts`; it mirrors PRD §8.1 — keep them in sync.
- **Next.js pinned to 15.x** (create-next-app pulls 16; downgraded per the stack table).
- **Auth: self-hosted mock OTP** (not Supabase Auth — Supabase phone OTP needs a *paid* SMS provider, which breaks the zero-budget rule). `SmsSender` interface in `lib/auth/sms.ts` (ConsoleSmsSender logs the code in dev); swap in a real provider behind it. Session = signed JWT cookie (`lib/auth/session.ts`). `otp_codes` is auth infra, intentionally outside the §8.1 domain model.
- **ML pipeline seam:** `lib/pipeline/` — `getPipelineClient()` factory switches on `PIPELINE_MODE` (`stub` now, `http` in sprint 2). `StubPipelineClient` returns a hardcoded `CLEAN_HIGH_TRUST` verdict in the exact shape the real FastAPI service will return. SHA-256 is computed for real server-side. **To wire the real service in sprint 2: implement `lib/pipeline/http.ts` and set `PIPELINE_MODE=http` — no upstream changes.**
- **Draft→submit** uses a signed "draft ticket" (`lib/reports/draft-ticket.ts`) carrying server-stamped `received_at`, capture facts, pipeline verdict, and resolved ward — so the citizen can only edit category/description, and no DB draft table is needed (schema stays at §8.1).
- **DB image:** `docker/db/Dockerfile` = `postgis/postgis:16-3.4` + pgvector (postgis image doesn't ship pgvector). `docker/db-init/01-extensions.sql` enables both. **Verified working:** PostGIS 3.4.3 `ST_DWithin`, pgvector 0.8.6.
- **Storage:** MinIO (S3-compatible), `lib/storage/s3.ts`, public-read bucket `civic-media`.
- **Seed:** Ranchi Municipal Corporation (Jharkhand), 3 hand-drawn ward polygons, 4 departments, full category→department map — `seed/seed.sql` (+ `seed/wards.geojson` mirror).

Local dev (Windows, Docker Desktop must be running):
```
docker compose up -d          # db (postgis+pgvector) + minio
npm run db:migrate            # apply lib/db/migrations
npm run db:seed               # Ranchi wards/departments
npm run dev                   # http://localhost:3000
```
In dev the OTP is logged to the server console (and echoed to the login screen via `OTP_DEV_ECHO=true`). Env template: `.env.example`.

Sprint-1 API (`/api/v1`): `auth/otp/{request,verify}`, `auth/{me,logout}`, `reports` (GET feed / POST submit), `reports/draft` (POST), `reports/[id]/upvote` (POST). Verified end-to-end: OTP → in-app capture → draft (pipeline stub + ward lookup + MinIO) → submit → feed → upvote.