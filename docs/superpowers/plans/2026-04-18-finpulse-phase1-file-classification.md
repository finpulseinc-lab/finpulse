# FinPulse Phase 1: File Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Express web app that lets users upload monthly financial files, auto-classifies each via the Claude API, and lets users confirm or override the classification.

**Architecture:** Express/TypeScript backend receives multipart uploads, stores raw files to GCS, calls `classifier.ts` (Claude API) synchronously during upload, persists a `.meta.json` metadata sidecar per file in GCS, and exposes a REST API. React/Vite frontend provides upload drag-and-drop, a file manager with filtering, and per-file review cards with confidence badges and override dropdowns. All routes are scoped by `X-User-ID` header.

**Tech Stack:** Node 20, TypeScript 5 strict, Express 4, multer, @google-cloud/storage, @anthropic-ai/sdk (claude-3-5-haiku-latest), React 18, React Router 6, Vite 5, Tailwind CSS, Jest + Supertest + ts-jest (backend), Vitest + React Testing Library (frontend), Docker multi-stage, GitHub Actions, GCP (Cloud Run europe-west1, Cloud Storage, Artifact Registry, CDN).

**Resolves GitHub issues:** #2 (monorepo), #3 (GCS), #4 (CI/CD), #5 (upload UI), #6 (server upload), #7 (classification display), #8 (classifier service), #9 (confirm), #10 (override), #11 (confidence badge), #12 (file list), #13 (filter by status), #14 (filter by infoType), #15 (delete), #16 (multi-user scoping).

---

## File Structure Map

```
finpulse/
├── package.json                                 # workspace root
├── .env.example
├── .gitignore
│
├── shared/
│   ├── package.json
│   └── types.ts                                 # all shared types + enums
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   └── src/
│       ├── index.ts                             # Express app + listen
│       ├── middleware/
│       │   └── userId.ts                        # X-User-ID → res.locals.userId
│       ├── routes/
│       │   └── files.ts                         # all /api/files/* handlers
│       └── services/
│           ├── classifier.ts                    # Claude API classify()
│           └── storage.ts                       # GCS abstraction (StorageService class)
│   └── tests/
│       ├── middleware/
│       │   └── userId.test.ts
│       ├── routes/
│       │   └── files.test.ts
│       └── services/
│           ├── classifier.test.ts
│           └── storage.test.ts
│
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── test-setup.ts
│       ├── types/index.ts                       # re-export from shared/types
│       ├── api/files.ts                         # typed fetch wrappers
│       ├── components/
│       │   ├── ConfidenceBadge.tsx
│       │   ├── OverrideForm.tsx
│       │   ├── FileCard.tsx
│       │   ├── UploadZone.tsx
│       │   └── __tests__/
│       │       ├── ConfidenceBadge.test.tsx
│       │       ├── OverrideForm.test.tsx
│       │       ├── FileCard.test.tsx
│       │       └── UploadZone.test.tsx
│       └── pages/
│           ├── FileManager.tsx
│           └── __tests__/
│               └── FileManager.test.tsx
│
├── docker/
│   └── server.Dockerfile
└── .github/workflows/
    └── deploy.yml
```

---

## Task 1: Monorepo Scaffold

**Closes:** #2

**Files:**
- Create: `package.json`
- Create: `shared/package.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/jest.config.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/test-setup.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "finpulse",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "test": "npm run test -w server && npm run test -w client",
    "lint": "npm run lint -w server && npm run lint -w client"
  },
  "devDependencies": {
    "concurrently": "8.2.0"
  }
}
```

- [ ] **Step 2: Create `shared/package.json`**

```json
{
  "name": "@finpulse/shared",
  "version": "1.0.0",
  "main": "types.ts",
  "types": "types.ts"
}
```

- [ ] **Step 3: Create `server/package.json`**

```json
{
  "name": "@finpulse/server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "0.39.0",
    "@finpulse/shared": "*",
    "@google-cloud/storage": "7.9.0",
    "cors": "2.8.5",
    "express": "4.18.2",
    "multer": "1.4.5-lts.1",
    "uuid": "9.0.0"
  },
  "devDependencies": {
    "@types/cors": "2.8.17",
    "@types/express": "4.17.21",
    "@types/jest": "29.5.12",
    "@types/multer": "1.4.11",
    "@types/node": "20.11.0",
    "@types/supertest": "6.0.2",
    "@types/uuid": "9.0.7",
    "jest": "29.7.0",
    "supertest": "6.3.4",
    "ts-jest": "29.2.5",
    "ts-node": "10.9.2",
    "ts-node-dev": "2.0.0",
    "typescript": "5.3.3"
  }
}
```

