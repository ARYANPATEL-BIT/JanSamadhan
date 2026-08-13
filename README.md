# CivicReport — Crowdsourced Civic Issue Reporting (SIH 2025 PS 25031)

Next.js 15 web app for reporting, routing, and resolving civic issues. See
[`docs/PRD.md`](docs/PRD.md) for the full spec and [`Claude.md`](Claude.md) for
build conventions and per-sprint decisions.

## Stack

Next.js 15 (App Router, TS) · Tailwind + shadcn/ui · **Neon** Postgres +
**PostGIS** + **pgvector** (Drizzle ORM) · **Cloudinary** (image storage) ·
MapLibre + OSM · self-hosted phone-OTP auth. ML service (YOLO + CLIP + pHash)
arrives in sprint 2 behind a stub seam. No Docker required — DB and storage are
hosted free tiers.

## Local development

Prerequisites: Node 20+. Two free-tier accounts:

- **Neon** (Postgres) — create a project, then enable extensions once via the
  Neon SQL editor: `create extension if not exists postgis;` and
  `create extension if not exists vector;`
- **Cloudinary** (image storage) — grab cloud name + API key/secret.

```bash
cp .env.example .env.local      # fill DATABASE_URL (Neon) + CLOUDINARY_* +
                                # a real AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate              # apply migrations to Neon
npm run db:seed                 # seed Ranchi wards / departments (reference data)
# npm run db:reset              # wipe ALL data + re-seed (destructive)
npm run dev                     # http://localhost:3000
```

Log in with any 10-digit number — in dev the OTP is printed to the server
console and shown on the login screen.

## What's built (Sprint 1)

- Phone-OTP auth (mock SMS via `SmsSender` seam) + JWT session
- Full §8.1 data model as Drizzle migrations (12 tables, PostGIS + pgvector)
- Camera-first report submission: in-app capture → geolocation+timestamp bound
  at shutter → draft (3-layer pipeline **stub**) → editable category chip →
  submit to `reports` + `report_media`
- Public feed (list + MapLibre map) with upvoting
- Point-in-polygon ward lookup + automatic department/SLA routing

## Project layout

```
app/(public)/…        citizen UI (feed, report, login)
app/api/v1/…          the API boundary (RN app consumes these in phase 2)
lib/db/               Drizzle schema + migrations
lib/pipeline/         ML seam — getPipelineClient() (stub | http)
lib/auth/             OTP + SmsSender + session
lib/geo/              ward lookup + department routing
lib/storage/          Cloudinary client (putObject/getObject seam)
seed/                 Ranchi ward polygons + departments (+ Neon seed/reset)
```

## Swapping in the real ML service (Sprint 2)

Implement `lib/pipeline/http.ts` (POST to the FastAPI service, map the response
into `PipelineVerdict`) and set `PIPELINE_MODE=http`. Nothing upstream changes.
