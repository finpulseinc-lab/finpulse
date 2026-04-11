# FinPulse Web App -- File Classification Design

**Date:** 2026-04-11
**Scope:** Full replacement of the Python CLI as a web application, starting with the file classification subsystem.
**Status:** Approved

---

## 1. Goal

Build FinPulse as a web application (replacing the existing Python CLI) that allows users to upload monthly financial files, have each file automatically classified by AI, confirm or override the classification, and proceed to parsing and reporting -- all through a browser.

The app is designed to support **multiple users** from day one. Authentication is deferred to a future phase, but the data model and storage structure are namespaced per user so adding auth later requires no data migration.

This spec covers **Phase 1: File Classification**. Parsing, analysis, and report generation are subsequent phases.

---

## 2. Architecture Overview

**Stack:** Express/TypeScript backend + React/Vite frontend (monorepo, npm workspaces)
**Deployment:** GCP -- Cloud Run (backend) + Cloud Storage/CDN (frontend static bundle)
**File storage:** GCP Cloud Storage bucket (replaces local Data/ folder)
**Classification engine:** Claude API (AI-first, user override available)

---

## 3. File Classification Flow

1. User uploads file(s) via the React UI
2. `POST /api/files/upload` stores raw file to GCS
3. Classifier Service calls Claude API with filename + content sample
4. Claude returns `{origin, fileType, infoType, confidence, reason}`
5. API returns classification result to UI
6. UI shows confidence badge (green/yellow/red) + override option
7. User clicks Confirm (`PATCH /api/files/:id/classification {confirmed: true}`) or overrides via dropdowns
8. API saves classification metadata as GCS sidecar JSON

---

## 4. Classification Schema

Each file is tagged across three dimensions:

| Dimension | Allowed Values |
|---|---|
| `origin` | `bank`, `credit_card_max`, `credit_card_cal`, `insurance_portal`, `pension_clearing`, `investment_portal`, `manual` |
| `file_type` | `pdf`, `xlsx`, `csv`, `png`, `md` |
| `info_type` | `checking_account`, `credit_card_transactions`, `pension`, `insurance`, `education_fund`, `investment`, `property` |

### TypeScript Types

```typescript
interface ClassificationResult {
  origin: Origin;
  fileType: FileType;
  infoType: InfoType;
  confidence: number;        // 0.0 - 1.0
  reason: string;            // Claude's explanation shown to user
  aiSuggested: boolean;
  userConfirmed: boolean;
  overridden: boolean;
}

interface FileRecord {
  id: string;                // UUID
  userId: string;            // Opaque user identifier -- auth-ready, no login required yet
  filename: string;
  gcsPath: string;           // gs://finpulse-data/{userId}/2026-04/filename
  uploadedAt: string;        // ISO 8601
  month: string;             // YYYY-MM
  classification: ClassificationResult;
}
```

Metadata sidecar: `{userId}/2026-04/file.pdf` -> `{userId}/2026-04/file.pdf.meta.json`

---

## 5. API Routes

All routes require `X-User-ID` header. Unverified in Phase 1; replaced by JWT claim in future auth phase with no schema changes.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/files/upload` | Upload one or more files; triggers AI classification for each |
| `GET` | `/api/files` | List all files for the current user with classification status |
| `GET` | `/api/files/:id` | Get single file + full classification details |
| `PATCH` | `/api/files/:id/classification` | Confirm or override classification |
| `DELETE` | `/api/files/:id` | Remove file from GCS + delete metadata |
| `GET` | `/api/files?confirmed=false` | Files pending user confirmation |
| `GET` | `/api/files?infoType=:infoType` | Filter files by info type |

---

## 6. Project Structure

```
finpulse/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── FileManager.tsx
│   │   │   └── ClassificationReview.tsx
│   │   ├── components/
│   │   │   ├── FileCard.tsx
│   │   │   ├── ConfidenceBadge.tsx
│   │   │   └── OverrideForm.tsx
│   │   ├── api/
│   │   └── types/
│   ├── index.html
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── routes/files.ts
│   │   ├── services/
│   │   │   ├── classifier.ts
│   │   │   └── storage.ts
│   │   ├── models/FileRecord.ts
│   │   └── index.ts
│   └── tsconfig.json
├── shared/
│   └── types.ts
├── .github/workflows/deploy.yml
├── docker/server.Dockerfile
├── package.json
└── .env.example
```

---

## 7. CI/CD Pipeline

Push to `main` -> run tests -> parallel deploy:
- **Frontend:** vite build -> gsutil rsync to GCS -> CDN cache invalidation
- **Backend:** Docker build -> Artifact Registry -> Cloud Run deploy (europe-west1, min-instances=0)

`VITE_API_URL` injected at build time. Cloud Run scales to zero for cost efficiency.

---

## 8. Security Notes

- No credentials in code -- all via GCP Secret Manager / Cloud Run env vars
- File uploads validated server-side: allowed types only, max size enforced
- Claude API key stored as Cloud Run secret, never exposed to client
- GCS bucket is private -- all access via Express API with service account (Storage Object Admin, single bucket)

---

## 9. Out of Scope (Phase 1)

- File parsing and data extraction (Phase 2)
- Spending analysis and report generation (Phase 3)
- User authentication (deferred; data model is auth-ready)
- Mobile-responsive UI (desktop-first)
