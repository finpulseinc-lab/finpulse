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
