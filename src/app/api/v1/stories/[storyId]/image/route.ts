import { storyImageQuerySchema } from "@/features/stories/schemas/story";
import { readStoryImage } from "@/features/stories/server/story-service";
import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { parsePathUuid } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { handleApiRoute } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ storyId: string }> }) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    await requireUser(request, false);
    const id = parsePathUuid((await context.params).storyId);
    const query = storyImageQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) throw new ApiError(400, "VALIDATION_ERROR");
    const bytes = await readStoryImage(getDatabase(), id, query.data.size);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Request-Id": requestId,
      },
    });
  });
}
