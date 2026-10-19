import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  members,
  memberships,
  payments,
  plans,
  eq,
  id,
  addMonthsClamped,
  manilaToday,
  pesosToCents,
} from "@/lib/staff-api";

const input = z.object({
  planId: z.string().min(1),
  amountPaid: z.number().nonnegative(),
  paymentMethod: z.enum(["cash", "gcash", "bank_transfer"]),
  reference: z.string().max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const { id: memberId } = await params;
  const data = parsed.data;
  const today = manilaToday();
  try {
    const result = await db.transaction(async (tx) => {
      // Serialize renewals for this member before inspecting the latest expiry.
      const [member] = await tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.id, memberId))
        .for("update")
        .limit(1);
      if (!member) throw new Error("Member not found");

      if (data.idempotencyKey) {
        const [prior] = await tx
          .select()
          .from(memberships)
          .where(eq(memberships.renewalKey, data.idempotencyKey))
          .limit(1);
        if (prior) {
          if (prior.memberId !== memberId || prior.planId !== data.planId) {
            throw new Error(
              "Idempotency key already used for a different renewal",
            );
          }
          const paid = await tx
            .select()
            .from(payments)
            .where(eq(payments.membershipId, prior.id));
          const paidAmount = paid.reduce(
            (sum, payment) => sum + payment.amountCents,
            0,
          );
          return {
            id: prior.id,
            memberId,
            planId: prior.planId,
            startsAt: prior.startsAt,
            expiresAt: prior.expiresAt,
            price: prior.priceCents / 100,
            paidAmount: paidAmount / 100,
            status:
              prior.startsAt > today
                ? "upcoming"
                : prior.expiresAt <= today
                  ? "expired"
                  : paidAmount >= prior.priceCents
                    ? "active"
                    : "unpaid",
          };
        }
      }

      const [plan] = await tx
        .select()
        .from(plans)
        .where(eq(plans.id, data.planId))
        .limit(1);
      if (!plan?.active) throw new Error("Active plan not found");
      const prior = await tx
        .select()
        .from(memberships)
        .where(eq(memberships.memberId, memberId));
      const latest =
        prior
          .map((item) => item.expiresAt)
          .sort()
          .at(-1) ?? today;
      const start = latest > today ? latest : today;
      const amount = data.amountPaid === 0 ? 0 : pesosToCents(data.amountPaid);
      if (amount > plan.priceCents) throw new Error("Payment exceeds balance");
      const [membership] = await tx
        .insert(memberships)
        .values({
          id: id(),
          memberId,
          planId: plan.id,
          startsAt: start,
          expiresAt: addMonthsClamped(start, plan.durationMonths),
          priceCents: plan.priceCents,
          renewalKey: data.idempotencyKey,
        })
        .returning();
      if (amount > 0) {
        await tx.insert(payments).values({
          id: id(),
          memberId,
          membershipId: membership.id,
          amountCents: amount,
          method: data.paymentMethod,
          reference: data.reference,
          recordedBy: auth.user.id,
        });
      }
      return {
        id: membership.id,
        memberId,
        planId: membership.planId,
        startsAt: membership.startsAt,
        expiresAt: membership.expiresAt,
        price: membership.priceCents / 100,
        paidAmount: amount / 100,
        status:
          start > today
            ? "upcoming"
            : amount === plan.priceCents
              ? "active"
              : "unpaid",
      };
    });
    return Response.json({ membership: result }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Renewal failed", 400);
  }
}
