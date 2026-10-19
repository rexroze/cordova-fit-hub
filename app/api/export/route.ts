import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendance, members, payments } from "@/db/schema";
import { authorize, fail } from "@/lib/http";
const safe = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replaceAll('"', '""')}"`;
};
export async function GET(req: Request) {
  const auth = await authorize(["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const type = new URL(req.url).searchParams.get("type");
  if (!["members", "payments", "attendance"].includes(type ?? ""))
    return fail("Invalid export type");
  let header: string[], rows: unknown[][];
  if (type === "members") {
    header = ["memberCode", "name", "email", "phone", "source", "createdAt"];
    rows = (await db.select().from(members)).map((x) => [
      x.memberCode,
      x.name,
      x.email,
      x.phone,
      x.source,
      x.createdAt.toISOString(),
    ]);
  } else if (type === "payments") {
    header = [
      "memberId",
      "membershipId",
      "amount",
      "method",
      "reference",
      "paidAt",
    ];
    rows = (await db.select().from(payments)).map((x) => [
      x.memberId,
      x.membershipId,
      x.amountCents / 100,
      x.method,
      x.reference,
      x.paidAt.toISOString(),
    ]);
  } else {
    header = ["memberId", "checkedInAt", "method"];
    rows = (await db.select().from(attendance)).map((x) => [
      x.memberId,
      x.checkedInAt.toISOString(),
      x.method,
    ]);
  }
  return new Response(
    [header, ...rows].map((r) => r.map(safe).join(",")).join("\r\n"),
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${type}.csv"`,
      },
    },
  );
}
