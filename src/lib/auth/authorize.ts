import type { UserStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";

import { getOptionalSession } from "./server";

export type AuthorizedUser = {
  id: string;
  name: string;
  image: string | null;
  status: UserStatus;
};

export async function requireUser(request: Request, requireActive = true): Promise<AuthorizedUser> {
  const session = await getOptionalSession(request.headers);
  if (!session) {
    throw new ApiError(401, "AUTH_REQUIRED");
  }

  const user = await getDatabase().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, image: true, status: true },
  });
  if (!user) {
    throw new ApiError(401, "AUTH_SESSION_EXPIRED");
  }
  if (requireActive && user.status === "BANNED") {
    throw new ApiError(403, "USER_BANNED");
  }
  return user;
}
