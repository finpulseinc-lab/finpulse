# FinPulse Web App

## Project Overview

FinPulse is a web application for uploading, classifying, and managing monthly financial files. It replaces a previous Python CLI tool and is built as a multi-user platform from day one.

**Phase 1 (current):** File upload + AI-powered classification with user confirm/override  
**Phase 2 (future):** File parsing and data extraction  
**Phase 3 (future):** Spending analysis and report generation  
**Auth (future):** Multi-user data model is in place; authentication layer is deferred

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Backend | Express (TypeScript) |
| Monorepo | npm workspaces |
| File storage | GCP Cloud Storage (private bucket) |
| Frontend hosting | GCP Cloud Storage + Cloud CDN (static bundle) |
| Backend hosting | GCP Cloud Run (scales to zero) |
| Container registry | GCP Artifact Registry |
| AI classification | Claude API (claude-3-5-haiku-latest) |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
finpulse/
├── client/                    # React/Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── FileManager.tsx
│   │   │   └── ClassificationReview.tsx
│   │   ├── components/
│   │   │   ├── FileCard.tsx
│   │   │   ├── ConfidenceBadge.tsx
│   │   │   └── OverrideForm.tsx
│   │   ├── api/               # Typed fetch wrappers
│   │   └── types/             # Re-exports from shared/types.ts
│   ├── index.html
│   └── vite.config.ts
│
├── server/                    # Express/TypeScript backend
│   ├── src/
│   │   ├── routes/files.ts    # All /api/files/* handlers
│   │   ├── services/
│   │   │   ├── classifier.ts  # Claude API integration
│   │   │   └── storage.ts     # GCS abstraction
│   │   ├── models/FileRecord.ts
│   │   └── index.ts
│   └── tsconfig.json
│
├── shared/
│   └── types.ts               # Shared types (FileRecord, ClassificationResult)
│
├── .github/workflows/
│   └── deploy.yml             # Parallel CI/CD: Cloud Run + CDN
│
├── docker/server.Dockerfile
├── docs/specs/                # Design specs
├── package.json               # Workspace root
└── .env.example
```

---

## API Routes

All routes require `X-User-ID` header (unverified in Phase 1; replaced by JWT claim when auth is added -- no schema changes needed).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/files/upload` | Upload files; triggers AI classification |
| `GET` | `/api/files` | List all files with classification status |
| `GET` | `/api/files/:id` | Single file + full classification |
| `PATCH` | `/api/files/:id/classification` | Confirm or override classification |
| `DELETE` | `/api/files/:id` | Delete file + metadata from GCS |
| `GET` | `/api/files?confirmed=false` | Pending review queue |
| `GET` | `/api/files?infoType=pension` | Filter by info type |

---

## Classification Schema

Each uploaded file is classified across three dimensions by the Claude API:

| Dimension | Values |
|---|---|
| `origin` | `bank` / `credit_card_max` / `credit_card_cal` / `insurance_portal` / `pension_clearing` / `investment_portal` / `manual` |
| `file_type` | `pdf` / `xlsx` / `csv` / `png` / `md` |
| `info_type` | `checking_account` / `credit_card_transactions` / `pension` / `insurance` / `education_fund` / `investment` / `property` |

Plus: `confidence` (0-1), `reason` (plain-language explanation), `aiSuggested`, `userConfirmed`, `overridden`.

---

## Storage Layout

- Raw files: `gs://finpulse-data/{userId}/{YYYY-MM}/{filename}`
- Metadata: `gs://finpulse-data/{userId}/{YYYY-MM}/{filename}.meta.json`

All GCS paths are scoped by `userId` for multi-user isolation.

---

## CI/CD

Push to `main` triggers tests, then deploys in parallel:
- **Frontend:** `vite build` -> `gsutil rsync` -> CDN cache invalidation
- **Backend:** Docker build -> Artifact Registry -> Cloud Run deploy

`VITE_API_URL` is injected at build time as a GitHub Actions secret.

---

## Environment Variables

```
VITE_API_URL=                         # Cloud Run service URL (injected at build time)
GCS_BUCKET=finpulse-data              # GCS bucket name
ANTHROPIC_API_KEY=                    # Claude API key (Cloud Run secret)
GOOGLE_APPLICATION_CREDENTIALS=      # Service account JSON (local dev only)
```

---

## GitHub Project

- **Org:** finpulseinc-lab
- **Repo:** https://github.com/finpulseinc-lab/finpulse
- **Kanban:** https://github.com/orgs/finpulseinc-lab/projects/1
- **Issues:** 15 user stories (#2-#16), all in Backlog with Priority and Size fields set

### Labels
`setup` / `infrastructure` / `gcp` / `ci-cd` / `upload` / `frontend` / `backend` / `classification` / `review` / `file-manager` / `multi-user`

---

## Design Spec

Full architecture and design decisions:
`docs/specs/2026-04-11-finpulse-webapp-file-classification-design.md`
