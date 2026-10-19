import { deleteCurrentSession } from "@/lib/auth";
import { fail, originAllowed } from "@/lib/http";
export async function POST(req: Request) {
  if (!originAllowed(req)) return fail("Invalid origin", 403);
  await deleteCurrentSession();
  return Response.json({ ok: true });
}
