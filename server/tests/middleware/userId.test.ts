import { Request, Response, NextFunction } from 'express';
import { requireUserId } from '../../src/middleware/userId';

function makeReq(headers: Record<string, string>) {
  return { headers } as unknown as Request;
}

function makeRes() {
  const res = { locals: {}, status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

describe('requireUserId middleware', () => {
  it('sets res.locals.userId and calls next() when header is present', () => {
    const req = makeReq({ 'x-user-id': 'alice' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect(res.locals.userId).toBe('alice');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when X-User-ID header is missing', () => {
    const req = makeReq({});
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({ error: 'X-User-ID header is required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when X-User-ID header is empty string', () => {
    const req = makeReq({ 'x-user-id': '' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requireUserId(req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
