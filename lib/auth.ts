import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import type { Role, SessionUser } from "@/lib/contracts";
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);
export const normalizeEmail = (s: string) => s.trim().toLowerCase();
export const newTemporaryPassword = () => randomBytes(18).toString("base64url");
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db
    .insert(sessions)
    .values({
      id: randomBytes(16).toString("hex"),
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
  (await cookies()).set("cfh_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get("cfh_session")?.value;
  if (!token) return null;
  const rows = await db
    .select({ u: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, digest(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.active, true),
      ),
    )
    .limit(1);
  const u = rows[0]?.u;
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    mustChangePassword: u.mustChangePassword,
    ...(u.memberId ? { memberId: u.memberId } : {}),
  };
}
export async function deleteCurrentSession() {
  const token = (await cookies()).get("cfh_session")?.value;
  if (token)
    await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  (await cookies()).delete("cfh_session");
}
