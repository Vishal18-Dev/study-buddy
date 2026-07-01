import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma";
import * as crypto from 'crypto';

const apiUrl = process.env.API_URL || "http://localhost:4000";

// E2E bypass header — skips rate limiting on staging when E2E_API_SECRET is set
const e2eSecret = process.env.E2E_API_SECRET;
const e2eHeaders: Record<string, string> = e2eSecret ? { 'x-e2e-secret': e2eSecret } : {};

function generateUniqueEmail(suffix: string): string {
  return `test_user_t2_${suffix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
}

async function registerUser(email: string) {
  const password = "password123";
  const name = "Tier2 Test User";
  const response = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...e2eHeaders },
    body: JSON.stringify({ email, password, name, role: "STUDENT" }),
  });

  const body = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Registration failed: ${JSON.stringify(body)}`);
  }
  return {
    email,
    password,
    token: body.data.token,
    user: body.data.user,
  };
}

async function createPlan(token: string, subject: string = "Mathematics", status: "ACTIVE" | "PAUSED" | "ABANDONED" = "ACTIVE") {
  const response = await fetch(`${apiUrl}/api/plans/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...e2eHeaders,
    },
    body: JSON.stringify({
      subject,
      examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      dailyHours: 2,
      goalScore: 90,
      knowledgeLevel: "BEGINNER",
    }),
  });

  const body = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Plan creation failed: ${JSON.stringify(body)}`);
  }

  const plan = body.data.plan;

  if (status !== "ACTIVE") {
    await prisma.plan.update({
      where: { id: plan.id },
      data: { status },
    });
    plan.status = status;
  }

  return plan;
}