- [ ] **Step 4: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "paths": {
      "@finpulse/shared": ["../shared/types"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create `server/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@finpulse/shared$': '<rootDir>/../shared/types',
  },
};

export default config;
```

- [ ] **Step 6: Create `client/package.json`**

```json
{
  "name": "@finpulse/client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@finpulse/shared": "*",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "6.22.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.0",
    "@testing-library/react": "14.2.1",
    "@testing-library/user-event": "14.5.2",
    "@types/react": "18.2.55",
    "@types/react-dom": "18.2.19",
    "@vitejs/plugin-react": "4.2.1",
    "jsdom": "24.0.0",
    "tailwindcss": "3.4.1",
    "typescript": "5.3.3",
    "vite": "5.1.0",
    "vitest": "1.3.0"
  }
}
```

- [ ] **Step 7: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@finpulse/shared": ["../shared/types"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Create `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@finpulse/shared': resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 9: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FinPulse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `client/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 11: Create `.env.example`**

```
# Vite: Cloud Run service URL (injected at build time)
VITE_API_URL=http://localhost:3001

# GCS bucket for financial data
GCS_BUCKET=finpulse-data

# Claude API key (stored as Cloud Run secret in production)
ANTHROPIC_API_KEY=

# GCP service account JSON (single-line, for local dev only — not used in Cloud Run)
GCS_KEY_JSON=

# Server port
PORT=3001
```

- [ ] **Step 12: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
Data/
OLD/
client/dist/
```

- [ ] **Step 13: Install all workspace dependencies (no install scripts)**

```bash
npm install --ignore-scripts
```

`--ignore-scripts` prevents any `postinstall`/`preinstall` scripts from running — the primary execution vector for npm supply chain attacks. All packages in this project work correctly without their install scripts.

Expected: `node_modules/` created at root and in each workspace. No errors.

- [ ] **Step 13b: Audit for known CVEs**

```bash
npm audit --audit-level=high
```

Expected: 0 high or critical vulnerabilities. If any appear, do not proceed — investigate before continuing.

- [ ] **Step 14: Verify TypeScript compiles in server workspace (no src files yet — expect path error only)**

```bash
cd server && npx tsc --noEmit 2>&1 | head -5; cd ..
```

Expected: error about missing `src/index.ts` — that's fine, it means TS is wired up.

- [ ] **Step 15: Commit**

```bash
git add package.json shared/package.json server/package.json server/tsconfig.json server/jest.config.ts client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/src/test-setup.ts .env.example .gitignore
git commit -m "feat: scaffold Express/TypeScript + React/Vite monorepo with npm workspaces

Closes #2"
```

---

## Task 2: Shared Types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Create `shared/types.ts`**

```typescript
export type Origin =
  | 'bank'
  | 'credit_card_max'
  | 'credit_card_cal'
  | 'insurance_portal'
  | 'pension_clearing'
  | 'investment_portal'
  | 'manual';

export type FileType = 'pdf' | 'xlsx' | 'csv' | 'png' | 'md';

export type InfoType =
  | 'checking_account'
  | 'credit_card_transactions'
  | 'pension'
  | 'insurance'
  | 'education_fund'
  | 'investment'
  | 'property';

export interface ClassificationResult {
  origin: Origin;
  fileType: FileType;
  infoType: InfoType;
  confidence: number;   // 0.0–1.0
  reason: string;       // shown to user; "Classification failed" on error
  aiSuggested: boolean;
  userConfirmed: boolean;
  overridden: boolean;
}

export interface FileRecord {
  id: string;           // UUID
  userId: string;       // from X-User-ID header — auth-ready, no login yet
  filename: string;
  gcsPath: string;      // relative path within bucket: {userId}/{YYYY-MM}/{filename}
  uploadedAt: string;   // ISO 8601
  month: string;        // YYYY-MM derived from uploadedAt
  classification: ClassificationResult;
}

// Human-readable labels for UI dropdowns
export const ORIGIN_LABELS: Record<Origin, string> = {
  bank: 'Bank',
  credit_card_max: 'Credit Card — MAX',
  credit_card_cal: 'Credit Card — Cal',
  insurance_portal: 'Insurance Portal',
  pension_clearing: 'Pension Clearing House',
  investment_portal: 'Investment Portal',
  manual: 'Manual',
};

export const INFO_TYPE_LABELS: Record<InfoType, string> = {
  checking_account: 'Checking Account',
  credit_card_transactions: 'Credit Card Transactions',
  pension: 'Pension',
  insurance: 'Insurance',
  education_fund: 'Education Fund',
  investment: 'Investment',
  property: 'Property',
};

// PATCH /api/files/:id/classification request body
export type PatchClassificationBody =
  | { confirmed: true }
  | { override: { origin?: Origin; infoType?: InfoType } };

// GET /api/files response
export interface ListFilesResponse {
  files: FileRecord[];
  total: number;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd shared && npx tsc --strict --noEmit --allowJs --target ES2020 --module commonjs types.ts && cd ..
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add shared TypeScript types (FileRecord, ClassificationResult, enums, labels)"
```

---

## Task 3: Storage Service

**Closes:** #3 (code portion), #16 (GCS path scoping)

**Files:**
- Create: `server/src/services/storage.ts`
- Create: `server/tests/services/storage.test.ts`

- [ ] **Step 1: Write failing tests — `server/tests/services/storage.test.ts`**

```typescript
jest.mock('@google-cloud/storage');

import { Storage } from '@google-cloud/storage';
import { StorageService } from '../../src/services/storage';
import type { FileRecord } from '@finpulse/shared';

const MockStorage = Storage as jest.MockedClass<typeof Storage>;

const fakeRecord: FileRecord = {
  id: 'abc-123',
  userId: 'user1',
  filename: 'test.pdf',
  gcsPath: 'user1/2026-04/test.pdf',
  uploadedAt: '2026-04-18T10:00:00.000Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.9,
    reason: 'Looks like a bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

describe('StorageService', () => {
  let mockSave: jest.Mock;
  let mockDownload: jest.Mock;
  let mockDelete: jest.Mock;
  let mockFile: jest.Mock;
  let mockGetFiles: jest.Mock;
  let mockBucket: jest.Mock;
  let service: StorageService;

  beforeEach(() => {
    mockSave = jest.fn().mockResolvedValue(undefined);
    mockDownload = jest.fn().mockResolvedValue([Buffer.from('file content sample')]);
    mockDelete = jest.fn().mockResolvedValue(undefined);
    mockFile = jest.fn().mockReturnValue({ save: mockSave, download: mockDownload, delete: mockDelete });
    mockGetFiles = jest.fn().mockResolvedValue([[
      {
        name: 'user1/2026-04/test.pdf.meta.json',
        download: jest.fn().mockResolvedValue([Buffer.from(JSON.stringify(fakeRecord))]),
      },
    ]]);
    mockBucket = jest.fn().mockReturnValue({ file: mockFile, getFiles: mockGetFiles });
    MockStorage.mockImplementation(() => ({ bucket: mockBucket } as any));
    service = new StorageService('finpulse-data');
  });

  it('uploadFile stores buffer at userId/month/filename and returns gcsPath', async () => {
    const path = await service.uploadFile('user1', '2026-04', 'test.pdf', Buffer.from('data'), 'application/pdf');
    expect(path).toBe('user1/2026-04/test.pdf');
    expect(mockFile).toHaveBeenCalledWith('user1/2026-04/test.pdf');
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('data'), {
      metadata: { contentType: 'application/pdf' },
      resumable: false,
    });
  });

  it('getContentSample returns decoded string content', async () => {
    const sample = await service.getContentSample('user1/2026-04/test.pdf');
    expect(sample).toBe('file content sample');
    expect(mockFile).toHaveBeenCalledWith('user1/2026-04/test.pdf');
  });

  it('saveMetadata writes JSON to gcsPath.meta.json', async () => {
    await service.saveMetadata(fakeRecord);
    expect(mockFile).toHaveBeenCalledWith('user1/2026-04/test.pdf.meta.json');
    expect(mockSave).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(fakeRecord)),
      { metadata: { contentType: 'application/json' }, resumable: false }
    );
  });

  it('getMetadata reads and parses .meta.json sidecar', async () => {
    mockFile.mockReturnValueOnce({
      download: jest.fn().mockResolvedValue([Buffer.from(JSON.stringify(fakeRecord))]),
    });
    const record = await service.getMetadata('user1/2026-04/test.pdf');
    expect(record).toMatchObject({ id: 'abc-123', userId: 'user1' });
  });

  it('listMetadata returns all FileRecords for a user scoped by prefix', async () => {
    const records = await service.listMetadata('user1');
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('abc-123');
    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'user1/', matchGlob: '**/*.meta.json' });
  });

  it('listMetadata filters by month when provided', async () => {
    await service.listMetadata('user1', '2026-04');
    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'user1/2026-04/', matchGlob: '**/*.meta.json' });
  });

  it('deleteFile removes raw file and sidecar in parallel', async () => {
    await service.deleteFile('user1/2026-04/test.pdf');
    expect(mockFile).toHaveBeenCalledWith('user1/2026-04/test.pdf');
    expect(mockFile).toHaveBeenCalledWith('user1/2026-04/test.pdf.meta.json');
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npx jest tests/services/storage.test.ts --no-coverage 2>&1 | tail -10; cd ..
```

Expected: FAIL — `Cannot find module '../../src/services/storage'`

- [ ] **Step 3: Implement `server/src/services/storage.ts`**

```typescript
import { Storage } from '@google-cloud/storage';
import type { FileRecord } from '@finpulse/shared';

export class StorageService {
  private bucket;

  constructor(bucketName: string, keyJson?: string) {
    const opts = keyJson
      ? { credentials: JSON.parse(keyJson) }
      : {};
    this.bucket = new Storage(opts).bucket(bucketName);
  }

  async uploadFile(
    userId: string,
    month: string,
    filename: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const gcsPath = `${userId}/${month}/${filename}`;
    await this.bucket.file(gcsPath).save(buffer, {
      metadata: { contentType },
      resumable: false,
    });
    return gcsPath;
  }

  async getContentSample(gcsPath: string): Promise<string> {
    const [buffer] = await this.bucket.file(gcsPath).download();
    return buffer.toString('utf8').slice(0, 500);
  }

  async saveMetadata(record: FileRecord): Promise<void> {
    const metaPath = `${record.gcsPath}.meta.json`;
    await this.bucket.file(metaPath).save(Buffer.from(JSON.stringify(record)), {
      metadata: { contentType: 'application/json' },
      resumable: false,
    });
  }

  async getMetadata(gcsPath: string): Promise<FileRecord> {
    const [buffer] = await this.bucket.file(`${gcsPath}.meta.json`).download();
    return JSON.parse(buffer.toString('utf8')) as FileRecord;
  }

  async listMetadata(userId: string, month?: string): Promise<FileRecord[]> {
    const prefix = month ? `${userId}/${month}/` : `${userId}/`;
    const [files] = await this.bucket.getFiles({ prefix, matchGlob: '**/*.meta.json' });
    const records = await Promise.all(
      files.map(async (f) => {
        const [buf] = await f.download();
        return JSON.parse(buf.toString('utf8')) as FileRecord;
      })
    );
    return records;
  }

  async deleteFile(gcsPath: string): Promise<void> {
    await Promise.all([
      this.bucket.file(gcsPath).delete(),
      this.bucket.file(`${gcsPath}.meta.json`).delete(),
    ]);
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd server && npx jest tests/services/storage.test.ts --no-coverage; cd ..
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/storage.ts server/tests/services/storage.test.ts
git commit -m "feat: add StorageService (GCS upload, metadata sidecar, list, delete)

Closes #3"
```

---

## Task 4: Classifier Service

**Closes:** #7, #8

**Files:**
- Create: `server/src/services/classifier.ts`
- Create: `server/tests/services/classifier.test.ts`

- [ ] **Step 1: Write failing tests — `server/tests/services/classifier.test.ts`**

```typescript
jest.mock('@anthropic-ai/sdk');

import Anthropic from '@anthropic-ai/sdk';
import { classify } from '../../src/services/classifier';

const MockAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

function mockAnthropicResponse(text: string) {
  MockAnthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
      }),
    },
  } as any));
}

