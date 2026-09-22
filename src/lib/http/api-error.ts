export type ApiErrorCode =
  | "TITLE_SHOP_UNAVAILABLE"
  | "TITLE_MEMBER_REQUIRED"
  | "TITLE_BALANCE_INSUFFICIENT"
  | "TITLE_ALREADY_OWNED"
  | "TITLE_REQUEST_CONFLICT"
  | "TITLE_SYNC_PENDING"
  | "GUILD_MEMBER_REQUIRED"
  | "GUILD_MEMBERSHIP_UNAVAILABLE"
  | "STORY_IMAGE_INVALID"
  | "STORY_UPLOAD_KEY_INVALID"
  | "STORY_UPLOAD_LIMIT"
  | "AUTH_REQUIRED"
  | "AUTH_SESSION_EXPIRED"
  | "USER_BANNED"
  | "ORIGIN_NOT_ALLOWED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "IDEMPOTENCY_KEY_INVALID"
  | "GAME_NOT_AVAILABLE"
  | "SESSION_CREATE_CONFLICT"
  | "SESSION_ALREADY_COMPLETED"
  | "SESSION_EXPIRED"
  | "SESSION_NOT_STARTABLE"
  | "SESSION_NOT_PLAYING"
  | "RESULT_RULES_UNSUPPORTED"
  | "RESULT_INCOMPLETE"
  | "RESULT_TOO_FAST"
  | "RESULT_TOO_LONG"
  | "RESULT_EVENT_ORDER_INVALID"
  | "RESULT_CLICK_LIMIT_EXCEEDED"
  | "RESULT_CLOCK_INVALID"
  | "RESULT_BOARD_INVALID";

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  TITLE_SHOP_UNAVAILABLE:
    "칭호 상점이 준비 중이거나 Discord 연결을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  TITLE_MEMBER_REQUIRED: "칭호 구매와 장착은 대상 Discord 서버 멤버만 이용할 수 있습니다.",
  TITLE_BALANCE_INSUFFICIENT: "포인트가 부족합니다. 칭호 구매에는 500 P가 필요합니다.",
  TITLE_ALREADY_OWNED: "이미 소장한 칭호입니다.",
  TITLE_REQUEST_CONFLICT: "요청 상태가 변경되었습니다. 다시 불러온 뒤 시도해 주세요.",
  TITLE_SYNC_PENDING: "먼저 대기 중인 Discord 역할 적용을 완료해 주세요.",

  GUILD_MEMBER_REQUIRED: "게임 프로필은 대상 Discord 서버 멤버만 이용할 수 있습니다.",
  GUILD_MEMBERSHIP_UNAVAILABLE:
    "Discord 서버 멤버 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  STORY_IMAGE_INVALID: "5MB 이하의 정지 사진(JPEG, PNG, WebP)을 선택해 주세요.",
  STORY_UPLOAD_KEY_INVALID: "사진 게시 요청이 올바르지 않습니다. 사진을 다시 선택해 주세요.",
  STORY_UPLOAD_LIMIT:
    "사진은 24시간 동안 최대 10장 게시할 수 있습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_REQUIRED: "로그인이 필요합니다.",
  AUTH_SESSION_EXPIRED: "로그인 세션이 만료되었습니다.",
  USER_BANNED: "이 계정은 공식 기록을 등록할 수 없습니다.",
  ORIGIN_NOT_ALLOWED: "허용되지 않은 요청입니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.",
  VALIDATION_ERROR: "요청 값이 올바르지 않습니다.",
  UNSUPPORTED_MEDIA_TYPE: "JSON 요청만 지원합니다.",
  PAYLOAD_TOO_LARGE: "요청 데이터가 너무 큽니다.",
  INTERNAL_ERROR: "요청을 처리하는 중 문제가 발생했습니다.",
  IDEMPOTENCY_KEY_INVALID: "게임 시작 키가 올바르지 않습니다.",
  GAME_NOT_AVAILABLE: "현재 이 게임을 이용할 수 없습니다.",
  SESSION_CREATE_CONFLICT: "게임 세션을 만들지 못했습니다. 다시 시도해 주세요.",
  SESSION_ALREADY_COMPLETED: "이미 완료된 게임 세션입니다.",
  SESSION_EXPIRED: "게임 세션이 만료되었습니다.",
  SESSION_NOT_STARTABLE: "이 게임 세션은 시작할 수 없습니다.",
  SESSION_NOT_PLAYING: "진행 중인 게임 세션이 아닙니다.",
  RESULT_RULES_UNSUPPORTED: "지원하지 않는 게임 규칙입니다.",
  RESULT_INCOMPLETE: "게임을 끝까지 완료하지 못했습니다.",
  RESULT_TOO_FAST: "기록이 비정상적으로 짧아 저장하지 않았습니다.",
  RESULT_TOO_LONG: "제한 시간을 넘어 기록을 저장하지 않았습니다.",
  RESULT_EVENT_ORDER_INVALID: "입력 순서를 확인할 수 없어 저장하지 않았습니다.",
  RESULT_CLICK_LIMIT_EXCEEDED: "입력 횟수 제한을 넘어 기록을 저장하지 않았습니다.",
  RESULT_CLOCK_INVALID: "플레이 시간을 확인할 수 없어 저장하지 않았습니다.",
  RESULT_BOARD_INVALID: "게임 보드를 확인할 수 없어 저장하지 않았습니다.",
};

export type ValidationDetail = {
  path: string;
  reason: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ValidationDetail[];

  constructor(status: number, code: ApiErrorCode, details?: ValidationDetail[]) {
    super(DEFAULT_MESSAGES[code]);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
