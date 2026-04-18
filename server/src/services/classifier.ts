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
    const textBlock = msg.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
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
