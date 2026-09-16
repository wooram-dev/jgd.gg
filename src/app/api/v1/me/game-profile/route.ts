import { z } from "zod";
import { saveGameProfileSchema } from "@/features/game-profiles/schemas/profile";
import {
  deleteGameProfile,
  getMyGameProfile,
  requireProfileMember,
  saveGameProfile,
} from "@/features/game-profiles/server/profile-service";
import { parseProfileQuery } from "@/features/game-profiles/server/request";
import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { assertSameOrigin, parseJson } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const user = await requireUser(request);
  parseProfileQuery(request, z.object({}).strict());
  const database = getDatabase();
  await requireProfileMember(database, user.id);
  return { user, database };
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    const { user, database } = await authorize(request);
    return apiSuccess(await getMyGameProfile(database, user.id), requestId);
  });
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const { user, database } = await authorize(request);
    const input = await parseJson(request, saveGameProfileSchema, 4096);
    return apiSuccess(await saveGameProfile(database, user.id, input), requestId);
  });
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    assertSameOrigin(request);
    const { user, database } = await authorize(request);
    await parseJson(request, z.object({}).strict(), 4096);
    return apiSuccess(await deleteGameProfile(database, user.id), requestId);
  });
}
