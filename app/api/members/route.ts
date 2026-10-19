import { z } from "zod";
import { access, body, fail, createMember } from "@/lib/staff-api";
const input = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  phone: z.string().trim().min(5).max(30),
  source: z.string().trim().min(1).max(80),
  planId: z.string().optional(),
  amountPaid: z.number().nonnegative().optional(),
  paymentMethod: z.enum(["cash", "gcash", "bank_transfer"]).optional(),
  reference: z.string().max(120).optional(),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner", "staff"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  try {
    return Response.json(
      { member: await createMember(parsed.data, auth.user.id) },
      { status: 201 },
    );
  } catch (e) {
    return fail(
      e instanceof Error ? e.message : "Could not create member",
      409,
    );
  }
}
