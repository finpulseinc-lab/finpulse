import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireUserId } from '../middleware/userId';
import { StorageService } from '../services/storage';
import { classify, mimeToFileType } from '../services/classifier';
import type { FileRecord, InfoType } from '@finpulse/shared';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'text/markdown',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Disallowed file type: ${file.mimetype}`));
    }
  },
});

function makeStorage(): StorageService {
  return new StorageService(
    process.env.GCS_BUCKET ?? 'finpulse-data',
    process.env.GCS_KEY_JSON
  );
}

export const filesRouter = Router();
filesRouter.use(requireUserId);

filesRouter.post('/upload', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File exceeds 20 MB limit' });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  const storage = makeStorage();
  const userId = res.locals.userId as string;
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const records: FileRecord[] = await Promise.all(files.map(async (file) => {
    const gcsPath = await storage.uploadFile(userId, month, file.originalname, file.buffer, file.mimetype);
    const sample = await storage.getContentSample(gcsPath, file.mimetype);
    const classification = await classify(file.originalname, sample, file.mimetype);
    classification.fileType = mimeToFileType(file.mimetype);

    const record: FileRecord = {
      id: uuidv4(),
      userId,
      filename: file.originalname,
      gcsPath,
      uploadedAt: now.toISOString(),
      month,
      classification,
    };
    await storage.saveMetadata(record);
    return record;
  }));

  res.status(201).json(records);
});

filesRouter.get('/', async (req, res) => {
  const storage = makeStorage();
  const userId = res.locals.userId as string;
  let files = await storage.listMetadata(userId);

  if (req.query.confirmed !== undefined) {
    const wantConfirmed = req.query.confirmed === 'true';
    files = files.filter((f) => f.classification.userConfirmed === wantConfirmed);
  }

  if (req.query.infoType) {
    files = files.filter((f) => f.classification.infoType === (req.query.infoType as InfoType));
  }

  files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  res.json({ files, total: files.length });
});

filesRouter.get('/:id', async (req, res) => {
  const storage = makeStorage();
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; } // defense-in-depth: listMetadata already scopes by userId prefix
  res.json(file);
});

filesRouter.patch('/:id/classification', async (req, res) => {
  const storage = makeStorage();
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; } // defense-in-depth: listMetadata already scopes by userId prefix

  const body = req.body as { confirmed?: true; override?: { origin?: string; infoType?: string } };

  if (body.confirmed === true) {
    file.classification.userConfirmed = true;
  } else if (body.override) {
    if (!body.override.origin && !body.override.infoType) {
      res.status(400).json({ error: 'override must include at least one of: origin, infoType' });
      return;
    }
    if (body.override.origin) file.classification.origin = body.override.origin as typeof file.classification.origin;
    if (body.override.infoType) file.classification.infoType = body.override.infoType as typeof file.classification.infoType;
    file.classification.userConfirmed = true;
    file.classification.overridden = true;
  } else {
    res.status(400).json({ error: 'Body must be { confirmed: true } or { override: { origin?, infoType? } }' });
    return;
  }

  await storage.saveMetadata(file);
  res.json(file);
});

filesRouter.delete('/:id', async (req, res) => {
  const storage = makeStorage();
  const userId = res.locals.userId as string;
  const files = await storage.listMetadata(userId);
  const file = files.find((f) => f.id === req.params.id);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; } // defense-in-depth: listMetadata already scopes by userId prefix
  await storage.deleteFile(file.gcsPath);
  res.status(204).send();
});
