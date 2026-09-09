import { getOptionalSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { getNumberClickOverview } from "@/features/number-click/server/overview-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    if (new URL(request.url).searchParams.size > 0) {
      throw new ApiError(400, "VALIDATION_ERROR");
    }

    const session = await getOptionalSession(request.headers);
    const overview = await getNumberClickOverview(getDatabase(), {
      viewerId: session?.user.id ?? null,
    });
    if (!overview) {
      throw new ApiError(404, "GAME_NOT_AVAILABLE");
    }
    return apiSuccess(overview, requestId);
  });
}
