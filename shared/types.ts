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
  /** Must be in [0, 1]. Validated at API ingress — never trust raw value from Claude response. */
  confidence: number;
  reason: string;       // shown to user; "Classification failed" on error
  aiSuggested: boolean;
  userConfirmed: boolean;
  overridden: boolean;
}

export interface FileRecord {
  id: string;           // UUID
  userId: string;       // from X-User-ID header — auth-ready, no login yet
  filename: string;
  gcsPath: string;      // bucket-relative path, e.g. "user123/2026-04/statement.pdf" (no gs:// prefix)
  uploadedAt: string;   // ISO 8601
  month: string;        // YYYY-MM — denormalized from uploadedAt for GCS path lookups; must equal uploadedAt.slice(0, 7)
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

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  pdf: 'PDF',
  xlsx: 'Excel',
  csv: 'CSV',
  png: 'PNG Image',
  md: 'Markdown',
};

/**
 * PATCH /api/files/:id/classification request body.
 * Confirming is one-way: { confirmed: true } marks the file as reviewed.
 * { confirmed: false } is intentionally not supported — once confirmed, use override.
 * Server must reject { override: {} } (empty override is a no-op and likely a client bug).
 */
export type PatchClassificationBody =
  | { confirmed: true }
  | { override: { origin?: Origin; infoType?: InfoType } };

// GET /api/files response
export interface ListFilesResponse {
  files: FileRecord[];
  total: number;
}
