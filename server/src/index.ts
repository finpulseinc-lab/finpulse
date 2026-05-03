import express from 'express';
import cors from 'cors';
import path from 'path';
import { filesRouter } from './routes/files';

const app = express();

// In production the frontend is served from the same origin, so CORS is only
// needed in local dev (Vite on :5173, server on :3001).
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    allowedHeaders: ['Content-Type', 'X-User-ID'],
  }));
}
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/files', filesRouter);

// Serve the React build in production (client/dist is copied into the image).
// Must come after API routes so /api/* is never caught by the static handler.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — any unmatched GET returns index.html so client-side routing works.
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => console.log(`FinPulse API listening on :${PORT}`));

export { app };
