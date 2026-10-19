import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  plans,
  eq,
  pesosToCents,
} from "@/lib/staff-api";
const input = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    durationMonths: z
      .union([z.literal(1), z.literal(3), z.literal(12)])
      .optional(),
    price: z.number().positive().optional(),
    active: z.boolean().optional(),
  })
  .refine((x) => Object.keys(x).length > 0);
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await access(req, ["owner"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const { id } = await params;
  const set = {
    ...parsed.data,
    ...(parsed.data.price !== undefined
      ? { priceCents: pesosToCents(parsed.data.price) }
      : {}),
  } as Record<string, unknown>;
  delete set.price;
  const [p] = await db
    .update(plans)
    .set(set)
    .where(eq(plans.id, id))
    .returning();
  if (!p) return fail("Plan not found", 404);
  return Response.json({
    plan: {
      id: p.id,
      name: p.name,
      durationMonths: p.durationMonths,
      price: p.priceCents / 100,
      active: p.active,
    },
  });
}
