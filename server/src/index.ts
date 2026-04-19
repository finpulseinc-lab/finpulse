import express from 'express';
import cors from 'cors';
import { filesRouter } from './routes/files';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  allowedHeaders: ['Content-Type', 'X-User-ID'],
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/files', filesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => console.log(`FinPulse API listening on :${PORT}`));

export { app };
