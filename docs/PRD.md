# Product Requirements Document
## Crowdsourced Civic Issue Reporting & Resolution System

**Problem Statement:** SIH 2025 — PS ID 25031
**Context:** Mock hackathon build
**Version:** 0.1 (draft)
**Build order:** Next.js web app first → React Native app second, sharing one backend

---

## 1. Problem

Citizens see broken civic infrastructure every day — potholes, uncollected garbage, dead streetlights, waterlogging, exposed sewage — and have no reliable way to report it. The channels that exist (helpline numbers, ward office visits, generic grievance portals with 20-field forms) fail on three counts:

1. **Reporting friction.** Filling a form that asks for department, ward, sub-category and complaint type assumes the citizen knows the municipal org chart. Most don't.
2. **No accountability loop.** A complaint disappears into a queue. Nobody knows if it was seen, assigned, or closed. "Resolved" is self-declared by the department with no proof.
3. **No prioritisation signal.** A pothole on a school route and a pothole on a dead-end lane get the same treatment. There is no mechanism for the public to say *this one matters more*.

The result is low reporting rates, low trust, and municipalities that have no data-driven view of their own backlog.

## 2. Goals & Non-Goals

### Goals
- Reduce a civic report to: **open app → point camera → confirm → submit.** Under 30 seconds.
- Route every report to the correct municipal department automatically, with zero category selection by the citizen.
- Make resolution **verifiable** — proof-of-work photos plus citizen confirmation, not department self-attestation.
- Give municipalities a live, ranked, deduplicated queue instead of a raw complaint dump.
- Create visible accountability at both ends: a civic score for citizens, a performance score for departments.

### Non-Goals (v1)
- Real Aadhaar/UIDAI integration (see §9.1 — legally unavailable to us).
- Real disbursement of government scheme benefits (policy dependency, not a technical one).
- Real data pipes into any actual municipal ERP or ministry system.
- Payments, tendering, or contractor management.
- Offline-first sync (deferred to the React Native build).

### Success metrics (demo-scale)
| Metric | Target |
|---|---|
| Time from app open to submitted report | < 30 s |
| Auto-detected department accuracy | ≥ 85% on seeded test set |
| Duplicate reports reaching the department queue | < 10% of submissions |
| Reports with a valid before **and** after photo at closure | 100% (hard gate) |
| False rejection of a legitimate report by the AI gate | 0% (gate flags, never blocks — see §6.1) |

---

## 3. Users & Roles

### 3.1 Citizen (Public panel)
Reports issues, uploads photos, upvotes others' reports, tracks status, confirms or reopens closures, accumulates civic score.

### 3.2 Department staff (Departmental panel)
Scoped to one municipality + one department (e.g. Roads, Sanitation, Water, Streetlighting, Drainage). Two sub-roles:
- **Department Admin** — sees the ranked queue for their department, assigns work to field staff, sets SLA overrides, closes reports.
- **Field Staff** — sees only assigned tasks, uploads geotagged before/during/after photos, marks work complete.

### 3.3 Admin (Admin panel)
Two levels:
- **Municipality Admin** — full view of every department in their municipality, department scorecards, reassignment across departments, ward configuration.
- **Super Admin** — cross-municipality view, escalation queue to ministry, ML model thresholds, category↔department mapping, audit log.

---

## 4. Core Flows

### 4.1 Report submission
1. Citizen opens app (logged in via phone OTP).
2. **In-app camera only** for the primary photo. Gallery upload is a secondary path that is flagged lower-trust (§6.3).
3. On shutter: device geolocation, device timestamp, and server timestamp are captured and bound to the image server-side. The app does **not** rely on EXIF (§9.2).
4. Image goes through the 3-layer pipeline (§6). Runs in ~2–4 s; the UI shows progress, not a blank spinner.
5. Auto-detected category and department are shown as an editable chip: *"Looks like: **Pothole** → Roads Dept, Ward 14. Not right?"* One tap to correct.
6. Optional: 200-char description, optional voice note (transcribed).
7. Submit. Report enters state `SUBMITTED`.

### 4.2 Duplicate interception
If layer 2 or 3 finds candidates, the citizen sees a card stack: *"3 people already reported something here."* Each card shows thumbnail, distance, age, upvote count. Citizen chooses:
- **"That's the same issue"** → their submission becomes an **upvote + corroborating photo** on the existing report. They still earn (reduced) civic score. This is important: never punish an honest duplicate.
- **"Mine is different"** → proceeds as a new report, flagged `POSSIBLE_DUPLICATE` for department review.

