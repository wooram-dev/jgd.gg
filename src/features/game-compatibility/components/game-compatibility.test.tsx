// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCompatibility } from "./game-compatibility";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function finishQuiz(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "내 게임 성향 알아보기" }));
  for (let index = 0; index < 12; index++) {
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(
      screen.getByRole("button", { name: index === 11 ? "내 유형 보기" : "다음 질문" }),
    );
  }
}

describe("게임 성향 질문과 결과", () => {
  it("미응답 진행을 막고 키보드 선택, 이전 응답 보존과 단계 focus를 제공한다", async () => {
    const user = userEvent.setup();
    render(<GameCompatibility />);
    await user.click(screen.getByRole("button", { name: "내 게임 성향 알아보기" }));
    expect(screen.getByRole("heading", { name: "오늘 게임을 켠 이유는?" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "다음 질문" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전 질문" })).toBeDisabled();
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "다음 질문" }));
    expect(screen.getByRole("heading", { name: "처음 보는 보스가 나타났다!" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "이전 질문" }));
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
  });

  it("유형·비교·수정·초기화를 완료하고 오래된 결과와 복사 상태를 제거한다", async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<GameCompatibility />);
    await finishQuiz(user);
    expect(screen.getByRole("heading", { name: "작전 짜는 파티장" })).toHaveFocus();
    expect(screen.getAllByText(/3\/3개 응답/)).toHaveLength(4);
    await user.selectOptions(screen.getByLabelText("친구의 게임 성향"), "FISQ");
    expect(screen.getByText("네 가지 중 0가지 성향이 같아요.")).toBeVisible();
    expect(screen.getAllByText("다른 취향")).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "결과 복사하기" }));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("친구: FISQ"));
    await user.selectOptions(screen.getByLabelText("친구의 게임 성향"), "RPTV");
    expect(screen.queryByRole("button", { name: "복사했어요" })).not.toBeInTheDocument();
    expect(screen.getByText("네 가지 중 4가지 성향이 같아요.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("친구의 게임 성향"), "");
    expect(screen.queryByText("공통 취향")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "답변 수정하기" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    for (let index = 0; index < 12; index++) {
      expect(screen.getAllByRole("radio")[0]).toBeChecked();
      await user.click(screen.getAllByRole("radio")[1]);
      await user.click(
        screen.getByRole("button", { name: index === 11 ? "내 유형 보기" : "다음 질문" }),
      );
    }
    expect(screen.getByRole("heading", { name: "조용한 자유여행자" })).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "처음부터 다시 하기" }));
    expect(screen.getByRole("heading", { name: /파티에 들어온 나/ })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "내 게임 성향 알아보기" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(screen.getByRole("button", { name: "다음 질문" })).toBeDisabled();
  });

  it("복사 처리 중 결과 변경을 잠그고 거부되면 직접 복사와 재시도를 제공한다", async () => {
    const user = userEvent.setup();
    let rejectCopy: (error: Error) => void = () => {
      throw new Error("Copy not started");
    };
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectCopy = reject;
        }),
    );
    render(<GameCompatibility />);
    await finishQuiz(user);
    await user.click(screen.getByRole("button", { name: "결과 복사하기" }));
    expect(screen.getByRole("button", { name: "결과 복사하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "답변 수정하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "처음부터 다시 하기" })).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    rejectCopy(new Error("NotAllowedError"));
    const fallback = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "직접 복사할 게임 성향 결과",
    });
    expect(fallback.value).toContain("RPTV · 작전 짜는 파티장");
    await user.click(fallback);
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(fallback.value.length);
    copy.mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "결과 복사하기" }));
    expect(screen.getByRole("button", { name: "복사했어요" })).toBeEnabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
