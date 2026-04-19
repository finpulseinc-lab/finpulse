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