### 4.3 Assignment & resolution
1. Report lands in the department queue, positioned by rank score (§7.2).
2. Department Admin assigns to field staff. SLA clock starts (per-category, configurable; default 7 days for potholes, 2 days for garbage, 3 days for streetlights).
3. Field staff arrives, captures **before photo** (geotagged, must be within 50 m of report location). State → `IN_PROGRESS`.
4. Work done. Field staff captures **after photo** (same geofence, must be later than the before photo). Optional: expense note, completion remarks.
5. Department Admin reviews and submits closure. State → `PENDING_CITIZEN_VERIFICATION`.
6. Original reporter (and top upvoters) get a notification: before/after side by side. 7 days to respond.
   - **Confirm** → `RESOLVED`. Civic score awarded to reporter. Department score credited.
   - **Reopen** with reason + fresh photo → `REOPENED`. Department score penalised. SLA clock restarts and the reopen counter increments.
   - **No response in 7 days** → auto-`RESOLVED`, but with a lower confidence weight in the department score.

### 4.4 Escalation
Automatic nightly job flags for the ministry escalation queue:
- Reports in `SUBMITTED` or `ASSIGNED` for **> 30 days** with no state transition.
- Reports **reopened ≥ 2 times**.
- Reports where a department's SLA breach rate for that category exceeds a configured threshold.

Escalated items generate a signed PDF summary (report timeline, photos, SLA history) and land in the Super Admin escalation view. v1 delivers this as a downloadable/emailable report, not a live ministry API integration.

---

## 5. Feature Specifications

### 5.1 Automatic Department Detection
Two independent signals, combined:
- **What** — image classification produces a category (`pothole`, `garbage_dump`, `streetlight_out`, `waterlogging`, `broken_footpath`, `open_drain`, `illegal_dumping`, `damaged_signage`, `fallen_tree`, `stray_animal`, `other`).
- **Where** — geolocation resolved against ward polygons (GeoJSON) to get municipality + ward.

`(category, ward)` → lookup in the `category_department_map` table → department. Editable per municipality by the Municipality Admin, because the same category maps to different departments in different cities.

Confidence < 0.6 on the category → don't guess. Show a 4-option picker of the top candidates.

### 5.2 Upvoting
- One upvote per user per report, revocable.
- Upvoting requires being within 5 km of the issue **or** having it in your ward — prevents remote brigading.
- Upvotes are weighted by the upvoter's civic score tier (a trusted reporter's vote counts more), capped at 2× so it can't be gamed by one power user.
- Rate limit: 20 upvotes/user/day.

### 5.3 Civic Score
A points ledger, not a vanity number. Events:

| Event | Points |
|---|---|
| Report verified as legitimate and resolved | +50 |
| Report confirmed as a duplicate by the reporter (honest merge) | +10 |
| Corroborating photo on someone else's report | +5 |
| Upvote cast | +1 (max 10/day) |
| Verifying a closure (confirm or reopen with evidence) | +15 |
| Report rejected as fake/spam by the department | −40 |
| Second rejected report in 30 days | −40 and 7-day cooldown on new reports |

Tiers: Bronze (0–199), Silver (200–999), Gold (1000–2999), Platinum (3000+). Tier affects upvote weight, daily report cap, and whether reports skip the manual review queue.

**Scheme benefits:** v1 exposes a `benefits` surface listing schemes a citizen's tier makes them eligible to be *recommended* for, plus an exportable certificate. Actual benefit disbursement is a government policy integration and is explicitly out of scope — see §9.4.

### 5.4 Department Score
Published monthly per department, per category. Composite of:

```
DeptScore = 0.40 × SLA_adherence
          + 0.25 × citizen_satisfaction
          + 0.20 × (1 − reopen_rate)
          + 0.15 × proof_quality
```

- `SLA_adherence` — % of reports closed inside the category SLA.
- `citizen_satisfaction` — mean of post-resolution 1–5 ratings (only counted where the citizen actually responded).
- `reopen_rate` — reopened / total closed. This is the anti-gaming term: closing fast without fixing anything tanks it.
- `proof_quality` — % of closures with valid geofenced before+after photos passing automated checks.

**Normalisation:** raw scores are adjusted for volume and category mix, so a department handling 400 drainage reports in monsoon isn't ranked below one handling 12 signage reports. Percentile within category cohort, not raw absolute.

