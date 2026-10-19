import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { loginLimits, users } from "@/db/schema";
import { createSession, normalizeEmail, verifyPassword } from "@/lib/auth";
import { body, fail, originAllowed } from "@/lib/http";
export const runtime = "nodejs";
const input = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});
export async function POST(req: Request) {
  if (!originAllowed(req)) return fail("Invalid origin", 403);
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const email = normalizeEmail(parsed.data.email);
  const key = createHash("sha256").update(email).digest("hex");
  const now = new Date();
  const limit = (
    await db.select().from(loginLimits).where(eq(loginLimits.key, key)).limit(1)
  )[0];
  if (limit?.blockedUntil && limit.blockedUntil > now)
    return fail("Invalid email or password", 401);
  if (
    limit &&
    now.getTime() - limit.windowStartedAt.getTime() < 15 * 60_000 &&
    limit.attempts >= 10
  )
    return fail("Invalid email or password", 401);
  const user = (
    await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.active, true)))
      .limit(1)
  )[0];
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;
  if (!valid) {
    const count =
      limit && now.getTime() - limit.windowStartedAt.getTime() < 15 * 60_000
        ? limit.attempts + 1
        : 1;
    await db
      .insert(loginLimits)
      .values({
        key,
        attempts: count,
        windowStartedAt: count === 1 ? now : limit!.windowStartedAt,
        blockedUntil:
          count >= 10 ? new Date(now.getTime() + 15 * 60_000) : null,
      })
      .onConflictDoUpdate({
        target: loginLimits.key,
        set: {
          attempts: count,
          windowStartedAt: count === 1 ? now : limit!.windowStartedAt,
          blockedUntil:
            count >= 10 ? new Date(now.getTime() + 15 * 60_000) : null,
        },
      });
    return fail("Invalid email or password", 401);
  }
  await db.delete(loginLimits).where(eq(loginLimits.key, key));
  await createSession(user.id);
  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      ...(user.memberId ? { memberId: user.memberId } : {}),
    },
  });
}
