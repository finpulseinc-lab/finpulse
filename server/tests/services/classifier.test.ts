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
