import { getOptionalSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import { rankingQuerySchema } from "@/features/ranking/schemas/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const searchParams = new URL(request.url).searchParams;
    for (const key of searchParams.keys()) {
      if (searchParams.getAll(key).length > 1) {
        throw new ApiError(400, "VALIDATION_ERROR", [
          { path: key, reason: "한 번만 지정할 수 있습니다." },
        ]);
      }
    }
    const queryResult = rankingQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        queryResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          reason: issue.message,
        })),
      );
    }

    const session = await getOptionalSession(request.headers);
    const ranking = await getNumberClickRanking(getDatabase(), {
      ...queryResult.data,
      viewerId: session?.user.id ?? null,
    });
    if (!ranking) {
      throw new ApiError(404, "GAME_NOT_AVAILABLE");
    }
    return apiSuccess(ranking, requestId);
  });
}