describe('classify()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a valid ClassificationResult on success', async () => {
    mockAnthropicResponse(JSON.stringify({
      origin: 'bank',
      infoType: 'checking_account',
      confidence: 0.95,
      reason: 'Filename contains bank and transaction keywords',
    }));
    const result = await classify('bank-statement-2026-04.pdf', 'Account No. 123456 Balance: ...');
    expect(result.origin).toBe('bank');
    expect(result.infoType).toBe('checking_account');
    expect(result.confidence).toBe(0.95);
    expect(result.aiSuggested).toBe(true);
    expect(result.userConfirmed).toBe(false);
    expect(result.overridden).toBe(false);
  });

  it('returns confidence 0 and reason "Classification failed" on API error — never throws', async () => {
    MockAnthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error('API error')) },
    } as any));
    const result = await classify('file.pdf', '');
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe('Classification failed');
    expect(result.aiSuggested).toBe(true);
  });

  it('returns confidence 0 on malformed JSON response — never throws', async () => {
    mockAnthropicResponse('not valid json at all');
    const result = await classify('file.pdf', '');
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe('Classification failed');
  });

  it('falls back gracefully when origin or infoType are missing from response', async () => {
    mockAnthropicResponse(JSON.stringify({ confidence: 0.3, reason: 'Partial response' }));
    const result = await classify('file.pdf', '');
    expect(result.origin).toBe('manual');
    expect(result.infoType).toBe('investment');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npx jest tests/services/classifier.test.ts --no-coverage 2>&1 | tail -10; cd ..
```

Expected: FAIL — `Cannot find module '../../src/services/classifier'`

- [ ] **Step 3: Implement `server/src/services/classifier.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ClassificationResult, Origin, InfoType, FileType } from '@finpulse/shared';

const MIME_TO_FILE_TYPE: Record<string, FileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'image/png': 'png',
  'text/markdown': 'md',
};

export function mimeToFileType(mime: string): FileType {
  return MIME_TO_FILE_TYPE[mime] ?? 'pdf';
}

const PROMPT = (filename: string, sample: string) => `
You are classifying a personal financial file.
Filename: ${filename}
${sample ? `Content sample (first 500 chars):\n${sample}` : '(no text content)'}

Classify this file and respond with JSON only (no markdown, no explanation):
{
  "origin": one of: bank | credit_card_max | credit_card_cal | insurance_portal | pension_clearing | investment_portal | manual,
  "infoType": one of: checking_account | credit_card_transactions | pension | insurance | education_fund | investment | property,
  "confidence": float 0.0–1.0,
  "reason": one sentence in English explaining why
}
`.trim();

const FALLBACK: Omit<ClassificationResult, 'fileType'> = {
  origin: 'manual' as Origin,
  infoType: 'investment' as InfoType,
  confidence: 0,
  reason: 'Classification failed',
  aiSuggested: true,
  userConfirmed: false,
  overridden: false,
};