describe("Tier 2 E2E - Boundary & Corner Cases", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Profile Edit Boundary Cases (PATCH /api/auth/me)
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Profile Edit", () => {
    it("a. should reject update with no authorization header", async () => {
      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthenticated" }),
      });
      expect(patchRes.status).toBe(401);
    });

    it("b. should reject update with bad token", async () => {
      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalidtoken123",
        },
        body: JSON.stringify({ name: "Unauthenticated" }),
      });
      expect(patchRes.status).toBe(401);
    });

    it("c. should succeed and make no changes when empty body is sent", async () => {
      const email = generateUniqueEmail("1c");
      const { token, user } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json() as any;
      expect(patchBody.data.name).toBe(user.name);
      expect(patchBody.data.telegramId).toBeNull();

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should reject update when name exceeds 100 characters", async () => {
      const email = generateUniqueEmail("1d");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "a".repeat(101) }),
      });
      expect(patchRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should reject update when telegramId exceeds 100 characters", async () => {
      const email = generateUniqueEmail("1e");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ telegramId: "t".repeat(101) }),
      });
      expect(patchRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("f. should reject update when name is invalid type (number)", async () => {
      const email = generateUniqueEmail("1f");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 12345 }),
      });
      expect(patchRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("g. should reject update when telegramId is invalid type (boolean)", async () => {
      const email = generateUniqueEmail("1g");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ telegramId: true }),
      });
      expect(patchRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Delete Account Boundary Cases (DELETE /api/auth/me)
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Delete Account", () => {
    it("a. should reject delete with no authorization header", async () => {
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(401);
    });

    it("b. should reject delete with bad token", async () => {
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer badtoken" },
      });
      expect(deleteRes.status).toBe(401);
    });

    it("c. should return 401/404 for deleting a user twice", async () => {
      const email = generateUniqueEmail("2c");
      const { token } = await registerUser(email);

      // First delete
      const del1 = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(del1.status).toBe(200);

      // Second delete
      const del2 = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect([401, 404]).toContain(del2.status);
    });

    it("d. should cascade delete user checkins and plans", async () => {
      const email = generateUniqueEmail("2d");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Create a checkin
      await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 30,
        }),
      });

      // Verify db state
      const dbPlansBefore = await prisma.plan.findMany({ where: { userId: user.id } });
      const dbCheckinsBefore = await prisma.checkIn.findMany({ where: { userId: user.id } });
      expect(dbPlansBefore.length).toBe(1);
      expect(dbCheckinsBefore.length).toBe(1);

      // Delete user
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });

      // Verify cascading
      const dbPlansAfter = await prisma.plan.findMany({ where: { userId: user.id } });
      const dbCheckinsAfter = await prisma.checkIn.findMany({ where: { userId: user.id } });
      expect(dbPlansAfter.length).toBe(0);
      expect(dbCheckinsAfter.length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Checkin History Heatmap Boundary Cases (GET /api/checkin/history)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Checkin History Heatmap", () => {
    it("a. should reject history request with no authorization header", async () => {
      const res = await fetch(`${apiUrl}/api/checkin/history`);
      expect(res.status).toBe(401);
    });

    it("b. should cap days parameter to 90 when requested value is too large", async () => {
      const email = generateUniqueEmail("3b");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Insert checkin 85 days ago
      const eightyFiveDaysAgo = new Date();
      eightyFiveDaysAgo.setDate(eightyFiveDaysAgo.getDate() - 85);
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: eightyFiveDaysAgo,
        },
      });

      // Query with days=120, capped to 90. The 85-day-old checkin should be included.
      const res120 = await fetch(`${apiUrl}/api/checkin/history?days=120`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(res120.status).toBe(200);
      const body120 = await res120.json() as any;
      expect(body120.data.length).toBe(1);

      // Insert checkin 95 days ago
      const ninetyFiveDaysAgo = new Date();
      ninetyFiveDaysAgo.setDate(ninetyFiveDaysAgo.getDate() - 95);
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: ninetyFiveDaysAgo,
        },
      });

      // Query with days=120 (capped to 90), the 95-day-old checkin should NOT be included.
      const resCap = await fetch(`${apiUrl}/api/checkin/history?days=120`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const bodyCap = await resCap.json() as any;
      // It should still only have 1 item (the 85-day-old one), not the 95-day-old one
      expect(bodyCap.data.length).toBe(1);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should floor days parameter to 1 when requested value is negative", async () => {
      const email = generateUniqueEmail("3c");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Today's checkin
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: new Date(),
        },
      });

      // Yesterday's checkin
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: yesterday,
        },
      });

      // Query with days=-5 -> should floor to 1. Only today's checkin should be returned.
      const res = await fetch(`${apiUrl}/api/checkin/history?days=-5`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.length).toBe(1); // Only today, not yesterday

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should floor days parameter to 1 when requested value is zero", async () => {
      const email = generateUniqueEmail("3d");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: new Date(),
        },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: yesterday,
        },
      });

      // Query with days=0 -> should floor to 1. Only today's checkin should be returned.
      const res = await fetch(`${apiUrl}/api/checkin/history?days=0`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.length).toBe(1);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should default days parameter to 30 when value is invalid string", async () => {
      const email = generateUniqueEmail("3e");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Checkin 15 days ago
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: fifteenDaysAgo,
        },
      });

      // Query with days=abc -> should default to 30. The 15-day-old checkin should be returned.
      const res = await fetch(`${apiUrl}/api/checkin/history?days=abc`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.length).toBe(1);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Forgot Password Flow Boundary Cases (POST /api/auth/forgot-password & reset)
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Forgot Password Flow", () => {
    it("a. should reject forgot password request with invalid/malformed email format", async () => {
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email-format" }),
      });
      expect(res.status).toBe(400);
    });

    it("b. should reject forgot password request with empty email body", async () => {
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("c. should reject reset password request with expired token", async () => {
      const email = generateUniqueEmail("4c");
      const { user, token: userToken } = await registerUser(email);

      const plainToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
      const expiresAt = new Date(Date.now() - 5000); // Expired 5 seconds ago

      // Insert expired token directly in db
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: plainToken,
          newPassword: "newSecurePassword123",
        }),
      });
      expect(resetRes.status).toBe(400);

      // Clean up token and user
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` },
      });
    });

    it("d. should reject reset password request with invalid/tampered token", async () => {
      const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "thistokenisdefinitelyfakeandnotindatabase",
          newPassword: "newSecurePassword123",
        }),
      });
      expect(resetRes.status).toBe(400);
    });

    it("e. should reject reset password request when token is missing", async () => {
      const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: "newSecurePassword123",
        }),
      });
      expect(resetRes.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Study Time Logging Boundary Cases (POST /api/checkin)
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Study Time Logging", () => {
    it("a. should reject checkin with negative sessionMins", async () => {
      const email = generateUniqueEmail("5a");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: -10,
        }),
      });
      expect(checkinRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should reject checkin with sessionMins > 480", async () => {
      const email = generateUniqueEmail("5b");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 481,
        }),
      });
      expect(checkinRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should reject checkin with decimal sessionMins", async () => {
      const email = generateUniqueEmail("5c");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45.5,
        }),
      });
      expect(checkinRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should reject checkin with string sessionMins", async () => {
      const email = generateUniqueEmail("5d");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: "30",
        }),
      });
      expect(checkinRes.status).toBe(400);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should reject checkin with no authorization header", async () => {
      const email = generateUniqueEmail("5e");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 30,
        }),
      });
      expect(checkinRes.status).toBe(401);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Plans Active Route Fallback (GET /api/plans/active)
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Plans Active Route Fallback", () => {
    it("a. should reject active plan request with no authorization header", async () => {
      const activeRes = await fetch(`${apiUrl}/api/plans/active`);
      expect(activeRes.status).toBe(401);
    });

    it("b. should return 404 when requesting active plan for user with no plans", async () => {
      const email = generateUniqueEmail("6b");
      const { token } = await registerUser(email);

      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(404);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should return 404 when requesting active plan for user who only has paused plans", async () => {
      const email = generateUniqueEmail("6c");
      const { token } = await registerUser(email);
      await createPlan(token, "Paused Plan", "PAUSED");

      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(404);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should return 404 when requesting active plan for user who only has abandoned plans", async () => {
      const email = generateUniqueEmail("6d");
      const { token } = await registerUser(email);
      await createPlan(token, "Abandoned Plan", "ABANDONED");

      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(404);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });
});
