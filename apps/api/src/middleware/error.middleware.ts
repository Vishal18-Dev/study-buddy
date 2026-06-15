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
  
  // Always log error to console for server logs (Render/etc.)
  console.error('[ERROR HANDLER]', err.stack || err.message || err);

  const message =
    statusCode === 500
      ? `An internal server error occurred: ${err.message || String(err)}`
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    debugStack: err.stack,
  });
}

// Helper to create typed errors with status codes
export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
