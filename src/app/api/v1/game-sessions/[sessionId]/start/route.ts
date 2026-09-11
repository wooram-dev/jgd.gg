import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env/server";
import { assertSameOrigin, parseJson, parsePathUuid } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { getRequestNow } from "@/lib/testing/e2e-clock";
import { emptyBodySchema } from "@/features/number-click/schemas/api";
import { startGameSession } from "@/features/number-click/server/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const user = await requireUser(request);
    await parseJson(request, emptyBodySchema, 4_096);
    const sessionId = parsePathUuid((await context.params).sessionId);
    const result = await startGameSession(getDatabase(), {
      userId: user.id,
      sessionId,
      now: getRequestNow(request, getServerEnv()),
    });
    if (!result.ok) {
      throw result.error;
    }
    return apiSuccess({ session: result.session }, requestId, {
      meta: { idempotentReplay: result.idempotentReplay },
    });
  });
}
