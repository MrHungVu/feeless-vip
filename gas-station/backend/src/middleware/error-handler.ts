import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
