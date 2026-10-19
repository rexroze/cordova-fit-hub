import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  attendance,
  members,
  memberships,
  payments,
  eq,
  id,
  manilaToday,
} from "@/lib/staff-api";
const input = z.object({
  code: z.string().trim().min(1).max(200),
  method: z.enum(["qr", "manual"]),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const [member] = await db
    .select()
    .from(members)
    .where(
      parsed.data.method === "qr"
        ? eq(members.qrToken, parsed.data.code)
        : eq(members.memberCode, parsed.data.code),
    )
    .limit(1);
  if (!member) return fail("Member not found", 404);
  const today = manilaToday();
  const ms = await db
    .select()
    .from(memberships)
    .where(eq(memberships.memberId, member.id));
  const paymentsByMembership = await db
    .select()
    .from(payments)
    .where(eq(payments.memberId, member.id));
  const active = ms.find(
    (m) =>
      m.startsAt <= today &&
      m.expiresAt > today &&
      paymentsByMembership
        .filter((p) => p.membershipId === m.id)
        .reduce((a, p) => a + p.amountCents, 0) >= m.priceCents,
  );
  if (!active) return fail("No active fully paid membership", 409);
  try {
    const [row] = await db
      .insert(attendance)
      .values({
        id: id(),
        memberId: member.id,
        manilaDate: today,
        method: parsed.data.method,
      })
      .returning();
    return Response.json(
      {
        attendance: {
          id: row.id,
          memberId: row.memberId,
          checkedInAt: row.checkedInAt.toISOString(),
          method: row.method,
        },
        member: {
          id: member.id,
          memberCode: member.memberCode,
          name: member.name,
        },
        message: "Check-in successful",
      },
      { status: 201 },
    );
  } catch {
    return fail("Already checked in today", 409);
  }
}