### 5.5 Multi-language
- **UI strings:** `next-intl` on web, `i18next` on React Native, sharing one JSON locale bundle. Launch set: English, Hindi, Bengali, Marathi, Tamil, Telugu. Adding a locale is a JSON file, not a code change.
- **User-generated content:** descriptions stored in original language with a detected `lang` tag. Translation on demand via a self-hosted model (§8) or Bhashini API if available. Never machine-translate destructively — always keep the original.
- **Voice input:** local Whisper-small for voice-note transcription, which matters more than it sounds — typing Devanagari on a phone is a real barrier.

### 5.6 Before/After Photo Requirement
Hard gate. A report cannot reach `PENDING_CITIZEN_VERIFICATION` without:
- Before photo: captured after assignment, within 50 m of the report pin.
- After photo: captured after the before photo, within 50 m, same category context.
- Both bound to server timestamps and the field staff's user ID.

Automated checks flag but don't block: EXIF-free capture path, timestamp ordering, geofence, and a coarse "is this the same scene" check via embedding cosine similarity between before and after (should be *moderately* similar — near-identical suggests nothing was done, wildly different suggests a wrong location).

---

## 6. Spam & Duplicate Protection — 3 Layers

Runs as a pipeline on submission. Total budget: ~3 s.

### Layer 1 — Issue Legitimacy (Vision)
"Does this image actually contain the claimed civic issue?"

- Model: fine-tuned **YOLOv8n / YOLOv11n** for detection on the high-volume classes (pothole, garbage, waterlogging), plus a **CLIP zero-shot classifier** as a fallback for the long tail of categories.
- Output: `(category, confidence, bbox)`.
- **Behaviour is a flag, not a block.** Confidence ≥ 0.75 → auto-accept. 0.40–0.75 → accept but route to the department's manual review lane. < 0.40 → warn the citizen ("we couldn't identify an issue in this photo — retake, or submit anyway and it'll be manually reviewed"). Never hard-reject. Rationale in §9.3.
- Also runs a basic NSFW/irrelevant-content filter to catch selfies, memes, and screenshots.

### Layer 2 — Perceptual Hash + Geospatial Clustering
- pHash (64-bit DCT hash) computed on every image at upload, stored as `bit(64)`.
- Candidate set = reports within radius R of the new report, same category, created in the last 90 days.
- **R = 30 m, not 10 m.** Consumer phone GPS in urban settings is accurate to roughly 5–20 m and worse near tall buildings. A 10 m radius silently misses genuine duplicates. 30 m for point issues, 60 m for linear issues like a broken stretch of road.
- Similarity = Hamming distance on the 64-bit hash. **Threshold: distance ≤ 12** (≈ 81% bit agreement) for "likely same image." A 70% threshold means 19 differing bits, which is loose enough to match visually unrelated photos and will produce heavy false positives — see §9.5.
- **Critically:** pHash catches *re-uploads of the same file*, not two people photographing the same pothole from different angles. That second case — the common one — is caught by geospatial clustering + category match + a CLIP embedding cosine similarity (threshold ≈ 0.85) over the candidate set.
- On a hit: show candidates to the citizen (§4.2), don't silently drop.

### Layer 3 — Capture Attestation
Originally specified as "read the image EXIF metadata." Reframed, because EXIF is both routinely stripped and trivially forged (§9.2). The layer keeps its purpose — proving *when and where* this photo was taken — but changes mechanism:

- **Primary path:** in-app camera. The client captures the frame, requests `geolocation` at shutter time, and posts image + coordinates + client timestamp. The server stamps its own `received_at` and computes a `capture_trust` score from: client↔server clock skew, GPS accuracy radius reported by the device, whether the location moved plausibly since the last request, and device attestation where available (Play Integrity / App Attest on the RN build).
- **Secondary path:** gallery upload. EXIF is read *opportunistically* — if present, it's a bonus signal; if absent, the report is marked `LOW_TRUST_CAPTURE` and always goes to manual review. Gallery uploads can't earn full civic score.
- **Exact-file detection:** SHA-256 of the raw bytes. Catches the crudest reuploads instantly, before any ML runs.
- **Cross-report metadata match:** identical (pHash, coordinates rounded to 5 decimals, capture timestamp within 60 s) across two different users = strong collusion/spam signal → both flagged for admin review.

---

## 7. Ranking

