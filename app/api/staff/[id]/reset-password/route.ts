import {
  access,
  fail,
  db,
  users,
  eq,
  id,
  hashPassword,
  newTemporaryPassword,
  addAudit,
} from "@/lib/staff-api";
import { sessions } from "@/db/schema";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await access(req, ["owner"]);
  if ("response" in auth) return auth.response;
  const { id: target } = await params;
  const temporaryPassword = newTemporaryPassword();
  const ok = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      })
      .where(eq(users.id, target))
      .returning();
    if (!u || u.role !== "staff") return false;
    await tx.delete(sessions).where(eq(sessions.userId, target));
    await tx
      .insert((await import("@/db/schema")).auditLog)
      .values({
        id: id(),
        actorId: auth.user.id,
        action: "staff.password_reset",
        detail: target,
      });
    return true;
  });
  if (!ok) return fail("Staff account not found", 404);
  return Response.json({ temporaryPassword });
}
