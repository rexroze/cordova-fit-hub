import { z } from "zod";
import {
  access,
  body,
  fail,
  db,
  plans,
  id,
  pesosToCents,
} from "@/lib/staff-api";
const input = z.object({
  name: z.string().trim().min(1).max(80),
  durationMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]),
  price: z.number().positive(),
  active: z.boolean().optional(),
});
export async function POST(req: Request) {
  const auth = await access(req, ["owner"]);
  if ("response" in auth) return auth.response;
  const parsed = await body(req, input);
  if ("response" in parsed) return parsed.response;
  const [p] = await db
    .insert(plans)
    .values({
      id: id(),
      name: parsed.data.name,
      durationMonths: parsed.data.durationMonths,
      priceCents: pesosToCents(parsed.data.price),
      active: parsed.data.active ?? true,
    })
    .returning();
  return Response.json(
    {
      plan: {
        id: p.id,
        name: p.name,
        durationMonths: p.durationMonths,
        price: p.priceCents / 100,
        active: p.active,
      },
    },
    { status: 201 },
  );
}
