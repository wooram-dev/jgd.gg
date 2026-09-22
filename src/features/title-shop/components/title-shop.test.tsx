// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleShop } from "./title-shop";
import type { TitleShopData } from "../schemas/shop";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const base: TitleShopData = {
  balance: 500,
  enabled: true,
  canModify: true,
  owned: [],
  equipment: { desired: null, applied: null, pending: false, revision: 0, retryAt: null },
};
const response = (data: TitleShopData) => Response.json({ data, meta: { requestId: "test" } });
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockClear();
});
describe("title shop UI", () => {
  it("disables unaffordable and unconfigured purchases and shows all six exact names", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ ...base, balance: 490 }));
    render(<TitleShop />);
    expect(await screen.findByRole("article", { name: "피자스시 장인" })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(
      screen
        .getAllByRole("button", { name: "포인트 부족" })
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    cleanup();
    vi.mocked(fetch).mockResolvedValue(response({ ...base, enabled: false }));
    render(<TitleShop />);
    expect(await screen.findByText(/칭호 상점 준비 중/)).toBeVisible();
    expect(screen.getAllByRole("button", { name: "판매 준비 중" })).toHaveLength(6);
  });
  it("confirms price and no-refund policy, retries a lost response with the identical key, and refreshes balance", async () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(base))
      .mockRejectedValueOnce(new Error("lost"));
    render(<TitleShop />);
    const card = await screen.findByRole("article", { name: "탱장연" });
    fireEvent.click(within(card).getByRole("button", { name: "500 P로 구매" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("환불은 불가");
    expect(dialog).toHaveTextContent("예상 잔액: 0 P");
    fireEvent.click(within(dialog).getByRole("button", { name: "구매 확정" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("처리 결과를 확인하지 못했습니다");
    fetched.mockResolvedValueOnce(
      response({
        ...base,
        balance: 0,
        owned: ["overwatch"],
        equipment: {
          desired: "overwatch",
          applied: "overwatch",
          pending: false,
          revision: 1,
          retryAt: null,
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "같은 요청 다시 시도" }));
    expect(await screen.findByText("칭호를 구매하고 장착했습니다.")).toBeVisible();
    expect(fetched.mock.calls[1][1]?.body).toBe(fetched.mock.calls[2][1]?.body);
    expect(screen.getByText("보유 0 P")).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });
  it("shows durable pending state, retries without purchase, and retains owned titles", async () => {
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      response({
        ...base,
        owned: ["lol"],
        equipment: { desired: "lol", applied: null, pending: true, revision: 1, retryAt: null },
      }),
    );
    render(<TitleShop ownedOnly />);
    expect(await screen.findByText("적용 대기")).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fetched.mockResolvedValueOnce(
      response({
        ...base,
        owned: ["lol"],
        equipment: { desired: "lol", applied: "lol", pending: false, revision: 1, retryAt: null },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Discord에 다시 적용" }));
    await waitFor(() =>
      expect(fetched).toHaveBeenLastCalledWith(
        "/api/v1/me/titles/sync",
        expect.objectContaining({ body: "{}" }),
      ),
    );
    expect(await screen.findByText("장착 중")).toBeVisible();
  });
  it("restores focus on cancellation without purchasing and recovers initial load failure", async () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(base));
    render(<TitleShop />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 불러오기" }));
    const button = within(await screen.findByRole("article", { name: "뭔헤드야" })).getByRole(
      "button",
    );
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(button).toHaveFocus();
    expect(fetched).toHaveBeenCalledTimes(2);
  });
});
