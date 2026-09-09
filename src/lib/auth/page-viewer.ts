import { headers } from "next/headers";

import type { UserStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/lib/db/client";
import { hasServerEnv } from "@/lib/env/server";

import { getOptionalSession } from "./server";

export type PageViewer = {
  id: string;
  displayName: string;
  image: string | null;
  status: UserStatus;
};

export async function getPageViewer(): Promise<PageViewer | null> {
  if (!hasServerEnv()) return null;

  try {
    const session = await getOptionalSession(await headers());
    if (!session) return null;
    const user = await getDatabase().user.findUnique({
      where: { id: session.user.id },
      select: { id: true, discordDisplayName: true, image: true, status: true },
    });
    return user
      ? {
          id: user.id,
          displayName: user.discordDisplayName,
          image: user.image,
          status: user.status,
        }
      : null;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "page.viewer_lookup_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return null;
  }
}
