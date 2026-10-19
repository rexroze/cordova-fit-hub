import { z } from "zod";
import { access, body, fail, db, members, eq } from "@/lib/staff-api";
const input = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30),
  source: z.string().trim().min(1).max(80),
});
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const { id } = await params;
  const [member] = await db
    .update(members)
    .set(parsed.data)
    .where(eq(members.id, id))
    .returning();
  if (!member) return fail("Member not found", 404);
  return Response.json({
    member: { ...member, createdAt: member.createdAt.toISOString() },
  });
}
