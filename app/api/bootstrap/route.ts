import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  auditLog,
  attendance,
  members,
  memberships,
  payments,
  plans,
  users,
} from "@/db/schema";
import { db } from "@/lib/db";
import { forecastRevenue } from "@/lib/analytics";
import { manilaToday } from "@/lib/dates";
import { authorize } from "@/lib/http";
import type { Analytics, Membership } from "@/lib/contracts";

const zone = "Asia/Manila";
function manilaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await authorize(["owner", "staff", "member"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const memberOnly = user.role === "member";
  const isOwner = user.role === "owner";
  const allMembers = memberOnly
    ? await db
        .select()
        .from(members)
        .where(eq(members.id, user.memberId ?? ""))
    : await db.select().from(members);
  const memberIds = allMembers.map((member) => member.id);
  const memberMemberships = memberIds.length
    ? await db
        .select()
        .from(memberships)
        .where(memberOnly ? eq(memberships.memberId, memberIds[0]) : undefined)
    : [];
  const [allPlans, rawPayments, rawAttendance, staffRows, auditRows] =
    await Promise.all([
      db.select().from(plans),
      memberIds.length
        ? db
            .select()
            .from(payments)
            .where(memberOnly ? eq(payments.memberId, memberIds[0]) : undefined)
        : Promise.resolve([]),
      memberIds.length
        ? db
            .select()
            .from(attendance)
            .where(
              memberOnly ? eq(attendance.memberId, memberIds[0]) : undefined,
            )
        : Promise.resolve([]),
      isOwner
        ? db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
              mustChangePassword: users.mustChangePassword,
              memberId: users.memberId,
            })
            .from(users)
            .where(and(eq(users.active, true), lte(users.role, "staff")))
        : Promise.resolve([]),
      isOwner
        ? db
            .select()
            .from(auditLog)
            .orderBy(desc(auditLog.createdAt))
            .limit(100)
        : Promise.resolve([]),
    ]);
  // Explicit role filtering avoids leaking member account rows through the owner-only roster.
  const staff = staffRows
    .filter((row) => row.role === "owner" || row.role === "staff")
    .map((row) => ({ ...row, role: row.role as "owner" | "staff" }));
  const memberOutput = allMembers.map(({ qrToken, createdAt, ...member }) => ({
    ...member,
    createdAt: createdAt.toISOString(),
    ...(memberOnly ? { qrToken } : {}),
  }));
  const paidByMembership = new Map<string, number>();
  for (const payment of rawPayments)
    paidByMembership.set(
      payment.membershipId,
      (paidByMembership.get(payment.membershipId) ?? 0) + payment.amountCents,
    );
  const today = manilaToday();
  const normalizedMemberships: Membership[] = memberMemberships.map(
    (membership) => {
      const paidAmountCents = paidByMembership.get(membership.id) ?? 0;
      const status =
        membership.startsAt > today
          ? "upcoming"
          : membership.expiresAt <= today
            ? "expired"
            : paidAmountCents < membership.priceCents
              ? "unpaid"
              : "active";
      return {
        id: membership.id,
        memberId: membership.memberId,
        planId: membership.planId,
        startsAt: membership.startsAt,
        expiresAt: membership.expiresAt,
        price: membership.priceCents / 100,
        paidAmount: paidAmountCents / 100,
        status,
      };
    },
  );
  const membersById = new Map(allMembers.map((member) => [member.id, member]));
  const currentMemberships = new Map<string, Membership>();
  for (const membership of normalizedMemberships) {
    if (membership.status !== "active" && membership.status !== "unpaid")
      continue;
    const current = currentMemberships.get(membership.memberId);
    if (!current || membership.expiresAt > current.expiresAt)
      currentMemberships.set(membership.memberId, membership);
  }
  const currentMonth = today.slice(0, 7);
  const revenueByMonth = new Map<string, number>();
  for (const payment of rawPayments) {
    const month = manilaDate(payment.paidAt).slice(0, 7);
    revenueByMonth.set(
      month,
      (revenueByMonth.get(month) ?? 0) + payment.amountCents,
    );
  }
  const revenueSeries = Array.from({ length: 9 }, (_, index) =>
    shiftMonth(currentMonth, index - 8),
  ).map((month) => ({
    month,
    revenue: (revenueByMonth.get(month) ?? 0) / 100,
  }));
  const earliestPaymentMonth = rawPayments.length
    ? rawPayments.reduce(
        (earliest, payment) =>
          manilaDate(payment.paidAt).slice(0, 7) < earliest
            ? manilaDate(payment.paidAt).slice(0, 7)
            : earliest,
        currentMonth,
      )
    : currentMonth;
  const observedCompletedMonths = revenueSeries
    .slice(0, -1)
    .filter(
      (row) => row.month >= earliestPaymentMonth && row.month < currentMonth,
    )
    .map((row) => Math.round(row.revenue * 100));
  const revenueCentsCompleted = observedCompletedMonths.slice(-3);
  const visitsByDay = new Map<string, number>();
  for (const visit of rawAttendance)
    visitsByDay.set(
      visit.manilaDate,
      (visitsByDay.get(visit.manilaDate) ?? 0) + 1,
    );
  const attendanceSeries = Array.from({ length: 30 }, (_, index) =>
    shiftDay(today, index - 29),
  ).map((date) => ({ date, visits: visitsByDay.get(date) ?? 0 }));
  const planNames = new Map(allPlans.map((plan) => [plan.id, plan.name]));
  const planCounts = new Map<string, number>();
  for (const membership of currentMemberships.values()) {
    if (membership.status !== "active") continue;
    const name = planNames.get(membership.planId) ?? "Unknown plan";
    planCounts.set(name, (planCounts.get(name) ?? 0) + 1);
  }
  const sourceCounts = new Map<string, number>();
  for (const member of allMembers)
    sourceCounts.set(member.source, (sourceCounts.get(member.source) ?? 0) + 1);
  const completedMonth = shiftMonth(currentMonth, -1);
  const currentRevenue = rawPayments
    .filter(
      (payment) => manilaDate(payment.paidAt).slice(0, 7) === currentMonth,
    )
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const daysToExpiry = shiftDay(today, 7);
  const recommendations: Analytics["recommendations"] = [];
  const expiring = normalizedMemberships.filter(
    (membership) =>
      (membership.status === "active" || membership.status === "unpaid") &&
      membership.expiresAt > today &&
      membership.expiresAt <= daysToExpiry,
  ).length;
  if (expiring)
    recommendations.push({
      title: "Follow up on upcoming expirations",
      description: `${expiring} current membership${expiring === 1 ? " expires" : "s expire"} within seven days.`,
      severity: "warning",
    });
  const atRisk = allMembers.filter((member) => {
    const current = currentMemberships.get(member.id);
    if (!current) return false;
    const recent = rawAttendance.filter(
      (visit) =>
        visit.memberId === member.id &&
        visit.manilaDate >= shiftDay(today, -14) &&
        visit.manilaDate < today,
    ).length;
    const preceding = rawAttendance.filter(
      (visit) =>
        visit.memberId === member.id &&
        visit.manilaDate >= shiftDay(today, -28) &&
        visit.manilaDate < shiftDay(today, -14),
    ).length;
    return preceding >= 2 && recent * 2 < preceding;
  }).length;
  if (atRisk)
    recommendations.push({
      title: "Reconnect with less-active members",
      description: `${atRisk} currently covered member${atRisk === 1 ? " has" : "s have"} at least two visits in the prior 14 days and less than half as many in the latest 14 days.`,
      severity: "warning",
    });
  const planPerformance = [...planCounts.entries()].sort((a, b) => a[1] - b[1]);
  if (
    planPerformance.length > 1 &&
    planPerformance[0][1] <
      Math.max(
        2,
        Math.ceil([...planCounts.values()].reduce((a, b) => a + b, 0) * 0.1),
      )
  )
    recommendations.push({
      title: "Review plan uptake",
      description: `${planPerformance[0][0]} has the fewest current members (${planPerformance[0][1]}); compare its value and promotion with higher-uptake plans.`,
      severity: "info",
    });
  const sourcePerformance = [...sourceCounts.entries()].sort(
    (a, b) => a[1] - b[1],
  );
  if (
    sourcePerformance.length > 1 &&
    sourcePerformance[0][1] < Math.max(2, Math.ceil(allMembers.length * 0.1))
  )
    recommendations.push({
      title: "Review acquisition channels",
      description: `${sourcePerformance[0][0]} has the fewest recorded members (${sourcePerformance[0][1]}); evaluate channel reach before reallocating effort.`,
      severity: "info",
    });
  const mostRecentByMember = new Map<string, Membership>();
  for (const membership of normalizedMemberships) {
    const latest = mostRecentByMember.get(membership.memberId);
    if (!latest || membership.expiresAt > latest.expiresAt)
      mostRecentByMember.set(membership.memberId, membership);
  }
  const expiredMembers = [...mostRecentByMember.values()].filter(
    (membership) => membership.status === "expired",
  ).length;
  const historicalExpired = normalizedMemberships.filter(
    (membership) =>
      membership.status === "expired" && membership.expiresAt <= today,
  );
  const renewalSamples = historicalExpired.filter((membership) =>
    normalizedMemberships.some(
      (later) =>
        later.memberId === membership.memberId &&
        later.startsAt >= membership.expiresAt &&
        later.startsAt <= today,
    ),
  );
  const renewalRate = historicalExpired.length
    ? renewalSamples.length / historicalExpired.length
    : null;
  const upcomingEligible = [...currentMemberships.values()].filter(
    (membership) =>
      membership.status === "active" &&
      membership.expiresAt > today &&
      membership.expiresAt <= shiftDay(today, 30),
  ).length;

  const analytics: Analytics | null = memberOnly
    ? null
    : {
        metrics: {
          totalMembers: allMembers.length,
          activeMemberships: [...currentMemberships.values()].filter(
            (membership) => membership.status === "active",
          ).length,
          monthlyRevenue: currentRevenue / 100,
          todayAttendance: rawAttendance.filter(
            (visit) => visit.manilaDate === today,
          ).length,
          expiringMemberships: expiring,
          expiredMemberships: expiredMembers,
        },
        revenueSeries,
        attendanceSeries,
        planDistribution: [...planCounts].map(([name, members]) => ({
          name,
          members,
        })),
        sourceDistribution: [...sourceCounts].map(([name, members]) => ({
          name,
          members,
        })),
        forecast: {
          ...forecastRevenue(revenueCentsCompleted),
          explanation: `${forecastRevenue(revenueCentsCompleted).explanation} Current month (${currentMonth}) revenue is ₱${(currentRevenue / 100).toFixed(2)} so far; ${completedMonth} is the latest completed month.${renewalRate === null ? " Historical renewal estimate unavailable: no expired memberships in the available records." : ` Historical renewal estimate: ${Math.round(renewalRate * 100)}% (${renewalSamples.length} of ${historicalExpired.length} expired memberships had a later recorded membership); about ${Math.round(renewalRate * upcomingEligible)} renewals would be expected from ${upcomingEligible} current memberships expiring within 30 days. This is a historical estimate, not a guarantee.`}`,
        },
        recommendations,
      };
  normalizedMemberships.sort((a, b) => {
    const rank = (membership: Membership) =>
      membership.status === "active" || membership.status === "unpaid"
        ? 0
        : membership.status === "upcoming"
          ? 1
          : 2;
    return (
      rank(a) - rank(b) ||
      (rank(a) === 0
        ? b.expiresAt.localeCompare(a.expiresAt)
        : b.expiresAt.localeCompare(a.expiresAt))
    );
  });
  const paymentsOutput = rawPayments
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .map((payment) => ({
      id: payment.id,
      memberId: payment.memberId,
      membershipId: payment.membershipId,
      amount: payment.amountCents / 100,
      method: payment.method as "cash" | "gcash" | "bank_transfer",
      ...(payment.reference ? { reference: payment.reference } : {}),
      paidAt: payment.paidAt.toISOString(),
      recordedBy: payment.recordedBy,
    }));
  const attendanceOutput = rawAttendance
    .sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime())
    .map((visit) => ({
      id: visit.id,
      memberId: visit.memberId,
      checkedInAt: visit.checkedInAt.toISOString(),
      method: visit.method as "qr" | "manual",
    }));
  const plansOutput = allPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    durationMonths: plan.durationMonths,
    price: plan.priceCents / 100,
    active: plan.active,
  }));
  const auditOutput = auditRows.map(
    ({ id, actorId, action, detail, createdAt }) => ({
      id,
      actorId,
      action,
      detail,
      createdAt: createdAt.toISOString(),
    }),
  );
  return Response.json({
    user,
    members: memberOutput,
    plans: plansOutput,
    memberships: normalizedMemberships,
    payments: paymentsOutput,
    attendance: attendanceOutput,
    staff,
    analytics,
    ...(isOwner ? { auditLog: auditOutput } : {}),
    isDemo: true,
  });
}
