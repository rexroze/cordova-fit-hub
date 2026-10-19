import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import {
  createSession,
  currentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { body, fail, originAllowed } from "@/lib/http";

const input = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(10)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
});

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail("Invalid origin", 403);
  const user = await currentUser();
  if (!user) return fail("Authentication required", 401);
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (
    !row ||
    !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))
  ) {
    return fail("Current password is incorrect", 400, {
      currentPassword: ["Current password is incorrect"],
    });
  }
  if (
    row.phone &&
    parsed.data.newPassword.toLowerCase().includes(row.phone.toLowerCase())
  ) {
    return fail("Password must not contain your phone number", 400, {
      newPassword: ["Must not contain your phone number"],
    });
  }
  if (await verifyPassword(parsed.data.newPassword, row.passwordHash)) {
    return fail("Choose a password different from your current password", 400);
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  // Rotate the current session after revoking all prior sessions, including this one.
  await createSession(user.id);
  return Response.json({ user: { ...user, mustChangePassword: false } });
}
