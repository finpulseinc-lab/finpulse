import Anthropic from '@anthropic-ai/sdk';
import type { ClassificationResult, Origin, InfoType, FileType } from '@finpulse/shared';
import { ORIGIN_LABELS, INFO_TYPE_LABELS } from '@finpulse/shared';

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

// Runtime validators derived from shared label maps — exhaustive by construction
const VALID_ORIGINS = new Set<string>(Object.keys(ORIGIN_LABELS));
const VALID_INFO_TYPES = new Set<string>(Object.keys(INFO_TYPE_LABELS));

function parseOrigin(v: unknown): Origin {
  return typeof v === 'string' && VALID_ORIGINS.has(v) ? (v as Origin) : 'manual';
}

function parseInfoType(v: unknown): InfoType {
  return typeof v === 'string' && VALID_INFO_TYPES.has(v) ? (v as InfoType) : 'investment';
}

// System prompt carries instructions; user turn carries untrusted data only.
// This structure reduces prompt-injection risk when content samples come from user-uploaded files.
const SYSTEM_PROMPT = `You are a financial file classifier.
Given a filename and optional content sample, return ONLY a raw JSON object.
Do not include markdown fences, explanations, or any text before or after the JSON.

Required JSON format:
{"origin":"bank","infoType":"checking_account","confidence":0.92,"reason":"one sentence"}

origin must be exactly one of: bank, credit_card_max, credit_card_cal, insurance_portal, pension_clearing, investment_portal, manual
infoType must be exactly one of: checking_account, credit_card_transactions, pension, insurance, education_fund, investment, property
confidence must be a float between 0.0 and 1.0
reason must be a single sentence in English`;

// Module-level singleton — preserves HTTP connection pool across requests
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK_FIELDS = {
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
  const userContent = contentSample
    ? `Filename: ${filename}\nContent sample:\n${contentSample}`
    : `Filename: ${filename}`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const textBlock = msg.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      origin: parseOrigin(parsed.origin),
      fileType,
      infoType: parseInfoType(parsed.infoType),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason : FALLBACK_FIELDS.reason,
      aiSuggested: true,
      userConfirmed: false,
      overridden: false,
    };
  } catch (err) {
    console.error('classify() failed for "%s": %s', filename, err);
    return { ...FALLBACK_FIELDS, fileType };
  }
}
