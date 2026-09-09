import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { assertSameOrigin, parseJson, parsePathUuid } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { noContent } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { emptyBodySchema } from "@/features/number-click/schemas/api";
import { abandonGameSession } from "@/features/number-click/server/session-service";

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
    await abandonGameSession(getDatabase(), { userId: user.id, sessionId });
    return noContent();
  });
}
