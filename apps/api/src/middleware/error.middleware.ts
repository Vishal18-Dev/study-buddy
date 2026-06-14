import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500
      ? 'An internal server error occurred. Please try again.'
      : err.message;

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

// Helper to create typed errors with status codes
export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
