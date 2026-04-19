import { Request, Response, NextFunction } from 'express';

/*
 * Phase 1: reads X-User-ID as an unverified client string.
 * Phase 2 (auth): replace this middleware to extract userId from a verified JWT claim.
 * All downstream code uses res.locals.userId — no changes needed outside this file.
 */
export function requireUserId(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers['x-user-id'];
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId || userId.trim() === '') {
    res.status(400).json({ error: 'X-User-ID header is required' });
    return;
  }
  res.locals.userId = userId;
  next();
}
