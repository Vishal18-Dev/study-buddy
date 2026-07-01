import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma";
import * as crypto from "crypto";

const apiUrl = process.env.API_URL || "http://localhost:4000";

// E2E bypass header — skips rate limiting on staging when E2E_API_SECRET is set
const e2eSecret = process.env.E2E_API_SECRET;
const e2eHeaders: Record<string, string> = e2eSecret ? { 'x-e2e-secret': e2eSecret } : {};

function generateUniqueEmail(suffix: string): string {
  return `test_user_t3_${suffix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
}

async function registerUser(email: string, role: "STUDENT" | "TEACHER" = "STUDENT") {
  const password = "password123";
  const name = "Tier3 Test User";
  const response = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...e2eHeaders },
    body: JSON.stringify({ email, password, name, role }),
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
      examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      dailyHours: 2,
      goalScore: 95,
      knowledgeLevel: "BEGINNER",
    }),
  });

  const body = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Plan creation failed: ${JSON.stringify(body)}`);
  }
  return body.data.plan;
}

describe("Tier 3 E2E - Cross-Feature Combinations & Pairwise Coverage", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 1: Profile edit combined with Check-In
  // ───────────────────────────────────────────────────────────────────────────
  it("1. should allow profile edit combined with check-in, verifying streak and user logs", async () => {
    const email = generateUniqueEmail("c1");
    const { token, user } = await registerUser(email);

    // 1. Edit Profile
    const profileRes = await fetch(`${apiUrl}/api/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Updated Tier3 Name",
        telegramId: "tg_tier3_user",
      }),
    });
    expect(profileRes.status).toBe(200);

    // 2. Create Plan
    const plan = await createPlan(token, "Biology");

    // 3. Perform Check-In
    const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        planId: plan.id,
        completionFlag: "YES",
        sessionMins: 60,
        note: "Great biology study session",
      }),
    });
    expect(checkinRes.status).toBe(200);
    const checkinBody = await checkinRes.json() as any;
    expect(checkinBody.success).toBe(true);
    expect(checkinBody.data.streak.current).toBe(1);

    // 4. Verify checkin belongs to the updated user
    const dbCheckins = await prisma.checkIn.findMany({
      where: { userId: user.id },
    });
    expect(dbCheckins.length).toBe(1);
    expect(dbCheckins[0].planId).toBe(plan.id);

    // Verify user details in DB
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.name).toBe("Updated Tier3 Name");
    expect(dbUser?.telegramId).toBe("tg_tier3_user");

    // Clean up
    await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 2: Forgot-password leading to reset, login, and active flow
  // ───────────────────────────────────────────────────────────────────────────
  it("2. should reset password, login, create a plan, and log check-in", async () => {
    const email = generateUniqueEmail("c2");
    const { token: originalToken } = await registerUser(email);

    // 1. Forgot password
    const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(forgotRes.status).toBe(200);
    const forgotBody = await forgotRes.json() as any;
    const debugToken = forgotBody.debugToken;
    expect(debugToken).toBeDefined();

    // 2. Reset password
    const newPassword = "newSuperSecretPassword999";
    const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: debugToken,
        newPassword,
      }),
    });
    expect(resetRes.status).toBe(200);

    // 3. Login with new password
    const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json() as any;
    const newToken = loginBody.data.token;
    expect(newToken).toBeDefined();

    // 4. Create plan and check in
    const plan = await createPlan(newToken, "Physics");
    const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${newToken}`,
      },
      body: JSON.stringify({
        planId: plan.id,
        completionFlag: "YES",
        sessionMins: 45,
      }),
    });
    expect(checkinRes.status).toBe(200);

    // Clean up
    await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${newToken}` },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 3: Cascade deletes of active/paused plans and check-ins on user deletion
  // ───────────────────────────────────────────────────────────────────────────
  it("3. should delete user and cascade plans and check-ins, rejecting subsequent login", async () => {
    const email = generateUniqueEmail("c3");
    const { token, user, password } = await registerUser(email);

    // 1. Create active plan
    const plan1 = await createPlan(token, "Maths");

    // 2. Create another plan (pauses plan1, plan2 is active)
    const plan2 = await createPlan(token, "Science");

    // 3. Perform check-ins
    await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: plan1.id, completionFlag: "YES", sessionMins: 30 }),
    });

    await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: plan2.id, completionFlag: "PARTIALLY", sessionMins: 15 }),
    });

    // Verify DB pre-deletion
    const plansBefore = await prisma.plan.findMany({ where: { userId: user.id } });
    const checkinsBefore = await prisma.checkIn.findMany({ where: { userId: user.id } });
    expect(plansBefore.length).toBe(2);
    expect(checkinsBefore.length).toBe(2);

    // 4. Delete user
    const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(200);

    // 5. Verify subsequent login fails
    const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(401);

    // 6. Verify cascade delete in DB
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeNull();

    const dbPlans = await prisma.plan.findMany({ where: { userId: user.id } });
    expect(dbPlans.length).toBe(0);

    const dbCheckins = await prisma.checkIn.findMany({ where: { userId: user.id } });
    expect(dbCheckins.length).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 4: Plan switching and distinct check-in histories
  // ───────────────────────────────────────────────────────────────────────────
  it("4. should handle multiple active/paused plans and verify check-in logs do not mix them up", async () => {
    const email = generateUniqueEmail("c4");
    const { token, user } = await registerUser(email);

    // 1. Create plan A (starts as ACTIVE)
    const planA = await createPlan(token, "History");
    expect(planA.status).toBe("ACTIVE");

    // 2. Check in on A
    await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: planA.id, completionFlag: "YES", sessionMins: 90, note: "A check" }),
    });

    // 3. Create plan B (pauses plan A, plan B becomes ACTIVE)
    const planB = await createPlan(token, "Geography");
    expect(planB.status).toBe("ACTIVE");

    // Verify plan A status updated to PAUSED in DB
    const dbPlanAPaused = await prisma.plan.findUnique({ where: { id: planA.id } });
    expect(dbPlanAPaused?.status).toBe("PAUSED");

    // 4. Check in on B
    await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: planB.id, completionFlag: "YES", sessionMins: 60, note: "B check" }),
    });

    // 5. Query active plan endpoint - should return plan B
    const activeRes = await fetch(`${apiUrl}/api/plans/active`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(activeRes.status).toBe(200);
    const activeBody = await activeRes.json() as any;
    expect(activeBody.data.id).toBe(planB.id);

    // 6. Verify distinct associations in database
    const dbCheckinA = await prisma.checkIn.findFirst({ where: { planId: planA.id } });
    const dbCheckinB = await prisma.checkIn.findFirst({ where: { planId: planB.id } });
    expect(dbCheckinA?.note).toBe("A check");
    expect(dbCheckinB?.note).toBe("B check");
    expect(dbCheckinA?.userId).toBe(user.id);
    expect(dbCheckinB?.userId).toBe(user.id);

    // Clean up
    await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 5: Forgot-password on nonexistent email, then registering and using system
  // ───────────────────────────────────────────────────────────────────────────
  it("5. should handle forgot-password for nonexistent user safely, then registering and checking in", async () => {
    const nonexistentEmail = `nobody_${Date.now()}@example.com`;

    // 1. Forgot password for nonexistent email
    const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: nonexistentEmail }),
    });
    expect(forgotRes.status).toBe(200);
    const forgotBody = await forgotRes.json() as any;
    expect(forgotBody.success).toBe(true);
    expect(forgotBody.debugToken).toBeUndefined(); // No token created since user doesn't exist

    // 2. Register that email
    const { token } = await registerUser(nonexistentEmail);

    // 3. Create plan and check in
    const plan = await createPlan(token, "Art");
    const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: plan.id, completionFlag: "YES", sessionMins: 45 }),
    });
    expect(checkinRes.status).toBe(200);

    // Clean up
    await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case 6: Guest plan creation, registration claiming, and profile validation mix
  // ───────────────────────────────────────────────────────────────────────────
  it("6. should support guest plan claiming, followed by profile edit, activation, and check-in", async () => {
    // 1. Create plan anonymously (as guest user)
    const guestPlanRes = await fetch(`${apiUrl}/api/plans/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Guest Plan Chemistry",
        examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dailyHours: 1,
        goalScore: 85,
        knowledgeLevel: "BEGINNER",
      }),
    });
    expect(guestPlanRes.status).toBe(201);
    const guestPlanBody = await guestPlanRes.json() as any;
    const planId = guestPlanBody.data.plan.id;
    const guestUserId = guestPlanBody.data.plan.userId;

    // Verify guest user exists
    const guestUserBefore = await prisma.user.findUnique({ where: { id: guestUserId } });
    expect(guestUserBefore?.email).toContain("guest-");

    // 2. Register new user and claim guest plan
    const email = generateUniqueEmail("c6");
    const registerClaimRes = await fetch(`${apiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "securePassword123",
        name: "Claimer User",
        planId: planId, // claim the guest plan on register
      }),
    });
    expect(registerClaimRes.status).toBe(201);
    const claimBody = await registerClaimRes.json() as any;
    const token = claimBody.data.token;
    const registeredUserId = claimBody.data.user.id;

    // Verify guest user is cleaned up from database
    const guestUserAfter = await prisma.user.findUnique({ where: { id: guestUserId } });
    expect(guestUserAfter).toBeNull();

    // Verify plan is now owned by registered user
    const planAfter = await prisma.plan.findUnique({ where: { id: planId } });
    expect(planAfter?.userId).toBe(registeredUserId);

    // 3. Edit Profile
    const profileRes = await fetch(`${apiUrl}/api/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "Updated Claimer", telegramId: "tg_claimer" }),
    });
    expect(profileRes.status).toBe(200);

    // 4. Create another plan (will pause the claimed guest plan)
    const newPlan = await createPlan(token, "Guest Plan Physics");
    expect(newPlan.status).toBe("ACTIVE");

    // Verify claimed plan is now PAUSED
    const plan1AfterSwitch = await prisma.plan.findUnique({ where: { id: planId } });
    expect(plan1AfterSwitch?.status).toBe("PAUSED");

    // 5. Perform check-in on both plans
    const ci1 = await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: planId, completionFlag: "YES", sessionMins: 30 }),
    });
    expect(ci1.status).toBe(200);

    const ci2 = await fetch(`${apiUrl}/api/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: newPlan.id, completionFlag: "PARTIALLY", sessionMins: 15 }),
    });
    expect(ci2.status).toBe(200);

    // Clean up
    await fetch(`${apiUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
  });
});
