import { z } from "zod";

import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { assertSameOrigin, parseJson } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { emptyBodySchema } from "@/features/number-click/schemas/api";
import { createGameSession } from "@/features/number-click/server/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const user = await requireUser(request);
    await parseJson(request, emptyBodySchema, 4_096);

    const keyResult = z.string().uuid().safeParse(request.headers.get("idempotency-key"));
    if (!keyResult.success) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_INVALID");
    }

    const result = await createGameSession(getDatabase(), {
      userId: user.id,
      idempotencyKey: keyResult.data,
    });
    return apiSuccess(
      { session: result.session, board: result.board, rules: result.rules },
      requestId,
      {
        status: result.idempotentReplay ? 200 : 201,
        meta: { idempotentReplay: result.idempotentReplay },
      },
    );
  });
}
