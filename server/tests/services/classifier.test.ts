jest.mock('@anthropic-ai/sdk');

import Anthropic from '@anthropic-ai/sdk';
import { classify, mimeToFileType } from '../../src/services/classifier';

// The classifier uses a module-level Anthropic singleton (created at import time).
// We reach the singleton's messages.create via the prototype so the already-created
// instance is affected by each test's mock setup.
const mockCreate = jest.fn();

beforeAll(() => {
  // Attach messages.create to the prototype so the singleton (and any future instances)
  // pick it up. The auto-mock replaced the class; we inject our stub here.
  (Anthropic.prototype as any).messages = { create: mockCreate };
});

function mockAnthropicResponse(text: string) {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text }],
  });
}

describe('mimeToFileType()', () => {
  it('maps known MIME types to FileType', () => {
    expect(mimeToFileType('application/pdf')).toBe('pdf');
    expect(mimeToFileType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
    expect(mimeToFileType('text/csv')).toBe('csv');
    expect(mimeToFileType('image/png')).toBe('png');
    expect(mimeToFileType('text/markdown')).toBe('md');
  });

  it('falls back to "pdf" for unknown MIME types', () => {
    expect(mimeToFileType('application/octet-stream')).toBe('pdf');
    expect(mimeToFileType('')).toBe('pdf');
  });
});

describe('classify()', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns a valid ClassificationResult on success', async () => {
    mockAnthropicResponse(JSON.stringify({
      origin: 'bank',
      infoType: 'checking_account',
      confidence: 0.95,
      reason: 'Filename contains bank and transaction keywords',
    }));
    const result = await classify('bank-statement-2026-04.pdf', 'Account No. 123456 Balance: ...', 'application/pdf');
    expect(result.origin).toBe('bank');
    expect(result.infoType).toBe('checking_account');
    expect(result.confidence).toBe(0.95);
    expect(result.fileType).toBe('pdf');
    expect(result.aiSuggested).toBe(true);
    expect(result.userConfirmed).toBe(false);
    expect(result.overridden).toBe(false);
  });

  it('returns confidence 0 and reason "Classification failed" on API error — never throws', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));
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

  it('sanitises unrecognised origin and infoType values from Claude', async () => {
    mockAnthropicResponse(JSON.stringify({
      origin: 'savings_account',
      infoType: 'unknown_type',
      confidence: 0.5,
      reason: 'Hallucinated values',
    }));
    const result = await classify('file.pdf', '');
    expect(result.origin).toBe('manual');
    expect(result.infoType).toBe('investment');
  });
});
