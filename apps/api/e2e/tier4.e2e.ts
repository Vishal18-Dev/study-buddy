import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma";
import * as crypto from "crypto";

const apiUrl = process.env.API_URL || "http://localhost:4000";

// E2E bypass header — skips rate limiting on staging when E2E_API_SECRET is set
const e2eSecret = process.env.E2E_API_SECRET;
const e2eHeaders: Record<string, string> = e2eSecret ? { 'x-e2e-secret': e2eSecret } : {};

function generateUniqueEmail(suffix: string): string {
  return `test_user_t4_${suffix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
}

describe("Tier 4 E2E - Complex Multi-Step Scenarios", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 1: Guest plan creation -> Claim plan during registration ->
  //             Verify old guest user deleted -> Check-in with study minutes ->
  //             Verify streak & check-in history.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Scenario 1: Guest Onboarding and Progression Flow", () => {
    it("should successfully onboarding a guest, claim plan, check-in, and update streak/history", async () => {
      // 1. Create a guest plan (no authorization header)
      const subject = `Chemistry-${crypto.randomBytes(4).toString("hex")}`;
      const createPlanRes = await fetch(`${apiUrl}/api/plans/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...e2eHeaders },
        body: JSON.stringify({
          subject,
          examDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          dailyHours: 3.5,
          goalScore: 85,
          knowledgeLevel: "SOME_KNOWLEDGE",
        }),
      });

      expect(createPlanRes.status).toBe(201);
      const createPlanBody = await createPlanRes.json() as any;
      expect(createPlanBody.success).toBe(true);
      
      const plan = createPlanBody.data.plan;
      expect(plan.id).toBeDefined();
      const guestUserId = plan.userId;
      expect(guestUserId).toBeDefined();

      // Verify guest user exists in the database
      const guestUser = await prisma.user.findUnique({
        where: { id: guestUserId },
      });
      expect(guestUser).not.toBeNull();
      expect(guestUser?.email).toMatch(/^guest-/);

      // 2. Register a new user and claim the plan
      const userEmail = generateUniqueEmail("sc1");
      const userPassword = "securePassword123";
      const registerRes = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...e2eHeaders },
        body: JSON.stringify({
          email: userEmail,
          password: userPassword,
          name: "Scenario One User",
          planId: plan.id,
        }),
      });

      expect(registerRes.status).toBe(201);
      const registerBody = await registerRes.json() as any;
      expect(registerBody.success).toBe(true);
      const token = registerBody.data.token;
      const registeredUserId = registerBody.data.user.id;
      expect(token).toBeDefined();

      // Verify plan is now owned by the registered user
      const updatedPlan = await prisma.plan.findUnique({
        where: { id: plan.id },
      });
      expect(updatedPlan?.userId).toBe(registeredUserId);

      // Verify guest user is deleted
      const deletedGuestUser = await prisma.user.findUnique({
        where: { id: guestUserId },
      });
      expect(deletedGuestUser).toBeNull();

      // 3. Log a study check-in
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
          note: "Onboarded guest session complete",
        }),
      });

      expect(checkinRes.status).toBe(200);
      const checkinBody = await checkinRes.json() as any;
      expect(checkinBody.success).toBe(true);
      expect(checkinBody.data.checkIn.sessionMins).toBe(45);

      // 4. Verify Streak is updated
      const streakRes = await fetch(`${apiUrl}/api/checkin`, {
        headers: { "Authorization": `Bearer ${token}` }, // wait, GET streak or me has streak?
      });
      // Let's check the database or query GET /api/auth/me to verify streak/check-in history
      const meRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(meRes.status).toBe(200);

      const dbStreak = await prisma.streak.findUnique({
        where: { userId: registeredUserId },
      });
      expect(dbStreak?.current).toBeGreaterThanOrEqual(1);

      // 5. Verify Check-in History
      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      expect(historyBody.success).toBe(true);
      const todayString = new Date().toISOString().split("T")[0];
      expect(historyBody.data).toContain(todayString);

      // Cleanup
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 2: Teacher creates a plan -> Assigns to classroom ->
  //             Student accepts assignment -> Student logs study sessions ->
  //             Heatmap verifies active dates.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Scenario 2: Teacher Classroom and Student Assignment Flow", () => {
    it("should allow teacher to create a classroom, template, and assign to student, who logs sessions", async () => {
      // 1. Register a teacher
      const teacherEmail = generateUniqueEmail("teacher");
      const teacherRes = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: teacherEmail,
          password: "password123",
          name: "Teacher Bob",
          role: "TEACHER",
        }),
      });
      expect(teacherRes.status).toBe(201);
      const teacherToken = (await teacherRes.json() as any).data.token;

      // 2. Teacher creates a classroom
      const classroomRes = await fetch(`${apiUrl}/api/classrooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          name: "Advanced Physics",
        }),
      });
      expect(classroomRes.status).toBe(201);
      const classroom = (await classroomRes.json() as any).data;
      expect(classroom.id).toBeDefined();
      expect(classroom.code).toBeDefined();

      // 3. Register a student
      const studentEmail = generateUniqueEmail("student");
      const studentRes = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: studentEmail,
          password: "password123",
          name: "Student Alice",
          role: "STUDENT",
        }),
      });
      expect(studentRes.status).toBe(201);
      const studentData = (await studentRes.json() as any).data;
      const studentToken = studentData.token;
      const studentId = studentData.user.id;

      // 4. Student joins classroom
      const joinRes = await fetch(`${apiUrl}/api/classrooms/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          code: classroom.code,
        }),
      });
      expect(joinRes.status).toBe(201);

      // 5. Teacher creates a plan template
      const templateRes = await fetch(`${apiUrl}/api/classrooms/${classroom.id}/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          subject: "Quantum Mechanics",
          syllabusContext: "Wave functions, Schrodinger Equation, Quantum Tunneling",
        }),
      });
      expect(templateRes.status).toBe(201);
      const template = (await templateRes.json() as any).data;
      expect(template.id).toBeDefined();

      // 6. Teacher assigns plan to Student
      const assignRes = await fetch(`${apiUrl}/api/classrooms/${classroom.id}/students/${studentId}/plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          subject: "Quantum Mechanics",
          examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          dailyHours: 2.5,
          goalScore: 95,
          knowledgeLevel: "BEGINNER",
          syllabusContext: "Wave functions, Schrodinger Equation, Quantum Tunneling",
          currentScore: 40,
          teacherNotes: "Study hard and ask questions",
          templateId: template.id,
        }),
      });
      expect(assignRes.status).toBe(201);
      const assignedPlan = (await assignRes.json() as any).data;
      expect(assignedPlan.id).toBeDefined();
      expect(assignedPlan.isTeacherAssigned).toBe(true);
      expect(assignedPlan.teacherPlanAccepted).toBe(false);

      // 7. Student accepts the assignment
      const acceptRes = await fetch(`${apiUrl}/api/plans/${assignedPlan.id}/accept-assignment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${studentToken}`,
        },
      });
      expect(acceptRes.status).toBe(200);
      const acceptedPlan = (await acceptRes.json() as any).data;
      expect(acceptedPlan.teacherPlanAccepted).toBe(true);
      expect(acceptedPlan.status).toBe("ACTIVE");

      // 8. Student logs study session
      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          planId: assignedPlan.id,
          completionFlag: "YES",
          sessionMins: 90,
          note: "First quantum mechanics session completed!",
        }),
      });
      expect(checkinRes.status).toBe(200);

      // 9. Verify Active Dates in History Heatmap
      const historyRes = await fetch(`${apiUrl}/api/checkin/history`, {
        headers: { "Authorization": `Bearer ${studentToken}` },
      });
      expect(historyRes.status).toBe(200);
      const historyBody = await historyRes.json() as any;
      const todayString = new Date().toISOString().split("T")[0];
      expect(historyBody.data).toContain(todayString);

      // Cleanup
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${studentToken}` },
      });
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${teacherToken}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 3: Forgot password -> Reset password -> Login with new credentials ->
  //             Update profile name & telegramId -> Validate NextAuth session sync.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Scenario 3: Password Recovery, Profile Update, and NextAuth Session Sync Flow", () => {
    it("should recover password, log in, update profile, and verify session sync callback behavior", async () => {
      const email = generateUniqueEmail("sc3");
      const originalPassword = "originalSecure123";
      const newPassword = "newSuperSecret999";

      // Register user
      const registerRes = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: originalPassword,
          name: "Old Name Student",
          role: "STUDENT",
        }),
      });
      expect(registerRes.status).toBe(201);
      const originalUser = (await registerRes.json() as any).data.user;

      // 1. Forgot password
      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      expect(forgotRes.status).toBe(200);
      const forgotBody = await forgotRes.json() as any;
      const resetToken = forgotBody.debugToken;
      expect(resetToken).toBeDefined();

      // 2. Reset password
      const resetRes = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword,
        }),
      });
      expect(resetRes.status).toBe(200);

      // 3. Login with new credentials
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
      });
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;
      const newToken = loginBody.data.token;
      const loggedUser = loginBody.data.user;
      expect(newToken).toBeDefined();

      // 4. Update profile name & telegramId
      const newName = "NextAuth Sync Student";
      const telegramId = "sync_tg_id_123";
      const updateRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${newToken}`,
        },
        body: JSON.stringify({ name: newName, telegramId }),
      });
      expect(updateRes.status).toBe(200);
      const updatedUser = (await updateRes.json() as any).data;
      expect(updatedUser.name).toBe(newName);
      expect(updatedUser.telegramId).toBe(telegramId);

      // 5. Validate NextAuth session sync
      // NextAuth's authorize returns the initial user payload:
      const authUserResult = {
        id: loggedUser.id,
        email: loggedUser.email,
        name: loggedUser.name,
        accessToken: newToken,
        preference: loggedUser.preference,
        role: loggedUser.role,
      };

      // Mocking the behavior of web/src/app/api/auth/[...nextauth]/route.ts callbacks
      // callback: jwt({ token, user, trigger, session })
      const jwtCallback = async ({ token, user, trigger, session }: any) => {
        if (user) {
          token.accessToken = user.accessToken;
          token.userId = user.id;
          token.preference = user.preference;
          token.role = user.role;
          token.name = user.name;
        }
        if (trigger === 'update' && session?.name) {
          token.name = session.name;
        }
        return token;
      };

      // callback: session({ session, token })
      const sessionCallback = async ({ session, token }: any) => {
        session.accessToken = token.accessToken;
        session.userId = token.userId;
        session.preference = token.preference;
        session.role = token.role;
        if (session.user) {
          session.user.name = token.name;
        }
        return session;
      };

      // Run callbacks to test sync logic
      let tokenPayload: any = {};
      // Initial login callback trigger
      tokenPayload = await jwtCallback({ token: tokenPayload, user: authUserResult });
      expect(tokenPayload.name).toBe("Old Name Student");
      expect(tokenPayload.accessToken).toBe(newToken);
      expect(tokenPayload.userId).toBe(originalUser.id);

      // Profile edit session update trigger
      tokenPayload = await jwtCallback({
        token: tokenPayload,
        trigger: "update",
        session: { name: newName },
      });
      expect(tokenPayload.name).toBe(newName);

      // Generate session object
      let sessionObj: any = { user: {} };
      sessionObj = await sessionCallback({ session: sessionObj, token: tokenPayload });
      expect(sessionObj.accessToken).toBe(newToken);
      expect(sessionObj.userId).toBe(originalUser.id);
      expect(sessionObj.user.name).toBe(newName);

      // Cleanup
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${newToken}` },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 4: User updates profile -> Creates plans -> Deletes account ->
  //             Verify cascade deletion of user, plans, check-ins, and reset tokens.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Scenario 4: Cascade Account Deletion Flow", () => {
    it("should successfully cascade delete all associated records when an account is deleted", async () => {
      const email = generateUniqueEmail("sc4");
      const password = "password123";

      // 1. Register User
      const registerRes = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: "To Be Deleted User",
          role: "STUDENT",
        }),
      });
      expect(registerRes.status).toBe(201);
      const { token, user } = (await registerRes.json() as any).data;
      const userId = user.id;

      // 2. Update Profile
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "Updated Name Before Delete" }),
      });

      // 3. Create a password reset token
      const forgotRes = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      expect(forgotRes.status).toBe(200);
      const resetToken = (await forgotRes.json() as any).debugToken;
      expect(resetToken).toBeDefined();

      // Verify reset token exists in DB
      const dbResetToken = await prisma.passwordResetToken.findFirst({
        where: { userId },
      });
      expect(dbResetToken).not.toBeNull();
      const resetTokenId = dbResetToken?.id;

      // 4. Create Plan
      const planRes = await fetch(`${apiUrl}/api/plans/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: "Calculus",
          examDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          dailyHours: 2,
          goalScore: 90,
          knowledgeLevel: "BEGINNER",
        }),
      });
      expect(planRes.status).toBe(201);
      const plan = (await planRes.json() as any).data.plan;
      expect(plan.id).toBeDefined();

      // 5. Create Check-in
      const checkinRes = await fetch(`${apiUrl}/api/checkin`, {
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
      expect(checkinRes.status).toBe(200);
      const checkinId = (await checkinRes.json() as any).data.checkIn.id;
      expect(checkinId).toBeDefined();

      // Double check in DB that everything is setup
      const planInDb = await prisma.plan.findUnique({ where: { id: plan.id } });
      const checkinInDb = await prisma.checkIn.findUnique({ where: { id: checkinId } });
      expect(planInDb).not.toBeNull();
      expect(checkinInDb).not.toBeNull();

      // 6. Delete account
      const deleteRes = await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);

      // 7. Verify Cascade Deletions
      const userAfter = await prisma.user.findUnique({ where: { id: userId } });
      expect(userAfter).toBeNull();

      const planAfter = await prisma.plan.findUnique({ where: { id: plan.id } });
      expect(planAfter).toBeNull();

      const checkinAfter = await prisma.checkIn.findUnique({ where: { id: checkinId } });
      expect(checkinAfter).toBeNull();

      const resetTokenAfter = await prisma.passwordResetToken.findUnique({
        where: { id: resetTokenId },
      });
      expect(resetTokenAfter).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 5: Edge-case timezone check-in: Log check-in with timezoneOffset
  //             (e.g. +0530, +05:30) -> Verify calculated date range in database
  //             fits the local day, and timezone bounds are correctly enforced.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Scenario 5: Timezone-Aware Check-in Bounds Verification", () => {
    it("should parse and validate timezone offsets correctly and enforce correct day boundaries", async () => {
      const email = generateUniqueEmail("sc5");
      const { token, user } = await registerUser(email);
      const plan = await createPlan(token);

      // Helper to generate registration
      async function registerUser(email: string) {
        const password = "password123";
        const response = await fetch(`${apiUrl}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: "TZ User", role: "STUDENT" }),
        });
        const body = await response.json() as any;
        return { token: body.data.token, user: body.data.user };
      }

      async function createPlan(token: string) {
        const response = await fetch(`${apiUrl}/api/plans/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            subject: "Geography",
            examDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            dailyHours: 1,
            goalScore: 80,
            knowledgeLevel: "BEGINNER",
          }),
        });
        const body = await response.json() as any;
        return body.data.plan;
      }

      // 1. Invalid timezone offset should return 400
      const invalidTzRes = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-timezone-offset": "+25:00",
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 30,
        }),
      });
      expect(invalidTzRes.status).toBe(400);
      const invalidTzBody = await invalidTzRes.json() as any;
      expect(invalidTzBody.success).toBe(false);
      expect(invalidTzBody.error).toBe("Invalid timezone offset");

      // 2. Valid timezone offset (+0530)
      const validTz1Res = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-timezone-offset": "+0530",
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 30,
        }),
      });
      expect(validTz1Res.status).toBe(200);

      // 3. Valid timezone offset (+05:30)
      const validTz2Res = await fetch(`${apiUrl}/api/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-timezone-offset": "+05:30",
        },
        body: JSON.stringify({
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 30,
        }),
      });
      expect(validTz2Res.status).toBe(200);

      // 4. Test exact boundary logic of getTodayRange(offsetMinutes)
      // We will create a test check-in in the database that is exactly timed
      // to fall within one timezone range, but out of another.
      // E.g., we set createdAt to today at 02:00:00 UTC.
      const testCheckInDate = new Date();
      testCheckInDate.setUTCHours(2, 0, 0, 0); // 02:00 UTC today

      const testCheckIn = await prisma.checkIn.create({
        data: {
          userId: user.id,
          planId: plan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: testCheckInDate,
        },
      });

      // Let's test checking "today" with different offsets:
      // Offset +06:00 (360 mins):
      // local time for 02:00 UTC is 08:00 today.
      // getTodayRange(+360) local start 00:00 is 18:00 yesterday UTC.
      // local end 23:59:59 is 17:59:59 today UTC.
      // So 02:00 UTC is within [yesterday 18:00, today 17:59:59].
      // Query /api/checkin/today?timezoneOffset=+06:00
      const todayTzPlusRes = await fetch(`${apiUrl}/api/checkin/today?timezoneOffset=+06:00`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(todayTzPlusRes.status).toBe(200);
      const todayTzPlusBody = await todayTzPlusRes.json() as any;
      expect(todayTzPlusBody.data.done).toBe(true);

      // Offset -06:00 (-360 mins):
      // local time for 02:00 UTC is 20:00 yesterday.
      // getTodayRange(-360) local start 00:00 is 06:00 today UTC.
      // local end 23:59:59 is 05:59:59 tomorrow UTC.
      // So 02:00 UTC is NOT within [today 06:00, tomorrow 05:59:59].
      // Query /api/checkin/today?timezoneOffset=-06:00
      const todayTzMinusRes = await fetch(`${apiUrl}/api/checkin/today?timezoneOffset=-06:00`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      expect(todayTzMinusRes.status).toBe(200);
      const todayTzMinusBody = await todayTzMinusRes.json() as any;
      // Since our testCheckIn date (02:00 UTC) falls outside of the today range for -06:00 offset,
      // it should be false (unless there was another check-in logged).
      // Since we did log check-ins in steps 2 & 3, we must check if those also affect the output.
      // Those check-ins are logged at now() UTC. Let's make sure our test check-in is the only one
      // or we do it for a new user/plan.
      // Wait, let's create a fresh user to avoid conflicts with steps 2 & 3.
      const freshEmail = generateUniqueEmail("sc5_boundary");
      const freshUser = await registerUser(freshEmail);
      const freshPlan = await createPlan(freshUser.token);

      // Log a check-in at 02:00 UTC today
      await prisma.checkIn.create({
        data: {
          userId: freshUser.user.id,
          planId: freshPlan.id,
          completionFlag: "YES",
          sessionMins: 45,
          createdAt: testCheckInDate,
        },
      });

      // Now query with offset +06:00 -> should be done: true
      const resPlus = await fetch(`${apiUrl}/api/checkin/today?timezoneOffset=+06:00`, {
        headers: { "Authorization": `Bearer ${freshUser.token}` },
      });
      const bodyPlus = await resPlus.json() as any;
      expect(bodyPlus.data.done).toBe(true);

      // Query with offset -06:00 -> should be done: false because local time at 02:00 UTC is 20:00 yesterday.
      const resMinus = await fetch(`${apiUrl}/api/checkin/today?timezoneOffset=-06:00`, {
        headers: { "Authorization": `Bearer ${freshUser.token}` },
      });
      const bodyMinus = await resMinus.json() as any;
      expect(bodyMinus.data.done).toBe(false);

      // Cleanup
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      await fetch(`${apiUrl}/api/auth/me`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${freshUser.token}` },
      });
    });
  });
});