### 7.1 Priority (per report, department-facing)
```
priority = severity_weight
         + upvote_component
         + age_component
         + context_multiplier
```
- `severity_weight` — from category + model-detected extent (e.g. pothole bbox area relative to lane width).
- `upvote_component` — `log₂(1 + weighted_upvotes) × 8`. Log, so 100 upvotes doesn't drown out a genuinely severe unvoted issue.
- `age_component` — grows with time in queue; jumps sharply past 80% of SLA.
- `context_multiplier` — proximity to schools, hospitals, bus stops (from OSM POI data). A pothole outside a school outranks an identical one on a service lane.

### 7.2 Public feed ranking
Different formula, tuned for discovery, not dispatch: recency-decayed upvotes (Hacker News style) + distance from the viewer + unresolved-status boost. Deliberately separate from the department priority score so that public visibility doesn't directly dictate municipal work order.

---

## 8. Technical Architecture

Constraint: **zero budget, self-hosted where possible.** Inference on a local RTX-class GPU (8 GB VRAM), teammate on Apple Silicon (no CUDA — models must have an MPS/CPU fallback path).

```
┌─────────────────┐     ┌──────────────────┐
│  Next.js 15     │     │  React Native    │
│  (web, phase 1) │     │  (phase 2)       │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌───────────────────────┐
         │  API layer  /api/v1   │   REST + Zod schemas
         │  (Next route handlers │   shared types package
         │   or separate Fastify)│
         └───────────┬───────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌─────────┐   ┌─────────────┐   ┌──────────────┐
│Postgres │   │ Object store│   │ ML service   │
│+PostGIS │   │ (R2 / MinIO)│   │ FastAPI+GPU  │
└─────────┘   └─────────────┘   └──────────────┘
                                        │
                            YOLOv8n · CLIP · pHash
                            Whisper-small · NLLB
```

| Layer | Choice | Why |
|---|---|---|
| Web | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui | Required stack; RSC keeps the public feed fast |
| Mobile | React Native (Expo), phase 2 | Required stack; Expo camera + location cover the capture path |
| API | Versioned `/api/v1` from day one | The RN app will consume the same endpoints — don't let logic leak into page-level server actions |
| DB | Postgres + **PostGIS** | `ST_DWithin` for the radius queries is the whole duplicate-detection story; don't hand-roll haversine |
| Auth | Phone OTP (Supabase Auth free tier or self-hosted) | See §9.1 on why not Aadhaar |
| Storage | Cloudflare R2 free tier, or MinIO locally | Images are the bulk of storage; R2 has no egress fee |
| ML | FastAPI service, PyTorch, YOLOv8n + CLIP ViT-B/32 | All fit in 8 GB VRAM comfortably; both have CPU/MPS fallback for the MacBook |
| Realtime | Postgres LISTEN/NOTIFY → SSE | Department queue updates without a paid websocket service |
| Maps | MapLibre GL + OpenStreetMap tiles | Free; no Google Maps billing |
| i18n | next-intl / i18next, shared locale JSON | One bundle, two clients |

**Deployment (demo):** Vercel free tier (Next.js) + Neon/Supabase free Postgres + ML service on the local GPU exposed via a Cloudflare Tunnel. Honest about the limitation: the ML service is only up when the machine is. For the hackathon demo that's acceptable; document a fallback where the pipeline degrades gracefully to pHash-only (pure CPU, runs anywhere) if the GPU service is unreachable.

### 8.1 Key data model
```
users(id, phone, name, lang, civic_score, tier, created_at)
municipalities(id, name, state, boundary geography(Polygon))
wards(id, municipality_id, ward_no, boundary geography(Polygon))
departments(id, municipality_id, name, contact)
category_department_map(municipality_id, category, department_id, sla_hours)

reports(
  id, reporter_id, category, category_confidence,
  location geography(Point), ward_id, department_id,
  status, priority_score, upvote_count,
  parent_report_id,          -- set when merged as duplicate
  capture_trust, created_at, sla_due_at, closed_at, reopen_count
)
report_media(id, report_id, kind, url, phash bit(64), sha256,
             embedding vector(512), captured_at, gps_accuracy_m, exif_present)
upvotes(user_id, report_id, weight, created_at)
assignments(id, report_id, staff_id, assigned_at, sla_due_at)
status_events(id, report_id, from_status, to_status, actor_id, note, at)
verifications(id, report_id, user_id, verdict, rating, reason, at)
escalations(id, report_id, trigger, escalated_at, resolved_at)
```
`report_media.embedding` uses `pgvector` — same database, no separate vector store.

---

## 9. Feasibility Assessment

Honest read on each feature. Three buckets: buildable as specified, buildable with modification, and not buildable (policy/legal).

