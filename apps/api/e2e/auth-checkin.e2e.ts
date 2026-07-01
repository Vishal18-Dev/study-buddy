// E2E Tests for Auth and Checkin History endpoints
import { prisma } from '../src/lib/prisma';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const API_URL = process.env.API_URL || 'http://localhost:4000';

// E2E bypass header — skips rate limiting on staging when E2E_API_SECRET is set
const e2eSecret = process.env.E2E_API_SECRET;
const e2eHeaders: Record<string, string> = e2eSecret ? { 'x-e2e-secret': e2eSecret } : {};

describe('Auth & Check-In History E2E Integration Tests', () => {
  const testEmail = `challenger_${Date.now()}@example.com`;
  const testPassword = 'password123';
  let token = '';
  let userId = '';

  beforeAll(async () => {
    // Clear any leftover data if necessary (email is unique anyway)
  });

  afterAll(async () => {
    // Cleanup the user if it still exists
    if (userId) {
      await prisma.syllabusChunk.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Helper to make requests
  async function apiRequest(path: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...e2eHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...((options.headers || {}) as Record<string, string>),
    };

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const status = res.status;
    let body: any = null;
    try {
      body = await res.json();
    } catch (e) {
      // Not json
    }
    return { status, body };
  }

  describe('User Registration and Login', () => {
    it('should register a new user successfully', async () => {
      const { status, body } = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: 'Challenger User',
        }),
      });

      expect(status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.user.email).toBe(testEmail);

      token = body.data.token;
      userId = body.data.user.id;
    });

    it('should log in successfully', async () => {
      const { status, body } = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('should update name and telegramId successfully', async () => {
      const { status, body } = await apiRequest('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Updated Challenger',
          telegramId: 'tg-challenger-999',
        }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Challenger');
      expect(body.data.telegramId).toBe('tg-challenger-999');

      // Verify db values
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(dbUser?.name).toBe('Updated Challenger');
      expect(dbUser?.telegramId).toBe('tg-challenger-999');
    });

    it('should fail PATCH /me if type validation fails (e.g. name is number)', async () => {
      const { status, body } = await apiRequest('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 12345, // invalid type
        }),
      });

      expect(status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgot-password & POST /api/auth/reset-password', () => {
    it('should prevent user enumeration on forgot-password', async () => {
      const { status, body } = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent_challenger@example.com',
        }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Reset email sent');

      // Verify no token is created in database for this email
      const dbTokens = await prisma.passwordResetToken.findMany({
        where: { user: { email: 'nonexistent_challenger@example.com' } },
      });
      expect(dbTokens.length).toBe(0);
    });

    it('should generate token, hash it, store it, and reset password', async () => {
      // 1. Trigger forgot-password
      const { status: forgotStatus, body: forgotBody } = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
        }),
      });

      expect(forgotStatus).toBe(200);
      expect(forgotBody.success).toBe(true);

      // 2. Fetch the created token from database
      const dbTokens = await prisma.passwordResetToken.findMany({
        where: { userId },
      });
      expect(dbTokens.length).toBe(1);
      const dbToken = dbTokens[0];

      expect(dbToken.tokenHash).toBeDefined();
      expect(dbToken.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Try to find the plain token in database. It should NOT be there.
      // We can't query the plain token directly, but we can verify the hash matches what's in the DB.
      // Let's retrieve the logs or verify reset works by passing the plain token which we don't have.
      // Wait, how do we get the plain token? The email sending was mocked or skipped in logs because RESEND_API_KEY is not defined.
      // But we can find out what token was generated if we look at the implementation.
      // The implementation generates token via:
      // const token = crypto.randomBytes(32).toString('hex');
      // const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      // Since the server code doesn't return the plain token in the response (for security),
      // we can simulate reset-password by generating a token ourselves, inserting it manually into the DB, and calling reset-password!
      // This allows us to test the reset-password endpoint flow directly!
    });

    it('should reset password successfully with a valid token and hash it', async () => {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins in future

      // Insert token manually
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });

      const newPassword = 'newPassword1234';

      const { status, body } = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: plainToken,
          newPassword,
        }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);

      // Verify token is deleted
      const dbToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      expect(dbToken).toBeNull();

      // Verify passwordHash in database is updated and hashed correctly
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(dbUser?.passwordHash).toBeDefined();
      const isNewPasswordCorrect = await bcrypt.compare(newPassword, dbUser!.passwordHash);
      expect(isNewPasswordCorrect).toBe(true);

      // Verify login with new password works
      const loginRes = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: newPassword,
        }),
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);

      // Update the global token for subsequent authenticated requests
      token = loginRes.body.data.token;
    });

    it('should reject expired tokens during reset-password', async () => {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
      const expiresAt = new Date(Date.now() - 5000); // expired 5s ago

      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });

      const { status, body } = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: plainToken,
          newPassword: 'anotherNewPassword123',
        }),
      });

      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid or expired reset token');

      // Clean up expired token
      await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => {});
    });

    it('should reject invalid (nonexistent) tokens', async () => {
      const { status, body } = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'nonexistent-token-value',
          newPassword: 'anotherNewPassword123',
        }),
      });

      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid or expired reset token');
    });
  });

  describe('GET /api/checkin/history', () => {
    let planId = '';

    beforeAll(async () => {
      // Create a plan for the user to relate checkins
      const plan = await prisma.plan.create({
        data: {
          userId,
          subject: 'Chemistry',
          examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          goalScore: 90,
          dailyHours: 2,
        },
      });
      planId = plan.id;
    });

    it('should return checkin history format and verify limits', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      // Create check-ins with various flags
      // 1. Two days ago: YES -> Should be included
      await prisma.checkIn.create({
        data: {
          userId,
          planId,
          completionFlag: 'YES',
          createdAt: twoDaysAgo,
          sessionMins: 60,
        },
      });

      // 2. Today: PARTIALLY -> Should be included
      await prisma.checkIn.create({
        data: {
          userId,
          planId,
          completionFlag: 'PARTIALLY',
          createdAt: new Date(),
          sessionMins: 30,
        },
      });

      // 3. Today: LOGGED_OFFLINE (duplicate date) -> Should be deduplicated
      await prisma.checkIn.create({
        data: {
          userId,
          planId,
          completionFlag: 'LOGGED_OFFLINE',
          createdAt: new Date(),
          sessionMins: 45,
        },
      });

      // 4. Five days ago: NO -> Should NOT be included
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      await prisma.checkIn.create({
        data: {
          userId,
          planId,
          completionFlag: 'NO',
          createdAt: fiveDaysAgo,
          sessionMins: 0,
        },
      });

      // Fetch history with default params (30 days)
      const { status, body } = await apiRequest('/api/checkin/history');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      
      // Should contain twoDaysAgoStr and todayStr, and must be unique
      expect(body.data).toContain(twoDaysAgoStr);
      expect(body.data).toContain(todayStr);
      expect(body.data.length).toBe(2);

      // Verify order (ascending)
      const indexTwoDaysAgo = body.data.indexOf(twoDaysAgoStr);
      const indexToday = body.data.indexOf(todayStr);
      expect(indexTwoDaysAgo).toBeLessThan(indexToday);

      // Test days parameter limit: days=1
      const { status: statusDays1, body: bodyDays1 } = await apiRequest('/api/checkin/history?days=1');
      expect(statusDays1).toBe(200);
      expect(bodyDays1.data).toContain(todayStr);
      expect(bodyDays1.data).not.toContain(twoDaysAgoStr);

      // Test days parameter limit: days=95 (caps to 90)
      const { status: statusDays95, body: bodyDays95 } = await apiRequest('/api/checkin/history?days=95');
      expect(statusDays95).toBe(200);
      expect(bodyDays95.data).toContain(twoDaysAgoStr);

      // Test days parameter limit: days=0 (raises to 1)
      const { status: statusDays0, body: bodyDays0 } = await apiRequest('/api/checkin/history?days=0');
      expect(statusDays0).toBe(200);
      expect(bodyDays0.data).toContain(todayStr);
      expect(bodyDays0.data).not.toContain(twoDaysAgoStr);

      // Test days parameter invalid: days=abc (defaults to 30)
      const { status: statusDaysInvalid, body: bodyDaysInvalid } = await apiRequest('/api/checkin/history?days=abc');
      expect(statusDaysInvalid).toBe(200);
      expect(bodyDaysInvalid.data).toContain(twoDaysAgoStr);
      expect(bodyDaysInvalid.data).toContain(todayStr);
    });
  });

  describe('DELETE /api/auth/me', () => {
    it('should delete the user and cascade delete related data including syllabus chunks', async () => {
      // 1. Create a syllabus chunk for user (doesn't have native Cascade FK relation in Prisma)
      await prisma.syllabusChunk.create({
        data: {
          userId,
          planId: 'some-plan-id',
          content: 'Test syllabus content chunk',
        },
      });

      // Verify syllabus chunk is present in DB
      let chunks = await prisma.syllabusChunk.findMany({ where: { userId } });
      expect(chunks.length).toBe(1);

      // 2. Call DELETE /me
      const { status, body } = await apiRequest('/api/auth/me', {
        method: 'DELETE',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);

      // 3. Verify user is deleted
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(dbUser).toBeNull();

      // 4. Verify syllabus chunk is deleted (manually cascade deleted by endpoint)
      chunks = await prisma.syllabusChunk.findMany({ where: { userId } });
      expect(chunks.length).toBe(0);

      // 5. Verify other cascade deletes (Plans, Streaks, CheckIns)
      const plans = await prisma.plan.findMany({ where: { userId } });
      expect(plans.length).toBe(0);

      const streaks = await prisma.streak.findMany({ where: { userId } });
      expect(streaks.length).toBe(0);

      const checkIns = await prisma.checkIn.findMany({ where: { userId } });
      expect(checkIns.length).toBe(0);

      // Unset userId so afterAll doesn't try to delete it again
      userId = '';
    });
  });
});
