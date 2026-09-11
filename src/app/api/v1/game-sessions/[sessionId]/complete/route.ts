import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env/server";
import { assertSameOrigin, parseJson, parsePathUuid } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { getRequestNow } from "@/lib/testing/e2e-clock";
import { completeGameSchema } from "@/features/number-click/schemas/api";
import {
  buildCompleteResponse,
  completeGameSessionTransaction,
  findCompletedRecord,
} from "@/features/number-click/server/complete-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const sessionId = parsePathUuid((await context.params).sessionId);
    const database = getDatabase();
    const now = getRequestNow(request, getServerEnv());

    const completed = await findCompletedRecord(database, { userId: user.id, sessionId });
    if (completed) {
      const response = await buildCompleteResponse(database, {
        recordId: completed.recordId,
        userId: user.id,
        idempotentReplay: true,
        now,
      });
      return apiSuccess(response.data, requestId, { meta: response.meta });
    }

    const completion = await parseJson(request, completeGameSchema, 16_384);
    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId,
      completion,
      now,
    });
    if (!result.ok) {
      throw result.error;
    }

    const response = await buildCompleteResponse(database, {
      recordId: result.recordId,
      userId: user.id,
      idempotentReplay: result.idempotentReplay,
      now,
    });
    return apiSuccess(response.data, requestId, { meta: response.meta });
  });
}
