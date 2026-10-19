import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  users,
  id,
  hashPassword,
  newTemporaryPassword,
  addAudit,
} from "@/lib/staff-api";
const input = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  role: z.literal("staff"),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const temporaryPassword = newTemporaryPassword();
  const [u] = await db
    .insert(users)
    .values({
      id: id(),
      name: parsed.data.name,
      email: parsed.data.email.trim().toLowerCase(),
      passwordHash: await hashPassword(temporaryPassword),
      role: "staff",
      mustChangePassword: true,
    })
    .returning();
  await addAudit(auth.user.id, "staff.created", u.id);
  return Response.json(
    {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: "staff",
        mustChangePassword: true,
      },
      temporaryPassword,
    },
    { status: 201 },
  );
}
