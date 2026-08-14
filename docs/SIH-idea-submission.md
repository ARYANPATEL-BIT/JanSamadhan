# SIH Idea Submission — NAGAR SETU

Source of truth for the 6-slide deck (including title). Template: **6 slides max**, no paragraphs, do not change pointer headings, export PDF.

Fill **Team ID** and **Team Name** from the portal. Re-check theme on the live SIH portal before submitting a 2026 edition.

Verified from SIH 2025 PS lists: **SIH25031 / 25031**, Software, **Clean & Green Technology**, Government of Jharkhand.

---

## SLIDE 1 — TITLE PAGE

- **Problem Statement ID** — 25031
- **Problem Statement Title** — Crowdsourced Civic Issue Reporting and Resolution System
- **Theme** — Clean & Green Technology
- **PS Category** — Software
- **Team ID** — [from portal]
- **Team Name** — [as registered]

---

## SLIDE 2 — IDEA TITLE

**Idea Title:** NAGAR SETU — Report in 30 seconds. Verified fixes, not claimed ones.

### Proposed Solution

**What it is**
- Camera-first civic reporting — open, point, submit. No forms, no category selection.
- Photo determines *what* the issue is; GPS determines *whose* job it is. Auto-routed to the correct municipal department.
- Three panels: Citizen · Department · Admin

**How it addresses the problem**
- *Reporting friction* → zero-form submission; citizen never needs to know the municipal org chart
- *No accountability* → department cannot self-close. Geofenced before/after proof + citizen verification + reopen loop
- *No prioritisation* → upvotes, severity, SLA age and proximity to schools/hospitals produce a ranked queue
- *Duplicate flooding* → 3-layer detection merges reports instead of multiplying them

**Innovation & uniqueness**
- **Closure requires citizen sign-off.** Existing grievance portals treat "resolved" as a department declaration. Ours is a two-party state transition.
- **3-layer trust pipeline** — vision legitimacy check → perceptual hash + geo-clustering → capture attestation
- **Two-sided scoring** — citizens earn civic score for *verified* reports; departments are scored on SLA adherence, satisfaction, reopen rate and proof quality
- **Auto-escalation** — untouched >30 days or reopened twice → ministry dossier generated automatically

---

## SLIDE 3 — TECHNICAL APPROACH

### Technologies

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, MapLibre + OpenStreetMap |
| Backend | Versioned REST API `/api/v1`, Node.js |
| Database | PostgreSQL + **PostGIS** (geospatial queries) + **pgvector** (embedding similarity) |
| ML Service | Python FastAPI — YOLOv8n (detection), CLIP ViT-B/32 (zero-shot + embeddings), pHash, Whisper (voice input), NLLB (translation) |
| Auth | Phone OTP via WhatsApp (outside TRAI DLT scope) |
| i18n | next-intl — English, Hindi + regional languages |

**All models run on local consumer GPU — zero recurring inference cost.**

### Methodology
Eraser.io flowchart (prompt below). Keep the stack table small.

---

## SLIDE 4 — FEASIBILITY AND VIABILITY

### Feasibility
- Every component uses proven, open-source technology — no unsolved research problems
- YOLOv8n + CLIP fit in 8 GB VRAM; PostGIS `ST_DWithin` handles geo-queries natively
- Zero marginal cost: self-hosted models, free-tier infrastructure, OSM tiles

### Challenges & risks → mitigation

| Risk | Mitigation |
|---|---|
| GPS accuracy is 5–20 m, worse in dense urban areas | Duplicate radius set to 30 m (60 m linear), not 10 m; citizen confirms the merge |
| pHash misses the same pothole shot from a different angle | CLIP embedding similarity + geo-clustering as the primary duplicate signal; pHash catches re-uploads |
| AI may fail to detect a legitimate issue | Model **flags, never blocks** — a false negative discarding a real complaint is worse than spam reaching review |
| EXIF metadata is stripped by browsers and trivially forged | Trust established at capture: device GPS + server timestamp bound at shutter, not read from the file |
| Time-based scoring incentivises premature closure | Reopen-rate penalty + citizen verification; scores normalised by volume and category mix |
| Gamified scoring incentivises fake reports | Score keys off *verified and resolved* reports; rejection penalty outweighs the reward |
| SMS OTP requires TRAI DLT registration (needs a registered entity) | WhatsApp OTP — outside DLT scope. Production municipality would use the DLT government header route |
| Ward boundary GeoJSON inconsistently published | Per-city data ingestion at onboarding; demo seeded with real ward polygons |

