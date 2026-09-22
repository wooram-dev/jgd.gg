import { z } from "zod";
import { requireUser } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/db/client";
import { ApiError } from "@/lib/http/api-error";
import { assertSameOrigin, parseJson } from "@/lib/http/request";
import { getRequestId } from "@/lib/http/request-id";
import { apiSuccess } from "@/lib/http/response";
import { handleApiRoute } from "@/lib/http/route";
import { equipTitleSchema, purchaseTitleSchema } from "../schemas/shop";
import { getTitleRoleGateway } from "./discord-roles";
import { equipTitle, getTitleShop, purchaseTitle, syncTitleRoles } from "./shop-service";

export function titleRoute(request: Request, action: "read" | "purchase" | "equipment" | "sync") {
  const requestId = getRequestId(request);
  return handleApiRoute(requestId, async () => {
    if (action !== "read") assertSameOrigin(request);
    const user = await requireUser(request, action !== "read");
    if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR");
    const database = getDatabase();
    const gateway = getTitleRoleGateway();
    if (action === "purchase")
      await purchaseTitle(
        database,
        user.id,
        await parseJson(request, purchaseTitleSchema, 4096),
        gateway,
      );
    if (action === "equipment")
      await equipTitle(
        database,
        user.id,
        await parseJson(request, equipTitleSchema, 4096),
        gateway,
      );
    if (action === "sync") {
      await parseJson(request, z.object({}).strict(), 4096);
      if (!gateway) throw new ApiError(503, "TITLE_SHOP_UNAVAILABLE");
    }
    // Commit purchases before external effects; a retry never repeats the debit.
    if (action !== "read" && gateway) await syncTitleRoles(database, user.id, gateway);
    return apiSuccess(await getTitleShop(database, user.id, gateway), requestId);
  });
}
