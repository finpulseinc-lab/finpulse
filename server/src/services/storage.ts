import { Storage, Bucket } from '@google-cloud/storage';
import type { FileRecord } from '@finpulse/shared';

export class StorageService {
  private bucket: Bucket;

  constructor(bucketName: string, keyJson?: string) {
    // SECURITY: never include keyJson value in error messages — it contains credentials
    let opts: ConstructorParameters<typeof Storage>[0] = {};
    if (keyJson) {
      try {
        opts = { credentials: JSON.parse(keyJson) as object };
      } catch {
        throw new Error(
          'StorageService: GCS_KEY_JSON is not valid JSON. ' +
          'Check the Cloud Run secret or local .env value.'
        );
      }
    }
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
    try {
      await this.bucket.file(gcsPath).save(buffer, {
        metadata: { contentType },
        resumable: false,
      });
    } catch (err) {
      throw new Error(`StorageService.uploadFile failed for "${gcsPath}": ${err}`);
    }
    return gcsPath;
  }

  /**
   * Returns a UTF-8 text sample from the file.
   * For binary files (PDF, XLSX, PNG), callers should pass the contentType
   * so a safe placeholder is returned instead of corrupted UTF-8 output.
   */
  async getContentSample(gcsPath: string, contentType?: string): Promise<string> {
    const BINARY_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
    ];
    if (contentType && BINARY_TYPES.includes(contentType)) {
      return '[binary content — classify by filename only]';
    }
    const [buffer] = await this.bucket.file(gcsPath).download();
    return buffer.toString('utf8').slice(0, 500);
  }

  async saveMetadata(record: FileRecord): Promise<void> {
    const metaPath = `${record.gcsPath}.meta.json`;
    try {
      await this.bucket.file(metaPath).save(Buffer.from(JSON.stringify(record)), {
        metadata: { contentType: 'application/json' },
        resumable: false,
      });
    } catch (err) {
      throw new Error(`StorageService.saveMetadata failed for "${metaPath}": ${err}`);
    }
  }

  async getMetadata(gcsPath: string): Promise<FileRecord> {
    const metaPath = `${gcsPath}.meta.json`;
    try {
      const [buffer] = await this.bucket.file(metaPath).download();
      return JSON.parse(buffer.toString('utf8')) as FileRecord;
    } catch (err) {
      throw new Error(`StorageService.getMetadata failed for "${metaPath}": ${err}`);
    }
  }

  async listMetadata(userId: string, month?: string): Promise<FileRecord[]> {
    const prefix = month ? `${userId}/${month}/` : `${userId}/`;
    const [files] = await this.bucket.getFiles({ prefix, matchGlob: '**/*.meta.json' });
    const results = await Promise.allSettled(
      files.map(async (f) => {
        const [buf] = await f.download();
        return JSON.parse(buf.toString('utf8')) as FileRecord;
      })
    );
    const records: FileRecord[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        records.push(result.value);
      } else {
        console.error('StorageService.listMetadata: failed to parse sidecar', result.reason);
      }
    }
    return records;
  }

  async deleteFile(gcsPath: string): Promise<void> {
    try {
      await Promise.all([
        this.bucket.file(gcsPath).delete(),
        this.bucket.file(`${gcsPath}.meta.json`).delete(),
      ]);
    } catch (err) {
      throw new Error(`StorageService.deleteFile failed for "${gcsPath}": ${err}`);
    }
  }
}