---

## SLIDE 5 — IMPACT AND BENEFITS

### Target audience impact
- **Citizens** — proof their report landed and was acted on; 30-second reporting removes the literacy and form-navigation barrier; multi-language + voice input reaches non-English, non-typing users
- **Municipal departments** — a ranked, deduplicated work queue instead of a raw complaint dump; field staff get geotagged task lists
- **Ministry / state** — comparative department performance data that currently doesn't exist in structured form

### Benefits
- **Social** — restores the feedback loop between citizen and civic body; escalation gives recourse where none exists today; accessibility-compliant (GIGW) and multilingual by default
- **Economic** — duplicate merging cuts wasted dispatch; SLA data reveals genuine resource shortfalls vs. process failure; zero recurring inference cost keeps municipal deployment affordable
- **Environmental** — faster resolution of garbage, waterlogging and open-drain reports directly reduces public-health and sanitation risk
- **Governance** — verifiable proof-of-work creates an audit trail; escalation makes inaction visible rather than absorbable

---

## SLIDE 6 — RESEARCH AND REFERENCES

Use real, checkable links only. **Do not invent statistics.**

- **GIGW 3.0** — Guidelines for Indian Government Websites
- **TRAI TCCCPR / DLT** — WhatsApp OTP decision
- **Swachhata App (MoHUA)** and **CPGRAMS** — prior art; no proof-of-work gate, no citizen verification of closure
- **Aadhaar Act 2016, §29** — do not store Aadhaar data
- **YOLOv8 / Ultralytics** and **CLIP** (Radford et al., 2021)
- **PostGIS** `ST_DWithin`
- Cite only datasets actually used for training
- GitHub: https://github.com/ARYANPATEL-BIT/JanSamadhan

---

## Eraser.io flowchart prompt

Paste into Eraser AI (Flowchart mode).

Create a **flowchart diagram** for a civic issue reporting and resolution web platform. Keep it clean enough to read on a projected slide — group related steps, use swimlane-style groups, and label edges with short verbs.

**Group 1 — Citizen (blue):**
Citizen opens app → Phone OTP login → In-app camera capture → Image plus GPS plus timestamp sent to server

**Group 2 — Trust Pipeline (orange), three sequential layers:**
- Layer 1 — Vision check: YOLOv8n plus CLIP verify the photo contains a real civic issue. Decision node: confidence high → auto-accept; medium → manual review lane; low → warn citizen but still allow submit.
- Layer 2 — Duplicate detection: perceptual hash Hamming distance plus PostGIS geo-cluster within 30 metres plus CLIP embedding similarity. Decision node: duplicate found or not.
- Layer 3 — Capture attestation: device GPS accuracy, server timestamp, clock skew, cross-report collusion check.

**Duplicate branch:** if duplicates found → show similar nearby reports to citizen → decision node: "Same issue" merges as an upvote plus corroborating photo, "Different" proceeds as a new report tagged possible-duplicate.

**Group 3 — Routing (purple):**
Auto-detect category from image plus ward from PostGIS point-in-polygon → map to department and SLA → compute priority score from severity, upvotes, age and proximity to schools or hospitals → ranked department queue.

**Group 4 — Department (green):**
Department admin reviews queue → decision node: legitimate or spam. Spam → reject and penalise citizen civic score. Legitimate → assign to field staff and start SLA clock → field staff captures BEFORE photo geofenced within 50 metres → status In Progress → field staff captures AFTER photo → proof gate decision: both photos valid? No loops back to assignment; Yes proceeds to closure submitted.

**Group 5 — Verification (blue):**
Status Pending Citizen Verification → citizen sees before and after side by side → decision node with three branches: Confirm → Resolved, award civic score, credit department score; Reopen with photo → back to assignment, penalise department score, increment reopen counter; No response in 7 days → auto-resolved at low confidence weight.

**Group 6 — Admin and Escalation (red):**
Nightly escalation watcher monitors the queue. Three triggers feed it: open more than 30 days with no action, reopened two or more times, department SLA breach rate high. All three → escalation queue → generate ministry dossier as PDF. Separately, resolved and reopened events feed a monthly department scorecard combining SLA adherence, citizen satisfaction, reopen rate and proof quality.

Use icons where sensible. Colour each group distinctly. Keep node labels to four or five words.

If the full diagram is unreadable at slide size, put citizen-to-queue on slide 3 and department/verification as bullets.