### 9.1 Aadhaar verification — NOT BUILDABLE ❌
The reference flowchart shows Aadhaar verification and "Jharkhand resident & above 18" checks. This is not available to a hackathon team:
- UIDAI authentication and e-KYC APIs are accessible only to entities licensed as an AUA/KUA or Sub-AUA under a contract with UIDAI. There is no self-serve sandbox that returns real verification.
- Storing Aadhaar numbers in an application database without being a compliant entity carries statutory liability under the Aadhaar Act and its penalty provisions.

**Recommendation:** phone OTP as the identity anchor, optional DigiLocker-style verification shown as a *mocked* integration clearly labelled as such in the demo. Judges consistently respond better to "we identified this as a licensing dependency and stubbed it deliberately" than to a fake Aadhaar screen. Do not store any Aadhaar-format number, even test data.

### 9.2 EXIF-based metadata verification — BUILDABLE WITH MODIFICATION ⚠️
Layer 3 as originally described has two real problems:
- **EXIF is routinely stripped.** Most social/messaging apps strip it on share. Browser `<input type="file">` preserves it, but any in-browser canvas processing (resize, compress) destroys it. If you capture via `getUserMedia` there is no EXIF at all — the canvas frame has no metadata to begin with.
- **EXIF is trivially forged.** `exiftool` rewrites GPS coordinates and timestamps in one command. As an anti-spam layer it stops nobody who is actually trying.

**Fix (already reflected in §6.3):** don't *read* trust from the image, *establish* it at capture. In-app camera + device geolocation + server timestamp, with EXIF as a bonus signal when present. This is strictly stronger and it actually works in a browser.

### 9.3 AI issue-legitimacy check — BUILDABLE ⚠️ (with a caveat about hard-blocking)
Object detection for potholes and garbage is well-trodden; public datasets exist and a YOLOv8n fine-tune on a few thousand images gets to usable accuracy on 8 GB VRAM in a few hours. CLIP zero-shot handles the long tail without any training data.

Two caveats:
- **Accuracy varies wildly by class and condition.** Potholes in daylight: good. A dead streetlight at night — the visual signature is *absence of light*, which is close to unlearnable from a single photo. Waterlogging vs. a wet road: ambiguous. Don't promise uniform accuracy across all categories.
- **Never hard-block on this.** A false negative means a real civic problem is silently discarded, which is a much worse failure than a spam report reaching a human. The model gates *routing and trust*, not *acceptance*. This is a design decision worth stating explicitly to judges.

### 9.4 Civic score → government scheme benefits — PARTIALLY BUILDABLE ⚠️
The scoring engine, tiers, ledger, and eligibility surface are all straightforwardly buildable. **Actual benefit disbursement is not** — that requires a scheme owner to accept your score as an input, which is a policy decision, not an API. No such integration point exists to build against.

There's also a design hazard worth naming: rewarding report volume creates an incentive to report. That's the point — but it also creates an incentive to *fabricate*. This is why the score must key off reports **verified and resolved**, not reports submitted, and why the −40 penalty for rejected reports needs to be larger than the +50 for a good one on a per-attempt expected-value basis for a spammer. Build the ledger so this weighting is a config value you can defend and tune.

### 9.5 pHash at 70% similarity within 10 m — BUILDABLE, BUT THE NUMBERS ARE WRONG ⚠️
Both thresholds need changing:

- **70% similarity is far too loose.** pHash similarity is Hamming distance over 64 bits. 70% agreement = 19 differing bits. Standard near-duplicate detection uses ≤ 10 bits (~84%). At 19 bits you will match photos that have nothing to do with each other — two grey road surfaces, two piles of rubble. Your duplicate warning will fire constantly and users will learn to dismiss it. **Use ≤ 12 for "likely duplicate," ≤ 6 for "almost certainly the same file."**
- **10 m is tighter than GPS error.** Phone GPS gives 5–20 m in the open and degrades badly in dense urban areas. Two people standing at the same pothole can easily log coordinates 25 m apart. A 10 m radius will miss genuine duplicates. **Use 30 m for point issues, 60 m for linear ones**, and rely on the candidate-review UI rather than the radius to keep precision.

- **The bigger gap:** pHash compares *pixels*. Two different people photographing the same pothole — different angle, different time of day, different phone — produce hashes that don't match at any sane threshold. Your most common duplicate case is exactly the one pHash misses. That's what the geospatial + category + CLIP-embedding path in §6.2 is for. Keep pHash; it's cheap and catches deliberate re-uploads. Just don't let it carry the whole feature.

