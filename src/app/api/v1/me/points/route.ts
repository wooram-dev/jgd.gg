import { getPointOverview } from "@/features/points/server/points-service";
import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const user = await requireUser(request, false);
    const points = await getPointOverview(getDatabase(), { userId: user.id });
    return apiSuccess(points, requestId);
  });
}
