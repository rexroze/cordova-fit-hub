import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attendance,
  members,
  memberships,
  payments,
  plans,
  users,
  auditLog,
} from "@/db/schema";
import { authorize, body, fail, id, originAllowed } from "@/lib/http";
import { addMonthsClamped, manilaToday } from "@/lib/dates";
import { pesosToCents } from "@/lib/money";
import { hashPassword, newTemporaryPassword } from "@/lib/auth";
import { createHash, randomBytes } from "node:crypto";
export async function access(req: Request, roles: ("owner" | "staff")[]) {
  if (!originAllowed(req)) return { response: fail("Invalid origin", 403) };
  return authorize(roles);
}
export const addAudit = async (
  actorId: string,
  action: string,
  detail: string,
) => db.insert(auditLog).values({ id: id(), actorId, action, detail });
export async function createMember(
  data: {
    name: string;
    email: string;
    phone: string;
    source: string;
    planId?: string;
    amountPaid?: number;
    paymentMethod?: string;
    reference?: string;
  },
  actorId: string,
) {
  const memberId = id(),
    code = "CFH-" + randomBytes(4).toString("hex").toUpperCase();
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(members)
      .values({
        id: memberId,
        memberCode: code,
        name: data.name,
        email: data.email.trim().toLowerCase(),
        phone: data.phone,
        source: data.source,
        qrToken: randomBytes(32).toString("base64url"),
      })
      .returning();
    await tx
      .insert(users)
      .values({
        id: id(),
        name: data.name,
        email: data.email.trim().toLowerCase(),
        phone: data.phone,
        passwordHash: await hashPassword(data.phone),
        role: "member",
        memberId,
        mustChangePassword: true,
      });
    const amount = data.amountPaid ?? 0;
    if (!data.planId && amount > 0)
      throw new Error("A plan is required for payment");
    if (data.planId) {
      const plan = (
        await tx
          .select()
          .from(plans)
          .where(and(eq(plans.id, data.planId), eq(plans.active, true)))
          .limit(1)
      )[0];
      if (!plan) throw new Error("Plan not found");
      const cents = amount === 0 ? 0 : pesosToCents(amount);
      if (cents > plan.priceCents)
        throw new Error("Payment exceeds plan price");
      const start = manilaToday();
      const expires = addMonthsClamped(start, plan.durationMonths);
      const [membership] = await tx
        .insert(memberships)
        .values({
          id: id(),
          memberId,
          planId: plan.id,
          startsAt: start,
          expiresAt: expires,
          priceCents: plan.priceCents,
        })
        .returning();
      if (cents)
        await tx
          .insert(payments)
          .values({
            id: id(),
            memberId,
            membershipId: membership.id,
            amountCents: cents,
            method: data.paymentMethod ?? "cash",
            reference: data.reference,
            recordedBy: actorId,
          });
    }
    return {
      id: m.id,
      memberCode: m.memberCode,
      name: m.name,
      email: m.email,
      phone: m.phone,
      source: m.source,
      createdAt: m.createdAt.toISOString(),
    };
  });
}
export {
  z,
  db,
  attendance,
  members,
  memberships,
  payments,
  plans,
  users,
  auditLog,
  body,
  fail,
  id,
  addMonthsClamped,
  manilaToday,
  pesosToCents,
  hashPassword,
  newTemporaryPassword,
  createHash,
  randomBytes,
  eq,
  and,
};
