import { parse } from "csv-parse/sync";
import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  users,
  members,
  id,
  randomBytes,
  hashPassword,
  addAudit,
} from "@/lib/staff-api";
import { inArray } from "drizzle-orm";
export const maxDuration = 300;
const input = z.object({
  csv: z.string().min(1).max(1_000_000),
  preview: z.boolean().optional(),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  let rows: any[];
  try {
    rows = parse(parsed.data.csv, {
      columns: (headers: string[]) => {
        if (!['name', 'email', 'phone', 'source'].every(key => headers.includes(key))) {
          throw new Error('Required CSV columns are missing');
        }
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
    });
  } catch {
    return fail("CSV must include name, email, phone, source headers and consistently quoted rows");
  }
  if (!rows.length) return fail('CSV must contain at least one member row');
  if (rows.length > 500) return fail("CSV exceeds 500 records");
  const errors: { row: number; message: string }[] = [];
  const emails: string[] = [];
  const valid = rows.map((r, i) => {
    const x = z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(254),
        phone: z.string().min(5).max(30),
        source: z.string().min(1).max(80),
      })
      .safeParse(r);
    if (!x.success) {
      errors.push({
        row: i + 2,
        message:
          "Required columns name, email, phone, source must contain valid values",
      });
      return null;
    }
    const email = x.data.email.toLowerCase();
    if (emails.includes(email))
      errors.push({ row: i + 2, message: "Duplicate email in CSV" });
    emails.push(email);
    return { ...x.data, email };
  });
  const existing = emails.length
    ? await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, emails))
    : [];
  const existingSet = new Set(existing.map((x) => x.email));
  valid.forEach((x, i) => {
    if (x && existingSet.has(x.email))
      errors.push({ row: i + 2, message: "Email already exists" });
  });
  const preview = valid
    .filter(Boolean)
    .map((x) => ({
      name: x!.name,
      email: x!.email,
      phone: x!.phone,
      source: x!.source,
    }));
  if (parsed.data.preview)
    return Response.json({ rows: rows.length, errors, preview });
  if (errors.length)
    return Response.json({ rows: rows.length, errors }, { status: 400 });
  const memberRows: (typeof members.$inferInsert)[] = [];
  const accountRows: (typeof users.$inferInsert)[] = [];
  for (const x of valid) {
    if (!x) continue;
    const memberId = id();
    memberRows.push({
          id: memberId,
          memberCode: "CFH-" + randomBytes(4).toString("hex").toUpperCase(),
          name: x.name,
          email: x.email,
          phone: x.phone,
          source: x.source,
          qrToken: randomBytes(32).toString("base64url"),
        });
    accountRows.push({
          id: id(),
          name: x.name,
          email: x.email,
          phone: x.phone,
          passwordHash: await hashPassword(x.phone),
          role: "member",
          memberId,
          mustChangePassword: true,
        });
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(members).values(memberRows);
      await tx.insert(users).values(accountRows);
    });
  } catch {
    return fail('Import was not saved. An email may have been registered since preview; preview again.', 409);
  }
  await addAudit(auth.user.id, "members.imported", String(rows.length));
  return Response.json({ rows: rows.length, errors: [] }, { status: 201 });
}