export async function classify(
  filename: string,
  contentSample: string,
  mimeType = 'application/pdf'
): Promise<ClassificationResult> {
  const fileType = mimeToFileType(mimeType);
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 256,
      messages: [{ role: 'user', content: PROMPT(filename, contentSample) }],
    });
    const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text);
    return {
      origin: (parsed.origin as Origin) ?? FALLBACK.origin,
      fileType,
      infoType: (parsed.infoType as InfoType) ?? FALLBACK.infoType,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reason: parsed.reason ?? FALLBACK.reason,
      aiSuggested: true,
      userConfirmed: false,
      overridden: false,
    };
  } catch {
    return { ...FALLBACK, fileType };
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd server && npx jest tests/services/classifier.test.ts --no-coverage; cd ..
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/classifier.ts server/tests/services/classifier.test.ts
git commit -m "feat: add classifier service (Claude API, fallback on error, never throws)

Closes #7 #8"
```

---

## Task 5: userId Middleware

**Closes:** #16

**Files:**
- Create: `server/src/middleware/userId.ts`
- Create: `server/tests/middleware/userId.test.ts`

- [ ] **Step 1: Write failing tests — `server/tests/middleware/userId.test.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { requireUserId } from '../../src/middleware/userId';

function makeReq(headers: Record<string, string>) {
  return { headers } as unknown as Request;
}

function makeRes() {
  const res = { locals: {}, status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

describe('requireUserId middleware', () => {
  it('sets res.locals.userId and calls next() when header is present', () => {
    const req = makeReq({ 'x-user-id': 'alice' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect(res.locals.userId).toBe('alice');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when X-User-ID header is missing', () => {
    const req = makeReq({});
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({ error: 'X-User-ID header is required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when X-User-ID header is empty string', () => {
    const req = makeReq({ 'x-user-id': '' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npx jest tests/middleware/userId.test.ts --no-coverage 2>&1 | tail -5; cd ..
```

Expected: FAIL — `Cannot find module '../../src/middleware/userId'`

- [ ] **Step 3: Implement `server/src/middleware/userId.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

/*
 * Phase 1: reads X-User-ID as an unverified client string.
 * Phase 2 (auth): replace this middleware to extract userId from a verified JWT claim.
 * All downstream code uses res.locals.userId — no changes needed outside this file.
 */
export function requireUserId(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    res.status(400).json({ error: 'X-User-ID header is required' });
    return;
  }
  res.locals.userId = userId;
  next();
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd server && npx jest tests/middleware/userId.test.ts --no-coverage; cd ..
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/userId.ts server/tests/middleware/userId.test.ts
git commit -m "feat: add requireUserId middleware with 400 on missing/empty X-User-ID header

Closes #16"
```

---

## Task 6: File Routes

**Closes:** #5 (server side), #6, #9, #10, #12, #13, #14, #15

**Files:**
- Create: `server/src/routes/files.ts`
- Create: `server/tests/routes/files.test.ts`

- [ ] **Step 1: Write failing tests — `server/tests/routes/files.test.ts`**

```typescript
jest.mock('../../src/services/storage');
jest.mock('../../src/services/classifier');

import request from 'supertest';
import express from 'express';
import { filesRouter } from '../../src/routes/files';
import { StorageService } from '../../src/services/storage';
import { classify } from '../../src/services/classifier';
import type { FileRecord } from '@finpulse/shared';

const MockStorageService = StorageService as jest.MockedClass<typeof StorageService>;
const mockClassify = classify as jest.MockedFunction<typeof classify>;

const fakeRecord: FileRecord = {
  id: 'abc-123',
  userId: 'user1',
  filename: 'bank.pdf',
  gcsPath: 'user1/2026-04/bank.pdf',
  uploadedAt: '2026-04-18T10:00:00.000Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.95,
    reason: 'Looks like a bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/files', filesRouter);
  return app;
}

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockStorageService.prototype.uploadFile = jest.fn().mockResolvedValue('user1/2026-04/bank.pdf');
    MockStorageService.prototype.getContentSample = jest.fn().mockResolvedValue('Bank Statement');
    MockStorageService.prototype.saveMetadata = jest.fn().mockResolvedValue(undefined);
    mockClassify.mockResolvedValue(fakeRecord.classification);
  });

  it('returns 400 when X-User-ID header is missing', async () => {
    const res = await request(makeApp())
      .post('/api/files/upload')
      .attach('files', Buffer.from('data'), 'bank.pdf');
    expect(res.status).toBe(400);
  });

  it('returns 400 for disallowed MIME type', async () => {
    const res = await request(makeApp())
      .post('/api/files/upload')
      .set('X-User-ID', 'user1')
      .attach('files', Buffer.from('data'), { filename: 'file.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });

  it('returns 201 with FileRecord array on successful upload', async () => {
    const res = await request(makeApp())
      .post('/api/files/upload')
      .set('X-User-ID', 'user1')
      .attach('files', Buffer.from('%PDF-1.4'), { filename: 'bank.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].filename).toBe('bank.pdf');
    expect(res.body[0].classification.origin).toBe('bank');
  });
});

describe('GET /api/files', () => {
  beforeEach(() => {
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([fakeRecord]);
  });

  it('returns 400 without X-User-ID', async () => {
    const res = await request(makeApp()).get('/api/files');
    expect(res.status).toBe(400);
  });

  it('returns files for authenticated user sorted by uploadedAt desc', async () => {
    const res = await request(makeApp())
      .get('/api/files')
      .set('X-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.files[0].id).toBe('abc-123');
  });

  it('filters by confirmed=false (pending review)', async () => {
    const unconfirmed = { ...fakeRecord, classification: { ...fakeRecord.classification, userConfirmed: false } };
    const confirmed = { ...fakeRecord, id: 'xyz', classification: { ...fakeRecord.classification, userConfirmed: true } };
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([unconfirmed, confirmed]);
    const res = await request(makeApp())
      .get('/api/files?confirmed=false')
      .set('X-User-ID', 'user1');
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].id).toBe('abc-123');
  });

  it('filters by infoType', async () => {
    const pension = { ...fakeRecord, id: 'p1', classification: { ...fakeRecord.classification, infoType: 'pension' as const } };
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([fakeRecord, pension]);
    const res = await request(makeApp())
      .get('/api/files?infoType=pension')
      .set('X-User-ID', 'user1');
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].id).toBe('p1');
  });
});

describe('GET /api/files/:id', () => {
  beforeEach(() => {
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([fakeRecord]);
  });

  it('returns 404 when file not found', async () => {
    const res = await request(makeApp())
      .get('/api/files/not-exist')
      .set('X-User-ID', 'user1');
    expect(res.status).toBe(404);
  });

  it('returns 403 when file belongs to different user', async () => {
    const res = await request(makeApp())
      .get('/api/files/abc-123')
      .set('X-User-ID', 'user2');
    expect(res.status).toBe(403);
  });

  it('returns 200 with FileRecord for correct user', async () => {
    const res = await request(makeApp())
      .get('/api/files/abc-123')
      .set('X-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('bank.pdf');
  });
});

describe('PATCH /api/files/:id/classification', () => {
  beforeEach(() => {
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([fakeRecord]);
    MockStorageService.prototype.saveMetadata = jest.fn().mockResolvedValue(undefined);
  });

  it('confirms classification with { confirmed: true }', async () => {
    const res = await request(makeApp())
      .patch('/api/files/abc-123/classification')
      .set('X-User-ID', 'user1')
      .send({ confirmed: true });
    expect(res.status).toBe(200);
    expect(res.body.classification.userConfirmed).toBe(true);
    expect(res.body.classification.overridden).toBe(false);
  });

  it('overrides classification with { override: { origin, infoType } }', async () => {
    const res = await request(makeApp())
      .patch('/api/files/abc-123/classification')
      .set('X-User-ID', 'user1')
      .send({ override: { origin: 'insurance_portal', infoType: 'insurance' } });
    expect(res.status).toBe(200);
    expect(res.body.classification.origin).toBe('insurance_portal');
    expect(res.body.classification.overridden).toBe(true);
    expect(res.body.classification.userConfirmed).toBe(true);
  });

  it('returns 403 on userId mismatch', async () => {
    const res = await request(makeApp())
      .patch('/api/files/abc-123/classification')
      .set('X-User-ID', 'user2')
      .send({ confirmed: true });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/files/:id', () => {
  beforeEach(() => {
    MockStorageService.prototype.listMetadata = jest.fn().mockResolvedValue([fakeRecord]);
    MockStorageService.prototype.deleteFile = jest.fn().mockResolvedValue(undefined);
  });

  it('deletes file and returns 204', async () => {
    const res = await request(makeApp())
      .delete('/api/files/abc-123')
      .set('X-User-ID', 'user1');
    expect(res.status).toBe(204);
    expect(MockStorageService.prototype.deleteFile).toHaveBeenCalledWith('user1/2026-04/bank.pdf');
  });

  it('returns 403 on userId mismatch', async () => {
    const res = await request(makeApp())
      .delete('/api/files/abc-123')
      .set('X-User-ID', 'user2');
    expect(res.status).toBe(403);
  });

  it('returns 404 when file not found', async () => {
    const res = await request(makeApp())
      .delete('/api/files/no-such-id')
      .set('X-User-ID', 'user1');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npx jest tests/routes/files.test.ts --no-coverage 2>&1 | tail -10; cd ..
```

Expected: FAIL — `Cannot find module '../../src/routes/files'`

- [ ] **Step 3: Implement `server/src/routes/files.ts`**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireUserId } from '../middleware/userId';
import { StorageService } from '../services/storage';
import { classify, mimeToFileType } from '../services/classifier';
import type { FileRecord, InfoType } from '@finpulse/shared';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'text/markdown',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Disallowed file type: ${file.mimetype}`));
    }
  },
});

const storage = new StorageService(
  process.env.GCS_BUCKET ?? 'finpulse-data',
  process.env.GCS_KEY_JSON
);

export const filesRouter = Router();
filesRouter.use(requireUserId);

filesRouter.post('/upload', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File exceeds 20 MB limit' });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  const userId = res.locals.userId as string;
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const records: FileRecord[] = await Promise.all(files.map(async (file) => {
    const gcsPath = await storage.uploadFile(userId, month, file.originalname, file.buffer, file.mimetype);
    const sample = file.mimetype === 'image/png' ? '' : await storage.getContentSample(gcsPath);
    const classification = await classify(file.originalname, sample, file.mimetype);
    classification.fileType = mimeToFileType(file.mimetype);

    const record: FileRecord = {
      id: uuidv4(),
      userId,
      filename: file.originalname,
      gcsPath,
      uploadedAt: now.toISOString(),
      month,
      classification,
    };
    await storage.saveMetadata(record);
    return record;
  }));

  res.status(201).json(records);
});

filesRouter.get('/', async (req, res) => {
  const userId = res.locals.userId as string;
  let files = await storage.listMetadata(userId);

  // filter: ?confirmed=true/false
  if (req.query.confirmed !== undefined) {
    const wantConfirmed = req.query.confirmed === 'true';
    files = files.filter((f) => f.classification.userConfirmed === wantConfirmed);
  }

  // filter: ?infoType=pension
  if (req.query.infoType) {
    files = files.filter((f) => f.classification.infoType === (req.query.infoType as InfoType));
  }

  files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  res.json({ files, total: files.length });
});

filesRouter.get('/:id', async (req, res) => {
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  res.json(file);
});

filesRouter.patch('/:id/classification', async (req, res) => {
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const body = req.body as { confirmed?: true; override?: { origin?: string; infoType?: string } };

  if (body.confirmed === true) {
    file.classification.userConfirmed = true;
  } else if (body.override) {
    if (body.override.origin) file.classification.origin = body.override.origin as typeof file.classification.origin;
    if (body.override.infoType) file.classification.infoType = body.override.infoType as typeof file.classification.infoType;
    file.classification.userConfirmed = true;
    file.classification.overridden = true;
  } else {
    res.status(400).json({ error: 'Body must be { confirmed: true } or { override: { origin?, infoType? } }' });
    return;
  }

  await storage.saveMetadata(file);
  res.json(file);
});

filesRouter.delete('/:id', async (req, res) => {
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  await storage.deleteFile(file.gcsPath);
  res.status(204).send();
});
```

- [ ] **Step 4: Run all server tests**

```bash
cd server && npx jest --no-coverage; cd ..
```

Expected: PASS — all tests across middleware, services, and routes.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/files.ts server/tests/routes/files.test.ts
git commit -m "feat: add all file API routes (upload, list, get, patch, delete) with userId scoping

Closes #5 #6 #9 #10 #12 #13 #14 #15 #16"
```

---

## Task 7: Express App Entry Point

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Create `server/src/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { filesRouter } from './routes/files';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  allowedHeaders: ['Content-Type', 'X-User-ID'],
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/files', filesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => console.log(`FinPulse API listening on :${PORT}`));

export { app };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit; cd ..
```

Expected: no errors.

- [ ] **Step 3: Smoke-test dev server (requires GCS credentials — skip if not configured)**

```bash
cd server && GCS_BUCKET=test ANTHROPIC_API_KEY=test npx ts-node src/index.ts &
sleep 2
curl -s http://localhost:3001/health
kill %1
cd ..
```

Expected: `{"ok":true}`

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: wire Express app with CORS, health check, and file router"
```

---

## Task 8: Frontend API Client

**Files:**
- Create: `client/src/types/index.ts`
- Create: `client/src/api/files.ts`

- [ ] **Step 1: Create `client/src/types/index.ts`**

```typescript
export type {
  FileRecord,
  ClassificationResult,
  Origin,
  FileType,
  InfoType,
  PatchClassificationBody,
  ListFilesResponse,
} from '@finpulse/shared';
export { ORIGIN_LABELS, INFO_TYPE_LABELS } from '@finpulse/shared';
```

- [ ] **Step 2: Create `client/src/api/files.ts`**

```typescript
import type { FileRecord, ListFilesResponse, PatchClassificationBody } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '';

function headers(userId: string): HeadersInit {
  return { 'X-User-ID': userId, 'Content-Type': 'application/json' };
}

export async function uploadFiles(userId: string, files: File[]): Promise<FileRecord[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await fetch(`${BASE}/api/files/upload`, {
    method: 'POST',
    headers: { 'X-User-ID': userId },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listFiles(
  userId: string,
  params: { confirmed?: boolean; infoType?: string } = {}
): Promise<ListFilesResponse> {
  const qs = new URLSearchParams();
  if (params.confirmed !== undefined) qs.set('confirmed', String(params.confirmed));
  if (params.infoType) qs.set('infoType', params.infoType);
  const res = await fetch(`${BASE}/api/files${qs.size ? '?' + qs : ''}`, {
    headers: { 'X-User-ID': userId },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFile(userId: string, id: string): Promise<FileRecord> {
  const res = await fetch(`${BASE}/api/files/${id}`, { headers: { 'X-User-ID': userId } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchClassification(
  userId: string,
  id: string,
  body: PatchClassificationBody
): Promise<FileRecord> {
  const res = await fetch(`${BASE}/api/files/${id}/classification`, {
    method: 'PATCH',
    headers: headers(userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteFile(userId: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/files/${id}`, {
    method: 'DELETE',
    headers: { 'X-User-ID': userId },
  });
  if (!res.ok) throw new Error(await res.text());
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit; cd ..
```

Expected: no errors (may warn about unused imports until components are added).

- [ ] **Step 4: Commit**

```bash
git add client/src/types/index.ts client/src/api/files.ts
git commit -m "feat: add typed frontend API client for all file endpoints"
```

---

## Task 9: ConfidenceBadge Component

**Closes:** #11

**Files:**
- Create: `client/src/components/ConfidenceBadge.tsx`
- Create: `client/src/components/__tests__/ConfidenceBadge.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// client/src/components/__tests__/ConfidenceBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { ConfidenceBadge } from '../ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('shows green badge for confidence >= 0.85', () => {
    render(<ConfidenceBadge confidence={0.95} userConfirmed={false} overridden={false} reason="test" />);
    const badge = screen.getByText(/95%/);
    expect(badge.className).toMatch(/green/);
  });

  it('shows yellow badge for confidence 0.60–0.84', () => {
    render(<ConfidenceBadge confidence={0.72} userConfirmed={false} overridden={false} reason="test" />);
    const badge = screen.getByText(/72%/);
    expect(badge.className).toMatch(/yellow/);
  });

  it('shows red badge with review text for confidence < 0.60', () => {
    render(<ConfidenceBadge confidence={0.41} userConfirmed={false} overridden={false} reason="test" />);
    expect(screen.getByText(/41%.*review/i)).toBeDefined();
    const badge = screen.getByText(/41%/);
    expect(badge.className).toMatch(/red/);
  });

  it('shows Overridden badge when overridden=true', () => {
    render(<ConfidenceBadge confidence={0.5} userConfirmed={true} overridden={true} reason="" />);
    expect(screen.getByText('Overridden')).toBeDefined();
  });

  it('shows Confirmed badge when confirmed=true and not overridden', () => {
    render(<ConfidenceBadge confidence={0.95} userConfirmed={true} overridden={false} reason="" />);
    expect(screen.getByText('Confirmed')).toBeDefined();
  });

  it('truncates reason to 120 chars in title attribute', () => {
    const longReason = 'a'.repeat(200);
    render(<ConfidenceBadge confidence={0.41} userConfirmed={false} overridden={false} reason={longReason} />);
    const badge = screen.getByText(/41%/);
    expect(badge.getAttribute('title')?.length).toBeLessThanOrEqual(123); // 120 + '...'
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npx vitest run src/components/__tests__/ConfidenceBadge.test.tsx 2>&1 | tail -10; cd ..
```

Expected: FAIL — `Cannot find module '../ConfidenceBadge'`

- [ ] **Step 3: Implement `client/src/components/ConfidenceBadge.tsx`**

```tsx
interface Props {
  confidence: number;
  userConfirmed: boolean;
  overridden: boolean;
  reason: string;
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function ConfidenceBadge({ confidence, userConfirmed, overridden, reason }: Props) {
  if (overridden) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
        Overridden
      </span>
    );
  }
  if (userConfirmed) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
        Confirmed ✓
      </span>
    );
  }

  const pct = Math.round(confidence * 100);
  const tooltip = truncate(reason, 120);

  if (confidence >= 0.85) {
    return (
      <span title={tooltip} className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
        {pct}% confident
      </span>
    );
  }
  if (confidence >= 0.60) {
    return (
      <span title={tooltip} className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
        {pct}% confident
      </span>
    );
  }
  return (
    <span title={tooltip} className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
      {pct}% — please review
    </span>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npx vitest run src/components/__tests__/ConfidenceBadge.test.tsx; cd ..
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ConfidenceBadge.tsx client/src/components/__tests__/ConfidenceBadge.test.tsx
git commit -m "feat: add ConfidenceBadge component (green/yellow/red, Confirmed, Overridden states)

Closes #11"
```

---

## Task 10: OverrideForm Component

**Closes:** #10

**Files:**
- Create: `client/src/components/OverrideForm.tsx`
- Create: `client/src/components/__tests__/OverrideForm.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// client/src/components/__tests__/OverrideForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverrideForm } from '../OverrideForm';

const defaultProps = {
  origin: 'bank' as const,
  infoType: 'checking_account' as const,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('OverrideForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders origin and infoType dropdowns pre-filled with current values', () => {
    render(<OverrideForm {...defaultProps} />);
    expect((screen.getByLabelText(/origin/i) as HTMLSelectElement).value).toBe('bank');
    expect((screen.getByLabelText(/info type/i) as HTMLSelectElement).value).toBe('checking_account');
  });

  it('calls onSave with selected values when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<OverrideForm {...defaultProps} />);
    await user.selectOptions(screen.getByLabelText(/origin/i), 'insurance_portal');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(defaultProps.onSave).toHaveBeenCalledWith({
      origin: 'insurance_portal',
      infoType: 'checking_account',
    });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<OverrideForm {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows all 7 origin options with human-readable labels', () => {
    render(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Credit Card — MAX')).toBeDefined();
    expect(screen.getByText('Pension Clearing House')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npx vitest run src/components/__tests__/OverrideForm.test.tsx 2>&1 | tail -5; cd ..
```

Expected: FAIL

- [ ] **Step 3: Implement `client/src/components/OverrideForm.tsx`**

```tsx
import { useState } from 'react';
import type { Origin, InfoType } from '../types';
import { ORIGIN_LABELS, INFO_TYPE_LABELS } from '../types';

interface Props {
  origin: Origin;
  infoType: InfoType;
  onSave: (values: { origin: Origin; infoType: InfoType }) => void;
  onCancel: () => void;
}

export function OverrideForm({ origin, infoType, onSave, onCancel }: Props) {
  const [selectedOrigin, setSelectedOrigin] = useState<Origin>(origin);
  const [selectedInfoType, setSelectedInfoType] = useState<InfoType>(infoType);

  return (
    <div className="flex flex-col gap-3 p-4 border rounded bg-gray-50">
      <div>
        <label htmlFor="override-origin" className="block text-sm font-medium mb-1">Origin</label>
        <select
          id="override-origin"
          aria-label="Origin"
          value={selectedOrigin}
          onChange={(e) => setSelectedOrigin(e.target.value as Origin)}
          className="w-full border rounded px-2 py-1 text-sm"
        >
          {(Object.entries(ORIGIN_LABELS) as [Origin, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="override-infotype" className="block text-sm font-medium mb-1">Info Type</label>
        <select
          id="override-infotype"
          aria-label="Info Type"
          value={selectedInfoType}
          onChange={(e) => setSelectedInfoType(e.target.value as InfoType)}
          className="w-full border rounded px-2 py-1 text-sm"
        >
          {(Object.entries(INFO_TYPE_LABELS) as [InfoType, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1 text-sm border rounded">Cancel</button>
        <button
          onClick={() => onSave({ origin: selectedOrigin, infoType: selectedInfoType })}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npx vitest run src/components/__tests__/OverrideForm.test.tsx; cd ..
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/OverrideForm.tsx client/src/components/__tests__/OverrideForm.test.tsx
git commit -m "feat: add OverrideForm component with origin/infoType dropdowns

Closes #10"
```

---

## Task 11: FileCard Component

**Closes:** #9, #10, #12 (partial — card rendering)

**Files:**
- Create: `client/src/components/FileCard.tsx`
- Create: `client/src/components/__tests__/FileCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// client/src/components/__tests__/FileCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileCard } from '../FileCard';
import type { FileRecord } from '../../types';

const fakeRecord: FileRecord = {
  id: 'abc-123',
  userId: 'user1',
  filename: 'bank-2026-04.pdf',
  gcsPath: 'user1/2026-04/bank.pdf',
  uploadedAt: '2026-04-18T10:00:00.000Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.95,
    reason: 'Looks like a bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

describe('FileCard', () => {
  const onConfirm = jest.fn();
  const onOverride = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders filename, origin label, infoType label, and confidence badge', () => {
    render(<FileCard record={fakeRecord} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    expect(screen.getByText('bank-2026-04.pdf')).toBeDefined();
    expect(screen.getByText('Bank')).toBeDefined();
    expect(screen.getByText('Checking Account')).toBeDefined();
    expect(screen.getByText(/95%/)).toBeDefined();
  });

  it('shows Confirm button when not yet confirmed', () => {
    render(<FileCard record={fakeRecord} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined();
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileCard record={fakeRecord} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith('abc-123');
  });

  it('hides Confirm button when already confirmed', () => {
    const confirmed = { ...fakeRecord, classification: { ...fakeRecord.classification, userConfirmed: true } };
    render(<FileCard record={confirmed} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
  });

  it('shows OverrideForm when Override toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<FileCard record={fakeRecord} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /override/i }));
    expect(screen.getByLabelText(/origin/i)).toBeDefined();
  });

  it('calls onDelete when Delete is confirmed', async () => {
    const user = userEvent.setup();
    // Mock window.confirm
    window.confirm = jest.fn().mockReturnValue(true);
    render(<FileCard record={fakeRecord} onConfirm={onConfirm} onOverride={onOverride} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('abc-123');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npx vitest run src/components/__tests__/FileCard.test.tsx 2>&1 | tail -5; cd ..
```

Expected: FAIL

- [ ] **Step 3: Implement `client/src/components/FileCard.tsx`**

```tsx
import { useState } from 'react';
import type { FileRecord } from '../types';
import { ORIGIN_LABELS, INFO_TYPE_LABELS } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { OverrideForm } from './OverrideForm';
import type { Origin, InfoType } from '../types';

interface Props {
  record: FileRecord;
  onConfirm: (id: string) => void;
  onOverride: (id: string, values: { origin: Origin; infoType: InfoType }) => void;
  onDelete: (id: string) => void;
}

export function FileCard({ record, onConfirm, onOverride, onDelete }: Props) {
  const [showOverride, setShowOverride] = useState(false);
  const { id, filename, uploadedAt, classification: c } = record;

  function handleDelete() {
    if (window.confirm(`Delete ${filename}? This cannot be undone.`)) {
      onDelete(id);
    }
  }

  return (
    <div className="border rounded p-4 flex flex-col gap-2 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{filename}</p>
          <p className="text-xs text-gray-500">{new Date(uploadedAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={handleDelete}
          aria-label="Delete"
          className="text-gray-400 hover:text-red-500 text-xs px-1"
          title="Delete file"
        >
          🗑
        </button>
      </div>

      <div className="flex gap-2 text-xs text-gray-700">
        <span className="bg-gray-100 rounded px-1.5 py-0.5">{ORIGIN_LABELS[c.origin]}</span>
        <span className="bg-gray-100 rounded px-1.5 py-0.5">{INFO_TYPE_LABELS[c.infoType]}</span>
      </div>

      <ConfidenceBadge
        confidence={c.confidence}
        userConfirmed={c.userConfirmed}
        overridden={c.overridden}
        reason={c.reason}
      />

      {showOverride && (
        <OverrideForm
          origin={c.origin}
          infoType={c.infoType}
          onSave={(values) => { onOverride(id, values); setShowOverride(false); }}
          onCancel={() => setShowOverride(false)}
        />
      )}

      {!showOverride && (
        <div className="flex gap-2">
          {!c.userConfirmed && (
            <button
              onClick={() => onConfirm(id)}
              className="text-xs px-3 py-1 bg-green-600 text-white rounded"
            >
              Confirm
            </button>
          )}
          <button
            onClick={() => setShowOverride(true)}
            className="text-xs px-3 py-1 border rounded"
          >
            Override
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npx vitest run src/components/__tests__/FileCard.test.tsx; cd ..
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/FileCard.tsx client/src/components/__tests__/FileCard.test.tsx
git commit -m "feat: add FileCard component with confirm, override toggle, and delete

Closes #9"
```

---

## Task 12: UploadZone Component

**Closes:** #5 (frontend upload UI)

**Files:**
- Create: `client/src/components/UploadZone.tsx`
- Create: `client/src/components/__tests__/UploadZone.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// client/src/components/__tests__/UploadZone.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadZone } from '../UploadZone';

describe('UploadZone', () => {
  it('renders accepted file types hint', () => {
    render(<UploadZone onUpload={jest.fn()} uploading={false} />);
    expect(screen.getByText(/pdf.*xlsx.*csv.*png.*md/i)).toBeDefined();
  });

  it('calls onUpload with selected files', async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<UploadZone onUpload={onUpload} uploading={false} />);
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('shows spinner text when uploading=true', () => {
    render(<UploadZone onUpload={jest.fn()} uploading={true} />);
    expect(screen.getByText(/uploading/i)).toBeDefined();
  });

  it('disables the input while uploading', () => {
    render(<UploadZone onUpload={jest.fn()} uploading={true} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npx vitest run src/components/__tests__/UploadZone.test.tsx 2>&1 | tail -5; cd ..
```

Expected: FAIL

- [ ] **Step 3: Implement `client/src/components/UploadZone.tsx`**

```tsx
interface Props {
  onUpload: (files: File[]) => void;
  uploading: boolean;
}

export function UploadZone({ onUpload, uploading }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUpload(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUpload(files);
  }

  return (
    <label
      className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-gray-50"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        type="file"
        multiple
        accept=".pdf,.xlsx,.csv,.png,.md"
        disabled={uploading}
        onChange={handleChange}
        className="sr-only"
      />
      {uploading ? (
        <span className="text-sm text-gray-500">Uploading…</span>
      ) : (
        <>
          <span className="text-sm font-medium">Drop files here or click to browse</span>
          <span className="text-xs text-gray-400 mt-1">Accepted: pdf, xlsx, csv, png, md</span>
        </>
      )}
    </label>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npx vitest run src/components/__tests__/UploadZone.test.tsx; cd ..
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/UploadZone.tsx client/src/components/__tests__/UploadZone.test.tsx
git commit -m "feat: add UploadZone component with drag-and-drop and file browse

Closes #5"
```

---

## Task 13: FileManager Page

**Closes:** #12, #13, #14, #15

**Files:**
- Create: `client/src/pages/FileManager.tsx`
- Create: `client/src/pages/__tests__/FileManager.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// client/src/pages/__tests__/FileManager.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FileManager } from '../FileManager';
import * as api from '../../api/files';
import type { FileRecord } from '../../types';

jest.mock('../../api/files');
const mockApi = api as jest.Mocked<typeof api>;

const fakeRecord: FileRecord = {
  id: 'abc-123',
  userId: 'user1',
  filename: 'bank.pdf',
  gcsPath: 'user1/2026-04/bank.pdf',
  uploadedAt: '2026-04-18T10:00:00.000Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.95,
    reason: 'Bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

function renderPage(userId = 'user1', search = '') {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <FileManager userId={userId} />
    </MemoryRouter>
  );
}

describe('FileManager', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading state while fetching', () => {
    mockApi.listFiles.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('shows empty state when no files', async () => {
    mockApi.listFiles.mockResolvedValue({ files: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no files/i)).toBeDefined());
  });

  it('renders a FileCard for each file', async () => {
    mockApi.listFiles.mockResolvedValue({ files: [fakeRecord], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('bank.pdf')).toBeDefined());
  });

  it('shows error state and retry button on API failure', async () => {
    mockApi.listFiles.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/error/i)).toBeDefined());
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('refetches on retry click', async () => {
    const user = userEvent.setup();
    mockApi.listFiles.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({ files: [], total: 0 });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no files/i)).toBeDefined());
  });

  it('calls patchClassification on confirm', async () => {
    const user = userEvent.setup();
    mockApi.listFiles.mockResolvedValue({ files: [fakeRecord], total: 1 });
    mockApi.patchClassification.mockResolvedValue({
      ...fakeRecord,
      classification: { ...fakeRecord.classification, userConfirmed: true },
    });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(mockApi.patchClassification).toHaveBeenCalledWith('user1', 'abc-123', { confirmed: true });
  });

  it('calls deleteFile and removes card on delete', async () => {
    const user = userEvent.setup();
    window.confirm = jest.fn().mockReturnValue(true);
    mockApi.listFiles.mockResolvedValue({ files: [fakeRecord], total: 1 });
    mockApi.deleteFile.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockApi.deleteFile).toHaveBeenCalledWith('user1', 'abc-123');
    await waitFor(() => expect(screen.queryByText('bank.pdf')).toBeNull());
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npx vitest run src/pages/__tests__/FileManager.test.tsx 2>&1 | tail -5; cd ..
```

Expected: FAIL

- [ ] **Step 3: Implement `client/src/pages/FileManager.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FileRecord, Origin, InfoType } from '../types';
import { INFO_TYPE_LABELS } from '../types';
import { listFiles, patchClassification, deleteFile, uploadFiles } from '../api/files';
import { FileCard } from '../components/FileCard';
import { UploadZone } from '../components/UploadZone';

interface Props { userId: string; }

type FilterStatus = 'all' | 'pending' | 'confirmed';

export function FileManager({ userId }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const filterStatus = (searchParams.get('filter') ?? 'all') as FilterStatus;
  const filterInfoType = searchParams.get('infoType') ?? '';

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { confirmed?: boolean; infoType?: string } = {};
      if (filterStatus === 'pending') params.confirmed = false;
      if (filterStatus === 'confirmed') params.confirmed = true;
      if (filterInfoType) params.infoType = filterInfoType;
      const data = await listFiles(userId, params);
      setFiles(data.files);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, filterStatus, filterInfoType]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleUpload(selected: File[]) {
    setUploading(true);
    try {
      const newRecords = await uploadFiles(userId, selected);
      setFiles((prev) => [...newRecords, ...prev]);
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm(id: string) {
    const updated = await patchClassification(userId, id, { confirmed: true });
    setFiles((prev) => prev.map((f) => f.id === id ? updated : f));
  }

  async function handleOverride(id: string, values: { origin: Origin; infoType: InfoType }) {
    const updated = await patchClassification(userId, id, { override: values });
    setFiles((prev) => prev.map((f) => f.id === id ? updated : f));
  }

  async function handleDelete(id: string) {
    await deleteFile(userId, id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setFilter(status: FilterStatus) {
    setSearchParams((p) => { p.set('filter', status); return p; });
  }
  function setInfoTypeFilter(val: string) {
    setSearchParams((p) => { if (val) p.set('infoType', val); else p.delete('infoType'); return p; });
  }

  const pendingCount = files.filter((f) => !f.classification.userConfirmed).length;
  const confirmedCount = files.filter((f) => f.classification.userConfirmed).length;
  const availableInfoTypes = [...new Set(files.map((f) => f.classification.infoType))];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">FinPulse — File Manager</h1>

      <UploadZone onUpload={handleUpload} uploading={uploading} />

      <div className="flex gap-2 items-center flex-wrap">
        {(['all', 'pending', 'confirmed'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1 rounded border ${filterStatus === s ? 'bg-blue-600 text-white' : ''}`}
          >
            {s === 'all' ? `All (${files.length})` : s === 'pending' ? `Pending review (${pendingCount})` : `Confirmed (${confirmedCount})`}
          </button>
        ))}

        <select
          value={filterInfoType}
          onChange={(e) => setInfoTypeFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 ml-auto"
          aria-label="Filter by info type"
        >
          <option value="">All types</option>
          {availableInfoTypes.map((t) => (
            <option key={t} value={t}>{INFO_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {filterInfoType && (
        <div className="text-sm">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {INFO_TYPE_LABELS[filterInfoType as InfoType]}
            <button onClick={() => setInfoTypeFilter('')} className="ml-1 font-bold">×</button>
          </span>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <div className="text-red-600 text-sm space-y-1">
          <p>Error loading files: {error}</p>
          <button onClick={fetchFiles} className="underline">Retry</button>
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">No files uploaded yet. Drop some files above to get started.</p>
      )}

      <div className="space-y-3">
        {files.map((f) => (
          <FileCard
            key={f.id}
            record={f}
            onConfirm={handleConfirm}
            onOverride={handleOverride}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npx vitest run src/pages/__tests__/FileManager.test.tsx; cd ..
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/FileManager.tsx client/src/pages/__tests__/FileManager.test.tsx
git commit -m "feat: add FileManager page (upload, list, filter by status/infoType, confirm, override, delete)

Closes #12 #13 #14 #15"
```

---

## Task 14: App Entry Point + Routing

**Files:**
- Create: `client/src/App.tsx`
- Create: `client/src/main.tsx`

- [ ] **Step 1: Create `client/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { FileManager } from './pages/FileManager';

/*
 * Phase 1: userId is stored in localStorage as a plain string.
 * Phase 2 (auth): replace this with userId from a JWT token/session.
 */
function getUserId(): string {
  let id = localStorage.getItem('finpulse_user_id');
  if (!id) {
    id = `user_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('finpulse_user_id', id);
  }
  return id;
}

export function App() {
  const userId = getUserId();
  return (
    <Routes>
      <Route path="/" element={<FileManager userId={userId} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Create `client/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit; cd ..
```

Expected: no errors.

- [ ] **Step 4: Smoke-test frontend (requires dev server)**

```bash
cd server && GCS_BUCKET=finpulse-data ANTHROPIC_API_KEY=sk-test npx ts-node src/index.ts &
cd client && npx vite &
sleep 3
echo "Open http://localhost:5173 to verify the app loads"
# Kill background processes when done
kill %1 %2 2>/dev/null
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/main.tsx
git commit -m "feat: add React app entry point and routing (FileManager at /)"
```

---

## Task 15: Docker + CI/CD

**Closes:** #3 (GCS setup docs), #4

**Files:**
- Create: `docker/server.Dockerfile`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `docker/server.Dockerfile`** (multi-stage)

```dockerfile
# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=shared --workspace=server

COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build -w server

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=shared --workspace=server --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared ./shared

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
```

- [ ] **Step 2: Verify Docker image builds**

```bash
docker build -f docker/server.Dockerfile -t finpulse-server:local . 2>&1 | tail -5
```

Expected: `Successfully built <id>` or `Successfully tagged finpulse-server:local`

- [ ] **Step 3: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  GCP_REGION: europe-west1
  ARTIFACT_REPO: finpulse
  CLOUD_RUN_SERVICE: finpulse-api
  DATA_BUCKET: finpulse-data
  STATIC_BUCKET: finpulse-static

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet
      - name: Build and push Docker image
        run: |
          IMAGE=${{ env.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/${{ env.ARTIFACT_REPO }}/server:${{ github.sha }}
          docker build -f docker/server.Dockerfile -t $IMAGE .
          docker push $IMAGE
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.CLOUD_RUN_SERVICE }} \
            --image $IMAGE \
            --region ${{ env.GCP_REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --min-instances 0 \
            --max-instances 10 \
            --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest,GCS_KEY_JSON=gcs-key-json:latest" \
            --set-env-vars "GCS_BUCKET=${{ env.DATA_BUCKET }}"

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: npm ci
      - name: Build frontend
        run: npm run build -w client
        env:
          VITE_API_URL: ${{ secrets.CLOUD_RUN_URL }}
      - name: Upload to GCS and invalidate CDN
        run: |
          gsutil -m rsync -r -d client/dist gs://${{ env.STATIC_BUCKET }}
          gcloud compute url-maps invalidate-cdn-cache finpulse-lb \
            --path "/*" \
            --global \
            --async
```

- [ ] **Step 4: Add GCP setup instructions as a comment block at the top of `deploy.yml`**

Add above the `name:` line:

```yaml
# GCP Setup (one-time, before first deploy):
#
# 1. Create GCS buckets:
#    gsutil mb -l europe-west1 gs://finpulse-data
#    gsutil mb -l europe-west1 gs://finpulse-static
#    gsutil uniformbucketlevelaccess set on gs://finpulse-data
#
# 2. Create service account:
#    gcloud iam service-accounts create finpulse-api \
#      --display-name "FinPulse API"
#    gcloud storage buckets add-iam-policy-binding gs://finpulse-data \
#      --member="serviceAccount:finpulse-api@PROJECT.iam.gserviceaccount.com" \
#      --role="roles/storage.objectAdmin"
#
# 3. Store secrets in Secret Manager:
#    gcloud secrets create anthropic-api-key --data-file=- <<< "YOUR_KEY"
#    gcloud secrets create gcs-key-json --data-file=service-account.json
#
# 4. Set GitHub Actions secrets:
#    GCP_PROJECT_ID, GCP_WIF_PROVIDER, GCP_SERVICE_ACCOUNT, CLOUD_RUN_URL
#
# 5. Create Artifact Registry repo:
#    gcloud artifacts repositories create finpulse \
#      --repository-format=docker --location=europe-west1
```

- [ ] **Step 5: Commit**

```bash
git add docker/server.Dockerfile .github/workflows/deploy.yml
git commit -m "feat: add Docker multi-stage build and GitHub Actions CI/CD (parallel deploy to Cloud Run + CDN)

Closes #4"
```

- [ ] **Step 6: Run full test suite one final time**

```bash
npm test
```

Expected: All tests pass across server and client workspaces.

---

## Done

At this point Phase 1 is fully implemented and all 15 GitHub issues are closed:

| Issue | Feature | Status |
|---|---|---|
| #2 | Monorepo scaffold | Task 1 |
| #3 | GCS bucket setup | Task 3 + Task 15 |
| #4 | CI/CD pipeline | Task 15 |
| #5 | Upload UI | Task 12 + UploadZone |
| #6 | Server upload + validation | Task 6 |
| #7 | Classification display | Task 4 + Task 11 |
| #8 | Classifier service | Task 4 |
| #9 | Confirm classification | Task 11 + Task 13 |
| #10 | Override classification | Task 10 + Task 13 |
| #11 | Confidence badge | Task 9 |
| #12 | File list | Task 13 |
| #13 | Filter by status | Task 13 |
| #14 | Filter by infoType | Task 13 |
| #15 | Delete file | Task 11 + Task 13 |
| #16 | Multi-user scoping | Task 5 + Task 6 |
