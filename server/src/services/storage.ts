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