### 9.6 Automatic department detection — BUILDABLE ✅
Category classification + point-in-polygon ward lookup + a mapping table. All standard. The genuine difficulty is **data, not code**: machine-readable ward boundary GeoJSON is inconsistently published across Indian municipalities. For the hackathon, seed 2–3 real wards from OSM boundary data or hand-drawn polygons and be upfront that production onboarding is a data-ingestion task per city.

### 9.7 Upvoting & auto-ranking — BUILDABLE ✅
No technical risk. The risk is entirely in the formula design (gaming, brigading, log-scaling upvotes so they inform rather than dominate). Handled in §5.2 and §7.

### 9.8 Before/after photo requirement — BUILDABLE ✅
Storage, geofencing, and timestamp ordering are all trivial. Automated "is this the same place" verification is *not* reliable — a fixed pothole looks different from an unfixed one by design. Treat the automated check as a flag for human review, not a gate.

### 9.9 Department scoring — BUILDABLE ✅ (with a normalisation warning)
The formula is easy. The trap is that naive time-to-resolve scoring **rewards premature closure** — the fastest way to a good score is to close everything immediately. The reopen-rate term and the citizen verification loop are what make the metric honest; don't ship one without the other. Also normalise by volume and category mix or you'll systematically penalise the busiest departments, which is both unfair and politically fatal for adoption.

### 9.10 Multi-language — BUILDABLE ✅
UI localisation is a solved problem. Two things people underestimate: (a) translating *user-generated* text at scale needs a translation model — self-host NLLB-200-distilled (600M fits easily in 8 GB) or use Bhashini; (b) Indic script rendering needs proper font loading and enough layout slack, since Hindi strings run ~20–30% longer than English.

### 9.11 Ministry escalation — PARTIALLY BUILDABLE ⚠️
The escalation *logic* — detect, package, queue, notify — is entirely buildable and is genuinely the most demo-able part of the admin panel. Actually delivering into a ministry's system is not; no public API exists. Ship it as a generated escalation dossier (PDF + email) and be explicit that the last mile is an integration contract.

### 9.12 Summary table

| Feature | Verdict |
|---|---|
| Three-panel interface | ✅ Buildable |
| In-app image capture | ✅ Buildable |
| Automatic department detection | ✅ Buildable (data-dependent) |
| Upvoting | ✅ Buildable |
| Auto-ranking | ✅ Buildable |
| Before/after photo gate | ✅ Buildable |
| Multi-language | ✅ Buildable |
| Department scoring | ✅ Buildable (needs normalisation) |
| Layer 1 — AI legitimacy check | ⚠️ Buildable; must flag, not block |
| Layer 2 — pHash duplicate detection | ⚠️ Buildable; thresholds need changing (70%→≤12 bits, 10 m→30 m) |
| Layer 3 — metadata verification | ⚠️ Rework from "read EXIF" to "attest at capture" |
| Civic score | ⚠️ Engine buildable; benefit disbursement is policy |
| Ministry escalation | ⚠️ Logic buildable; delivery is an integration contract |
| Aadhaar verification | ❌ Not available without a UIDAI licence — stub it |

---

## 10. Phasing

**Phase 1 — Web (Next.js)**
- Sprint 1: auth, data model + PostGIS, report submission with in-app camera, public feed, map view.
- Sprint 2: ML service (YOLO + CLIP + pHash), the 3-layer pipeline, duplicate-interception UI, auto department detection.
- Sprint 3: departmental panel — queue, assignment, before/after capture, closure flow, citizen verification & reopen.
- Sprint 4: admin panel — department scorecards, escalation queue, civic score ledger, i18n, polish.

**Phase 2 — React Native**
Same API. Adds: native camera with better geolocation, push notifications, offline queue for reports captured without connectivity (the single biggest real-world gap in the web build), and device attestation for capture trust.

## 11. Open Questions
1. Anonymous reporting — some of the highest-value reports (illegal dumping by a known local business) will not be filed under a real name. But anonymity breaks the civic score loop. Proposal: allow anonymous reports at zero score with mandatory manual review.
2. Faces and licence plates appear in street photos. Automatic blurring before a photo hits the public feed — v1 or v2?
3. Should reporters see which named staff member is assigned, or only the department? Naming individuals improves accountability and invites harassment.
4. SLA defaults per category — needs a real municipal reference, currently guessed.
5. What happens to a report when ward boundaries are redrawn?
