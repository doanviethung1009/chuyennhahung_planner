import type { NextResponse } from "next/server";
import { ContentError } from "@/server/content/errors";
import { invalidateOverviewCacheAfter } from "@/server/overview-cache";
import { toErrorResponse } from "@/server/content/http";
import {
  resolveAdminPrincipal,
  type AdminPrincipal,
  type AdminRouteOptions,
} from "@/server/planner/http";

/**
 * Session-capable guard for Travel Content admin routes (ADR 0011 §1).
 * Dependency direction: admin -> planner -> content. `content/http.ts` never
 * imports this. Routes that do not opt in keep the token-only `adminRoute`.
 */
export async function adminContentRoute(
  request: Request,
  options: AdminRouteOptions,
  handler: (principal: AdminPrincipal) => Promise<NextResponse> | NextResponse,
): Promise<NextResponse> {
  const noStore = (response: NextResponse): NextResponse => {
    response.headers.set("cache-control", "no-store");
    return response;
  };
  try {
    const principal = await resolveAdminPrincipal(request, options);
    return noStore(await handler(principal));
  } catch (error) {
    return noStore(toErrorResponse(error));
  } finally {
    invalidateOverviewCacheAfter(request);
  }
}

/**
 * Reads the optional `If-Match: "<updatedAt>"` header. Absent -> undefined
 * (last write wins). Quotes and a weak `W/` prefix are stripped; a present but
 * empty value is a 400 so a broken client cannot silently skip the check.
 */
export function ifMatchStamp(request: Request): string | undefined {
  const raw = request.headers.get("if-match");
  if (raw === null) return undefined;
  const value = raw
    .trim()
    .replace(/^W\//, "")
    .replace(/^"(.*)"$/, "$1");
  if (value === "" || value.length > 64) {
    throw new ContentError(
      "bad_request",
      "If-Match must be the quoted updatedAt of the record",
    );
  }
  return value;
}
