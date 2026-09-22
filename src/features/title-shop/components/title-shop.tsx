"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TITLES, TITLE_PRICE, type TitleKey } from "../catalog";
import { titleShopResponseSchema, type TitleShopData } from "../schemas/shop";
import styles from "./title-shop.module.css";

type Operation = { action: "purchase" | "equipment" | "sync"; body: object };
const titleName = (key: TitleKey | null) =>
  TITLES.find((title) => title.key === key)?.name ?? "없음";

export function TitleShop({ ownedOnly = false }: { ownedOnly?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<TitleShopData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [confirmation, setConfirmation] = useState<TitleKey | null>(null);
  const [retry, setRetry] = useState<Operation | null>(null);
  const busyRef = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/me/titles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("칭호를 불러오지 못했습니다. 다시 시도해 주세요.");
        return titleShopResponseSchema.parse(await response.json()).data;
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("칭호를 불러오지 못했습니다. 다시 시도해 주세요.");
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (confirmation !== null) dialog.current?.showModal();
  }, [confirmation]);

  function closeConfirmation() {
    dialog.current?.close();
    setConfirmation(null);
    trigger.current?.focus();
  }
  async function perform(operation: Operation) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setRetry(null);
    try {
      const response = await fetch(`/api/v1/me/titles/${operation.action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation.body),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setData(null);
        // Errors after commit are recovered using the original purchase key/revision.
        if (response.status >= 500) setRetry(operation);
        const safeMessage =
          typeof body?.error?.message === "string"
            ? body.error.message
            : "요청을 처리하지 못했습니다.";
        setError(safeMessage);
        return;
      }
      const next = titleShopResponseSchema.parse(body).data;
      setData(next);
      setMessage(
        next.equipment.pending
          ? "칭호 역할 적용이 대기 중입니다. 추가 차감 없이 다시 적용할 수 있습니다."
          : operation.action === "purchase"
            ? "칭호를 구매하고 장착했습니다."
            : "칭호 장착 상태를 반영했습니다.",
      );
      window.dispatchEvent(new Event("jgd:points-changed"));
      router.refresh();
      heading.current?.focus();
    } catch {
      setRetry(operation);
      setError("처리 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const unavailable =
    busy || Boolean(retry) || !data?.enabled || !data.canModify || data.equipment.pending;
  const visibleTitles = TITLES.filter((title) => !ownedOnly || data?.owned.includes(title.key));
  return (
    <section id="titles" className={styles.shop} aria-labelledby="titles-heading" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ownedOnly ? "MY COLLECTION" : "TITLE SHOP"}</p>
          <h2 id="titles-heading" ref={heading} tabIndex={-1}>
            {ownedOnly ? "내 칭호" : "게임 속 한마디, 나의 칭호"}
          </h2>
        </div>
        {data && !ownedOnly ? (
          <strong className={styles.balance}>보유 {data.balance.toLocaleString("ko-KR")} P</strong>
        ) : null}
        {ownedOnly ? <Link href="/상점">칭호 상점 →</Link> : null}
      </div>
      <p className={styles.description}>
        여러 칭호를 모으고, 마음에 드는 하나를 Discord 역할로 장착하세요. 교체는 무료이며 구매 후
        환불은 불가합니다.
      </p>
      {error ? (
        <div role="alert" className={styles.notice}>
          <p>{error}</p>
          {retry ? (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void perform(retry)}
            >
              같은 요청 다시 시도
            </button>
          ) : (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                setData(null);
                setError("");
                setReload((value) => value + 1);
              }}
            >
              다시 불러오기
            </button>
          )}
        </div>
      ) : null}
      {!data && !error ? <p role="status">칭호를 불러오는 중…</p> : null}
      {data ? (
        <>
          {!data.enabled ? (
            <p className={styles.notice}>
              칭호 상점 준비 중입니다. 판매가 시작되면 구매할 수 있어요.
            </p>
          ) : null}
          {!data.canModify ? (
            <p className={styles.notice}>현재 계정은 소장 내역만 확인할 수 있습니다.</p>
          ) : null}
          <div className={styles.equipment}>
            <div>
              <span>{data.equipment.pending ? "적용 대기" : "장착 칭호"}</span>
              <strong>{titleName(data.equipment.desired)}</strong>
            </div>
            {data.equipment.pending ? (
              <div>
                <p>Discord 역할 적용을 완료하지 못했습니다. 소장 칭호는 유지됩니다.</p>
                {data.equipment.retryAt ? (
                  <p>
                    {new Date(data.equipment.retryAt).toLocaleTimeString("ko-KR")} 이후 다시 시도해
                    주세요.
                  </p>
                ) : null}
                <button
                  className="button button-secondary"
                  disabled={busy || Boolean(retry) || !data.enabled || !data.canModify}
                  onClick={() => void perform({ action: "sync", body: {} })}
                >
                  Discord에 다시 적용
                </button>
              </div>
            ) : data.equipment.desired ? (
              <button
                className="button button-secondary"
                disabled={unavailable}
                onClick={() =>
                  void perform({
                    action: "equipment",
                    body: { titleKey: null, expectedRevision: data.equipment.revision },
                  })
                }
              >
                장착 해제
              </button>
            ) : null}
          </div>
          {ownedOnly && visibleTitles.length === 0 ? (
            <p>아직 소장한 칭호가 없습니다. 상점에서 첫 칭호를 골라보세요.</p>
          ) : null}
          <div className={styles.grid}>
            {visibleTitles.map((title) => {
              const owned = data.owned.includes(title.key);
              const equipped = !data.equipment.pending && data.equipment.applied === title.key;
              return (
                <article key={title.key} className={styles.card} aria-label={title.name}>
                  <p className="eyebrow">{title.game}</p>
                  <h3>{title.name}</h3>
                  <p className={styles.price}>
                    {owned
                      ? equipped
                        ? "장착 중"
                        : "소장 중"
                      : `${TITLE_PRICE.toLocaleString("ko-KR")} P`}
                  </p>
                  {owned ? (
                    <button
                      className="button button-secondary"
                      disabled={unavailable}
                      onClick={() =>
                        void perform({
                          action: "equipment",
                          body: { titleKey: title.key, expectedRevision: data.equipment.revision },
                        })
                      }
                    >
                      {equipped ? "Discord에 다시 적용" : "장착하기"}
                    </button>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={unavailable || data.balance < TITLE_PRICE}
                      onClick={(event) => {
                        trigger.current = event.currentTarget;
                        setConfirmation(title.key);
                      }}
                    >
                      {!data.enabled
                        ? "판매 준비 중"
                        : data.balance < TITLE_PRICE
                          ? "포인트 부족"
                          : "500 P로 구매"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      <p role="status" aria-live="polite">
        {busy ? "처리 중…" : message}
      </p>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="title-purchase-heading"
        onCancel={(event) => {
          event.preventDefault();
          closeConfirmation();
        }}
      >
        <h2 id="title-purchase-heading">칭호 구매 확인</h2>
        <p className={styles.purchaseName}>{titleName(confirmation)}</p>
        <p>500 P를 사용해 영구 소장하고 바로 장착합니다. 구매 후 환불은 불가합니다.</p>
        {data ? (
          <p>구매 후 예상 잔액: {(data.balance - TITLE_PRICE).toLocaleString("ko-KR")} P</p>
        ) : null}
        <div className={styles.actions}>
          <button autoFocus className="button button-secondary" onClick={closeConfirmation}>
            취소
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => {
              if (confirmation) {
                const titleKey = confirmation;
                closeConfirmation();
                void perform({
                  action: "purchase",
                  body: { titleKey, requestId: crypto.randomUUID() },
                });
              }
            }}
          >
            구매 확정
          </button>
        </div>
      </dialog>
    </section>
  );
}
