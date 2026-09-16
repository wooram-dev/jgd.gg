import { z } from "zod";

export class ProfileRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  AUTH_SESSION_EXPIRED: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  USER_BANNED: "이 계정은 게임 프로필을 이용할 수 없습니다.",
  GUILD_MEMBER_REQUIRED:
    "게임 프로필은 대상 Discord 서버 멤버만 이용할 수 있습니다. 서버에 가입한 계정으로 로그인해 주세요.",
  GUILD_MEMBERSHIP_UNAVAILABLE:
    "Discord 서버 멤버 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  VALIDATION_ERROR:
    "입력 내용을 확인해 주세요. 닉네임은 64자, 티어는 32자 이내로 입력할 수 있습니다.",
};

export async function requestProfile<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = z
      .object({ error: z.object({ code: z.string() }) })
      .safeParse(await response.json());
    const code = body.success ? body.data.error.code : "UNKNOWN";
    throw new ProfileRequestError(
      code,
      messages[code] ?? "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  }
  return schema.parse(await response.json());
}

export function profileErrorMessage(error: unknown): string {
  return error instanceof ProfileRequestError
    ? error.message
    : "게임 프로필을 불러오거나 저장하지 못했습니다. 다시 시도해 주세요.";
}

export function isProfileAccessError(error: unknown): boolean {
  return (
    error instanceof ProfileRequestError &&
    [
      "AUTH_REQUIRED",
      "AUTH_SESSION_EXPIRED",
      "USER_BANNED",
      "GUILD_MEMBER_REQUIRED",
      "GUILD_MEMBERSHIP_UNAVAILABLE",
    ].includes(error.code)
  );
}
