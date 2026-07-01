import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma";

const apiUrl = process.env.API_URL || "http://localhost:4000";

// E2E bypass header — skips rate limiting on staging when E2E_API_SECRET is set
const e2eSecret = process.env.E2E_API_SECRET;
const e2eHeaders: Record<string, string> = e2eSecret ? { 'x-e2e-secret': e2eSecret } : {};

// Helper to generate unique email
function generateUniqueEmail(suffix: string): string {
  return `test_user_t1_${suffix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
}

// Helper to register a user
async function registerUser(email: string) {
  const password = "password123";
  const name = "Test User";
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

// Helper to create a plan
async function createPlan(token: string, subject: string = "Mathematics") {
  const response = await fetch(`${apiUrl}/api/plans/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...e2eHeaders,
    },
    body: JSON.stringify({
      subject,
      examDate: "2026-12-31T00:00:00.000Z",
      dailyHours: 2,
      goalScore: 90,
      knowledgeLevel: "BEGINNER",
    }),
  });

  const body = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Plan creation failed: ${JSON.stringify(body)}`);
  }
  return body.data.plan;
}

describe("Tier 1 E2E - Feature Coverage", () => {
  // Ensure the database connection is alive before starting tests
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 1: Profile edit (PATCH /api/auth/me)
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Profile edit (PATCH /api/auth/me)", () => {
    it("a. should edit name and telegramId together", async () => {
      const email = generateUniqueEmail("1a");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "Updated Together", telegramId: "tg_together" }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json() as any;
      expect(patchBody.success).toBe(true);
      expect(patchBody.data.name).toBe("Updated Together");
      expect(patchBody.data.telegramId).toBe("tg_together");

      // Verify via GET
      const getRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const getBody = await getRes.json() as any;
      expect(getBody.data.name).toBe("Updated Together");
      expect(getBody.data.telegramId).toBe("tg_together");

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should edit name only", async () => {
      const email = generateUniqueEmail("1b");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "Name Only Update" }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json() as any;
      expect(patchBody.data.name).toBe("Name Only Update");
      expect(patchBody.data.telegramId).toBeNull();

      // Verify via GET
      const getRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const getBody = await getRes.json() as any;
      expect(getBody.data.name).toBe("Name Only Update");
      expect(getBody.data.telegramId).toBeNull();

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should edit telegramId only", async () => {
      const email = generateUniqueEmail("1c");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ telegramId: "tg_only" }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json() as any;
      expect(patchBody.data.name).toBe("Test User");
      expect(patchBody.data.telegramId).toBe("tg_only");

      // Verify via GET
      const getRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const getBody = await getRes.json() as any;
      expect(getBody.data.name).toBe("Test User");
      expect(getBody.data.telegramId).toBe("tg_only");

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should succeed when editing profile with empty body", async () => {
      const email = generateUniqueEmail("1d");
      const { token } = await registerUser(email);

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
      expect(patchBody.data.name).toBe("Test User");
      expect(patchBody.data.telegramId).toBeNull();

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should ignore extra/invalid fields during profile edit", async () => {
      const email = generateUniqueEmail("1e");
      const { token } = await registerUser(email);

      const patchRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: "Valid Name",
          role: "TEACHER",
          tier: "PRO",
          preference: "PLAN_CONTENT_EXAMS",
        }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json() as any;
      // name is updated, but role and tier must remain unchanged
      expect(patchBody.data.name).toBe("Valid Name");
      expect(patchBody.data.role).toBe("STUDENT");
      expect(patchBody.data.tier).toBe("FREE");

      // Verify via GET
      const getRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const getBody = await getRes.json() as any;
      expect(getBody.data.name).toBe("Valid Name");
      expect(getBody.data.role).toBe("STUDENT");
      expect(getBody.data.tier).toBe("FREE");

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 2: Delete account (DELETE /api/auth/me)
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Delete account (DELETE /api/auth/me)", () => {
    it("a. should delete authenticated user", async () => {
      const email = generateUniqueEmail("2a");
      const { token } = await registerUser(email);

      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json() as any;
      expect(deleteBody.success).toBe(true);
    });

    it("b. should fail login with 401 after deletion", async () => {
      const email = generateUniqueEmail("2b");
      const { password, token } = await registerUser(email);

      // Delete first
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);

      // Attempt login
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      expect(loginRes.status).toBe(401);
      const loginBody = await loginRes.json() as any;
      expect(loginBody.success).toBe(false);
    });

    it("c. should return 401/404 for requesting /api/auth/me after deletion", async () => {
      const email = generateUniqueEmail("2c");
      const { token } = await registerUser(email);

      // Delete first
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);

      // Request /me with old token
      const getRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect([401, 404]).toContain(getRes.status);
    });

    it("d. should cascade delete plans when deleting user (no foreign key violations)", async () => {
      const email = generateUniqueEmail("2d");
      const { token, user } = await registerUser(email);

      // Create a plan for the user
      const plan = await createPlan(token);
      const planId = plan.id;

      // Verify plan exists in DB
      const dbPlanBefore = await prisma.plan.findUnique({ where: { id: planId } });
      expect(dbPlanBefore).not.toBeNull();

      // Delete user
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);

      // Verify user is deleted in DB
      const dbUserAfter = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUserAfter).toBeNull();

      // Verify plan is cascade-deleted
      const dbPlanAfter = await prisma.plan.findUnique({ where: { id: planId } });
      expect(dbPlanAfter).toBeNull();
    });

    it("e. should return 401/404 when deleting a user twice", async () => {
      const email = generateUniqueEmail("2e");
      const { token } = await registerUser(email);

      // First delete
      const delete1 = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(delete1.status).toBe(200);

      // Second delete
      const delete2 = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect([401, 404]).toContain(delete2.status);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 3: Checkin history heatmap (GET /api/checkin/history)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Checkin history heatmap (GET /api/checkin/history)", () => {
    it("a. should get history with default days (30)", async () => {
      const email = generateUniqueEmail("3a");
      const { token } = await registerUser(email);

      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      expect(historyBody.success).toBe(true);
      expect(Array.isArray(historyBody.data)).toBe(true);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should return empty history for a newly registered user", async () => {
      const email = generateUniqueEmail("3b");
      const { token } = await registerUser(email);

      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      expect(historyBody.data).toEqual([]);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should include positive completion flags (YES, PARTIALLY, LOGGED_OFFLINE) in history dates", async () => {
      const email = generateUniqueEmail("3c");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      const flags = ["YES", "PARTIALLY", "LOGGED_OFFLINE"];
      const todayString = new Date().toISOString().split("T")[0];

      for (const flag of flags) {
        const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            planId: plan.id,
            completionFlag: flag,
            sessionMins: 30,
            note: `Testing flag ${flag}`,
          }),
        });
        expect(checkinRes.status).toBe(200);
      }

      // Query history
      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      expect(historyBody.data).toContain(todayString);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should exclude negative completion flag (NO) from history dates", async () => {
      const email = generateUniqueEmail("3d");
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
          completionFlag: "NO",
          sessionMins: 0,
        }),
      });
      expect(checkinRes.status).toBe(200);

      // Query history
      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      expect(historyBody.data).toEqual([]);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should filter checkin history by days parameter correctly", async () => {
      const email = generateUniqueEmail("3e");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Let's programmatically insert a check-in in the database that is 15 days ago
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

      const fifteenDaysAgoString = fifteenDaysAgo.toISOString().split("T")[0];

      // Query history with default (30 days) or ?days=30
      const history30Res = await fetch(`${apiUrl}/api/checkin/history?days=30`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(history30Res.status).toBe(200);
      const history30Body = await history30Res.json() as any;
      expect(history30Body.data).toContain(fifteenDaysAgoString);

      // Query history with ?days=7
      const history7Res = await fetch(`${apiUrl}/api/checkin/history?days=7`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(history7Res.status).toBe(200);
      const history7Body = await history7Res.json() as any;
      expect(history7Body.data).not.toContain(fifteenDaysAgoString);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 4: Forgot Password flow
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Forgot Password flow", () => {
    it("a. should successfully request forgot-password link", async () => {
      const email = generateUniqueEmail("4a");
      const { token } = await registerUser(email);

      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      expect(forgotRes.status).toBe(200);
      const forgotBody = await forgotRes.json() as any;
      expect(forgotBody.success).toBe(true);
      expect(forgotBody.message).toBeDefined();

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should reset password with a valid token", async () => {
      const email = generateUniqueEmail("4b");
      const { token } = await registerUser(email);

      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const forgotBody = await forgotRes.json() as any;
      const debugToken = forgotBody.debugToken;
      expect(debugToken).toBeDefined();

      const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: debugToken,
          newPassword: "newSecurePassword123",
        }),
      });
      expect(resetRes.status).toBe(200);
      const resetBody = await resetRes.json() as any;
      expect(resetBody.success).toBe(true);

      // Clean up (cannot use original token because password changed and token gets consumed)
      // Login with new password to get a new token to delete
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "newSecurePassword123" }),
      });
      const loginBody = await loginRes.json() as any;
      const newToken = loginBody.data.token;

      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${newToken}` },
      });
    });

    it("c. should log in with the new password successfully", async () => {
      const email = generateUniqueEmail("4c");
      await registerUser(email);

      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const forgotBody = await forgotRes.json() as any;
      const debugToken = forgotBody.debugToken;

      await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: debugToken,
          newPassword: "newSecurePassword123",
        }),
      });

      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "newSecurePassword123" }),
      });
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;
      expect(loginBody.success).toBe(true);
      expect(loginBody.data.token).toBeDefined();

      const newToken = loginBody.data.token;
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${newToken}` },
      });
    });

    it("d. should reject old password login with 401 after reset", async () => {
      const email = generateUniqueEmail("4d");
      await registerUser(email);

      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const forgotBody = await forgotRes.json() as any;
      const debugToken = forgotBody.debugToken;

      await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: debugToken,
          newPassword: "newSecurePassword123",
        }),
      });

      // Login with old password
      const loginOldRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      expect(loginOldRes.status).toBe(401);

      // Login with new password to clean up
      const loginNewRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "newSecurePassword123" }),
      });
      const loginNewBody = await loginNewRes.json() as any;
      const newToken = loginNewBody.data.token;

      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${newToken}` },
      });
    });

    it("e. should reject reuse of the same reset token (single-use token)", async () => {
      const email = generateUniqueEmail("4e");
      await registerUser(email);

      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const forgotBody = await forgotRes.json() as any;
      const debugToken = forgotBody.debugToken;

      // First reset
      const reset1 = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: debugToken,
          newPassword: "newSecurePassword123",
        }),
      });
      expect(reset1.status).toBe(200);

      // Second reset using same token
      const reset2 = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: debugToken,
          newPassword: "anotherPassword123",
        }),
      });
      expect(reset2.status).toBe(400);

      // Clean up
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "newSecurePassword123" }),
      });
      const loginBody = await loginRes.json() as any;
      const newToken = loginBody.data.token;

      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${newToken}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 5: Study time logging (sessionMins in POST /api/checkin)
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Study time logging (sessionMins in POST /api/checkin)", () => {
    it("a. should log check in with valid positive sessionMins", async () => {
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
          sessionMins: 45,
        }),
      });
      expect(checkinRes.status).toBe(200);
      const checkinBody = await checkinRes.json() as any;
      expect(checkinBody.success).toBe(true);
      expect(checkinBody.data.checkIn.sessionMins).toBe(45);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should default sessionMins to 0 when omitted", async () => {
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
        }),
      });
      expect(checkinRes.status).toBe(200);
      const checkinBody = await checkinRes.json() as any;
      expect(checkinBody.data.checkIn.sessionMins).toBe(0);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should log check in with sessionMins = 0", async () => {
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
          sessionMins: 0,
        }),
      });
      expect(checkinRes.status).toBe(200);
      const checkinBody = await checkinRes.json() as any;
      expect(checkinBody.data.checkIn.sessionMins).toBe(0);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("d. should log check in with max sessionMins = 480", async () => {
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
          sessionMins: 480,
        }),
      });
      expect(checkinRes.status).toBe(200);
      const checkinBody = await checkinRes.json() as any;
      expect(checkinBody.data.checkIn.sessionMins).toBe(480);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should retrieve correct sessionMins value when queried", async () => {
      const email = generateUniqueEmail("5e");
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
          sessionMins: 75,
        }),
      });
      const checkinBody = await checkinRes.json() as any;
      const checkinId = checkinBody.data.checkIn.id;

      // Verify in DB directly
      const dbCheckin = await prisma.checkIn.findUnique({
        where: { id: checkinId },
      });
      expect(dbCheckin).not.toBeNull();
      expect(dbCheckin?.sessionMins).toBe(75);

      // Verify via GET /api/checkin/today
      const todayRes = await fetch(`${apiUrl}/api/checkin/today`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(todayRes.status).toBe(200);
      const todayBody = await todayRes.json() as any;
      expect(todayBody.data.checkIn.sessionMins).toBe(75);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 6: Plans active route fallback resolution
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Plans active route fallback resolution (GET /api/plans/active vs GET /api/plans/:planId)", () => {
    it("a. should request active plan when user has one", async () => {
      const email = generateUniqueEmail("6a");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(200);
      const activeBody = await activeRes.json() as any;
      expect(activeBody.success).toBe(true);
      expect(activeBody.data.id).toBe(plan.id);
      expect(activeBody.data.status).toBe("ACTIVE");

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("b. should return 404 active plan when user has no plans", async () => {
      const email = generateUniqueEmail("6b");
      const { token } = await registerUser(email);

      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(404);
      const activeBody = await activeRes.json() as any;
      expect(activeBody.success).toBe(false);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("c. should return 404 active plan when plan is paused", async () => {
      const email = generateUniqueEmail("6c");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      // Pause the plan directly via database update
      await prisma.plan.update({
        where: { id: plan.id },
        data: { status: "PAUSED" },
      });

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

    it("d. should switch active plan and verify GET /plans/active returns the new active plan", async () => {
      const email = generateUniqueEmail("6d");
      const { token } = await registerUser(email);

      // Create Plan A (active by default, pausing others)
      const planA = await createPlan(token, "Plan A");

      // Create Plan B (active by default, pausing Plan A)
      const planB = await createPlan(token, "Plan B");

      // GET /plans/active should return Plan B
      let activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      let activeBody = await activeRes.json() as any;
      expect(activeBody.data.id).toBe(planB.id);

      // Activate Plan A
      const activateARes = await fetch(`${apiUrl}/api/plans/${planA.id}/activate`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activateARes.status).toBe(200);

      // GET /plans/active should return Plan A
      activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      activeBody = await activeRes.json() as any;
      expect(activeBody.data.id).toBe(planA.id);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });

    it("e. should get plan by ID and verify it works without route collision", async () => {
      const email = generateUniqueEmail("6e");
      const { token } = await registerUser(email);
      const plan = await createPlan(token);

      // Get plan by ID
      const byIdRes = await fetch(`${apiUrl}/api/plans/${plan.id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(byIdRes.status).toBe(200);
      const byIdBody = await byIdRes.json() as any;
      expect(byIdBody.success).toBe(true);
      expect(byIdBody.data.id).toBe(plan.id);

      // Verify active route still works
      const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(activeRes.status).toBe(200);
      const activeBody = await activeRes.json() as any;
      expect(activeBody.data.id).toBe(plan.id);

      // Clean up
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });
});
