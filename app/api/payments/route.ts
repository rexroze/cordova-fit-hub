import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  payments,
  memberships,
  eq,
  id,
  pesosToCents,
} from "@/lib/staff-api";
const input = z.object({
  memberId: z.string(),
  membershipId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["cash", "gcash", "bank_transfer"]),
  reference: z.string().max(120).optional(),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  try {
    const payment = await db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(memberships)
        .where(eq(memberships.id, parsed.data.membershipId))
        .for("update")
        .limit(1);
      if (!m || m.memberId !== parsed.data.memberId)
        throw new Error("Membership not found");
      const existing = await tx
        .select()
        .from(payments)
        .where(eq(payments.membershipId, m.id));
      const amount = pesosToCents(parsed.data.amount);
      const balance =
        m.priceCents - existing.reduce((a, p) => a + p.amountCents, 0);
      if (amount > balance)
        throw new Error("Payment exceeds remaining balance");
      const [p] = await tx
        .insert(payments)
        .values({
          id: id(),
          memberId: m.memberId,
          membershipId: m.id,
          amountCents: amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          recordedBy: auth.user.id,
        })
        .returning();
      return {
        id: p.id,
        memberId: p.memberId,
        membershipId: p.membershipId,
        amount: p.amountCents / 100,
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt.toISOString(),
        recordedBy: p.recordedBy,
      };
    });
    return Response.json({ payment }, { status: 201 });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Payment failed", 400);
  }
}
