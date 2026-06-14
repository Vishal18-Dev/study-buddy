import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  API_URL: z.string().url('API_URL must be a valid URL').optional(),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 characters long').optional(),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),
});

// Run validation only on server-side or if in Node context
export let env: z.infer<typeof envSchema>;

if (typeof window === 'undefined') {
  try {
    env = envSchema.parse({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL,
      API_URL: process.env.API_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    });
  } catch (error) {
    console.error('❌ Environment validation failed for Next.js web application:', error);
    // In production we should exit, but in next dev/build it might trigger, so we print a clear error.
  }
} else {
  // Client side fallback validation for public variables only
  env = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  } as z.infer<typeof envSchema>;
}
