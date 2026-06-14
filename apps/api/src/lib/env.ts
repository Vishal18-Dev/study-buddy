import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  GEMINI_API_KEY: z.string().optional().default('your-gemini-api-key-here'),
  PORT: z.string().optional().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);

if (env.GEMINI_API_KEY === 'your-gemini-api-key-here' || !env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set or using the default placeholder. AI services will operate in mock-only fallback mode.');
}
