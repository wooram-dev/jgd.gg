import { z } from "zod";
import { storyQuerySchema } from "@/features/stories/schemas/story";
import { readStoryUpload } from "@/features/stories/server/image";
import { createStory, listStories } from "@/features/stories/server/story-service";
import { requireUser } from "@/lib/auth/authorize";
import { getOptionalSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { assertSameOrigin } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const session = await getOptionalSession(request.headers);
    const query = storyQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new ApiError(400, "VALIDATION_ERROR");
    return apiSuccess(
      await listStories(getDatabase(), session?.user.id ?? null, query.data.cursor),
      requestId,
    );
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const user = await requireUser(request);
    if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR");
    const key = z.string().uuid().safeParse(request.headers.get("idempotency-key"));
    if (!key.success) throw new ApiError(400, "STORY_UPLOAD_KEY_INVALID");
    const original = await readStoryUpload(request);
    const result = await createStory(getDatabase(), {
      userId: user.id,
      uploadKey: key.data,
      original,
      type: request.headers.get("content-type")!,
    });
    return apiSuccess({ story: result.story }, requestId, {
      status: result.replay ? 200 : 201,
      meta: { idempotentReplay: result.replay },
    });
  });
}
