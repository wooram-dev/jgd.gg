import { gameProfileQuerySchema } from "@/features/game-profiles/schemas/profile";
import {
  listGameProfiles,
  requireProfileMember,
} from "@/features/game-profiles/server/profile-service";
import { parseProfileQuery } from "@/features/game-profiles/server/request";
import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const user = await requireUser(request);
    const query = parseProfileQuery(request, gameProfileQuerySchema);
    const database = getDatabase();
    await requireProfileMember(database, user.id);
    return apiSuccess(await listGameProfiles(database, user.id, query), requestId);
  });
}
