import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    userId?: string;
    preference?: string;
    role?: string;
  }
}
