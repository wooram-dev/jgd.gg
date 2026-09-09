// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyTopic } from "./daily-topic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const topics = [
  { id: "daily", label: "가벼운 수다", question: "오늘의 작은 행복은?" },
  { id: "gaming", label: "게임 이야기", question: "가장 좋아하는 게임은?" },
];

describe("오늘의 대화 카드", () => {
  it("종류를 바꾸고 선택한 주제만 복사하며 성공 상태를 안내한다", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<DailyTopic topics={topics} />);
    await user.click(screen.getByRole("button", { name: "게임 이야기" }));
    expect(screen.getByRole("button", { name: "게임 이야기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("heading", { name: "가장 좋아하는 게임은?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "주제 복사하기" }));
    expect(writeText).toHaveBeenCalledWith("[JGD.GG 오늘의 대화] 가장 좋아하는 게임은?");
    expect(screen.getByRole("status")).toHaveTextContent("붙여넣어");
    await user.click(screen.getByRole("button", { name: "가벼운 수다" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "주제 복사하기" })).toBeEnabled();
  });

  it("클립보드 권한이 없으면 성공을 표시하지 않고 직접 복사 경로를 제공한다", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("NotAllowedError"));
    render(<DailyTopic topics={topics} />);
    await user.click(screen.getByRole("button", { name: "주제 복사하기" }));
    expect(screen.getByRole("status")).toHaveTextContent("자동 복사가 안 됐어요");
    expect(screen.getByRole("textbox", { name: "직접 복사할 대화 주제" })).toHaveValue(
      "[JGD.GG 오늘의 대화] 오늘의 작은 행복은?",
    );
    expect(screen.queryByRole("button", { name: "복사했어요" })).not.toBeInTheDocument();
  });
});
