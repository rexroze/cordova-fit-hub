import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import type { Role } from "@/lib/contracts";
export const fail = (
  error: string,
  status = 400,
  fieldErrors?: Record<string, string[]>,
) =>
  NextResponse.json(
    { error, ...(fieldErrors ? { fieldErrors } : {}) },
    { status },
  );
export async function body<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  try {
    const parsed = schema.safeParse(await req.json());
    return parsed.success
      ? { data: parsed.data }
      : {
          response: fail(
            "Invalid request",
            400,
            parsed.error.flatten().fieldErrors as Record<string, string[]>,
          ),
        };
  } catch {
    return { response: fail("Invalid JSON") };
  }
}
export async function authorize(roles: Role[]) {
  const user = await currentUser();
  if (!user) return { response: fail("Authentication required", 401) };
  if (user.mustChangePassword)
    return { response: fail("Password change required", 403) };
  if (!roles.includes(user.role)) return { response: fail("Forbidden", 403) };
  return { user };
}
export function originAllowed(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    // Next may construct req.url using its internal hostname behind a proxy.
    // The incoming Host identifies the browser-facing origin on this request.
    const host = req.headers.get("host") || new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
export const id = () => crypto.randomUUID();
