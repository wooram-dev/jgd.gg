import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { getNumberClickStats } from "@/features/number-click/server/stats-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const user = await requireUser(request, false);
    const stats = await getNumberClickStats(getDatabase(), { userId: user.id });
    if (!stats) {
      throw new ApiError(404, "GAME_NOT_AVAILABLE");
    }
    return apiSuccess(stats, requestId);
  });
}
