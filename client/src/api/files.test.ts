import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listFiles, getFile, uploadFiles, patchClassification, deleteFile } from './files';
import type { FileRecord, ListFilesResponse } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const userId = 'user-123';
const fileId = 'file-456';

const mockFile: FileRecord = {
  id: fileId,
  userId,
  filename: 'statement.pdf',
  gcsPath: 'user-123/2026-04/statement.pdf',
  uploadedAt: '2026-04-01T00:00:00Z',
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

function makeResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => mockFetch.mockReset());

describe('listFiles', () => {
  it('fetches GET /api/files with X-User-ID header', async () => {
    const response: ListFilesResponse = { files: [mockFile], total: 1 };
    mockFetch.mockResolvedValue(makeResponse(response));

    const result = await listFiles(userId);

    expect(mockFetch).toHaveBeenCalledWith('/api/files', {
      headers: { 'X-User-ID': userId },
    });
    expect(result).toEqual(response);
  });

  it('appends confirmed=false query param', async () => {
    mockFetch.mockResolvedValue(makeResponse({ files: [], total: 0 }));

    await listFiles(userId, { confirmed: false });

    expect(mockFetch).toHaveBeenCalledWith('/api/files?confirmed=false', {
      headers: { 'X-User-ID': userId },
    });
  });

  it('appends infoType query param', async () => {
    mockFetch.mockResolvedValue(makeResponse({ files: [], total: 0 }));

    await listFiles(userId, { infoType: 'pension' });

    expect(mockFetch).toHaveBeenCalledWith('/api/files?infoType=pension', {
      headers: { 'X-User-ID': userId },
    });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Forbidden' }, false, 403));

    await expect(listFiles(userId)).rejects.toThrow('403');
  });
});

describe('getFile', () => {
  it('fetches GET /api/files/:id with X-User-ID header', async () => {
    mockFetch.mockResolvedValue(makeResponse(mockFile));

    const result = await getFile(userId, fileId);

    expect(mockFetch).toHaveBeenCalledWith(`/api/files/${fileId}`, {
      headers: { 'X-User-ID': userId },
    });
    expect(result).toEqual(mockFile);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Not found' }, false, 404));

    await expect(getFile(userId, fileId)).rejects.toThrow('404');
  });
});

describe('uploadFiles', () => {
  it('POSTs FormData to /api/files/upload with X-User-ID header', async () => {
    mockFetch.mockResolvedValue(makeResponse([mockFile]));
    const formData = new FormData();

    const result = await uploadFiles(userId, formData);

    expect(mockFetch).toHaveBeenCalledWith('/api/files/upload', {
      method: 'POST',
      headers: { 'X-User-ID': userId },
      body: formData,
    });
    expect(result).toEqual([mockFile]);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Bad request' }, false, 400));

    await expect(uploadFiles(userId, new FormData())).rejects.toThrow('400');
  });
});

describe('patchClassification', () => {
  it('PATCHes /api/files/:id/classification with confirm body', async () => {
    mockFetch.mockResolvedValue(makeResponse(mockFile));

    const result = await patchClassification(userId, fileId, { confirmed: true });

    expect(mockFetch).toHaveBeenCalledWith(`/api/files/${fileId}/classification`, {
      method: 'PATCH',
      headers: { 'X-User-ID': userId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    expect(result).toEqual(mockFile);
  });

  it('PATCHes with override body', async () => {
    mockFetch.mockResolvedValue(makeResponse(mockFile));

    await patchClassification(userId, fileId, { override: { origin: 'bank' } });

    expect(mockFetch).toHaveBeenCalledWith(`/api/files/${fileId}/classification`, {
      method: 'PATCH',
      headers: { 'X-User-ID': userId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ override: { origin: 'bank' } }),
    });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Unprocessable' }, false, 422));

    await expect(patchClassification(userId, fileId, { confirmed: true })).rejects.toThrow('422');
  });
});

describe('deleteFile', () => {
  it('sends DELETE /api/files/:id with X-User-ID header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await deleteFile(userId, fileId);

    expect(mockFetch).toHaveBeenCalledWith(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': userId },
    });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Not found' }, false, 404));

    await expect(deleteFile(userId, fileId)).rejects.toThrow('404');
  });
});
