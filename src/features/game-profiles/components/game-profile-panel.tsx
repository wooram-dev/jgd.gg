"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isProfileAccessError, profileErrorMessage, requestProfile } from "../client/api";
import {
  myGameProfileResponseSchema,
  PROFILE_GAMES,
  saveGameProfileSchema,
  type GameProfileCardData,
} from "../schemas/profile";
import { GameProfileCard } from "./game-profile-card";
import styles from "./game-profiles.module.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: GameProfileCardData | null };
function fieldsFor(profile: GameProfileCardData | null) {
  return PROFILE_GAMES.map((game) => {
    const entry = profile?.games.find((entry) => entry.game === game.id);
    return {
      game: game.id,
      enabled: Boolean(entry),
      nickname: entry?.nickname ?? "",
      tier: entry?.tier ?? "",
    };
  });
}

export function GameProfilePanel() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const [fields, setFields] = useState(() => fieldsFor(null));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void requestProfile("/api/v1/me/game-profile", myGameProfileResponseSchema, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", profile: data.profile });
        setFields(fieldsFor(data.profile));
        setEditing(!data.profile);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: profileErrorMessage(failure) });
      });
    return () => controller.abort();
  }, [version]);

  function changeField(index: number, changes: Partial<(typeof fields)[number]>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...changes } : field)),
    );
    setError("");
    setNotice("");
  }

  async function mutate(method: "PUT" | "DELETE", body: unknown) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const { data } = await requestProfile(
        "/api/v1/me/game-profile",
        myGameProfileResponseSchema,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setState({ status: "ready", profile: data.profile });
      setFields(fieldsFor(data.profile));
      setEditing(!data.profile);
      setConfirmDelete(false);
      setNotice(
        method === "DELETE" ? "게임 프로필을 삭제했습니다." : "게임 프로필을 저장했습니다.",
      );
      heading.current?.focus();
    } catch (failure) {
      if (isProfileAccessError(failure)) {
        setState({ status: "error", message: profileErrorMessage(failure) });
        setFields(fieldsFor(null));
      } else setError(profileErrorMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = saveGameProfileSchema.safeParse({
      games: fields
        .filter((field) => field.enabled)
        .map((field) => ({
          game: field.game,
          nickname: field.nickname,
          tier: field.tier.trim() || null,
        })),
    });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    void mutate("PUT", input.data);
  }

  return (
    <section id="game-profile" className={styles.panel} aria-labelledby="game-profile-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className="eyebrow">MY GAMES</p>
          <h2 id="game-profile-heading" tabIndex={-1} ref={heading}>
            내 게임 프로필
          </h2>
        </div>
        <Link href="/멤버">멤버 프로필 보기 →</Link>
      </div>
      <p className={styles.description}>
        즐기는 게임과 닉네임을 알려 주세요. 저장한 프로필은 대상 Discord 서버 멤버에게 공개됩니다.
      </p>
      {state.status === "loading" ? (
        <p role="status">게임 프로필을 불러오는 중…</p>
      ) : state.status === "error" ? (
        <div className={styles.feedback} role="alert">
          <p>{state.message}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setState({ status: "loading" });
                setVersion((value) => value + 1);
              }}
            >
              다시 확인하기
            </button>
            <Link href={`/login?returnTo=${encodeURIComponent("/내정보")}`}>로그인하기</Link>
          </div>
        </div>
      ) : (
        <>
          {!editing && state.profile ? (
            <GameProfileCard profile={state.profile} />
          ) : (
            <form onSubmit={save} aria-label="게임 프로필 편집" aria-busy={pending}>
              <p className={styles.muted}>등록할 게임을 선택하세요. 티어는 비워 두어도 됩니다.</p>
              <div className={styles.editorGames}>
                {fields.map((field, index) => {
                  const game = PROFILE_GAMES[index];
                  return (
                    <fieldset key={field.game} className={styles.editorGame} disabled={pending}>
                      <legend>{game.name}</legend>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          onChange={(event) =>
                            changeField(index, { enabled: event.target.checked })
                          }
                        />
                        {game.shortName} 등록
                      </label>
                      {field.enabled ? (
                        <div className={styles.fields}>
                          <label htmlFor={`${field.game}-nickname`}>
                            닉네임
                            <input
                              id={`${field.game}-nickname`}
                              autoComplete="off"
                              required
                              maxLength={64}
                              placeholder={game.nicknameHint}
                              value={field.nickname}
                              onChange={(event) =>
                                changeField(index, { nickname: event.target.value })
                              }
                            />
                          </label>
                          <label htmlFor={`${field.game}-tier`}>
                            <span>
                              티어 <span className={styles.muted}>(선택)</span>
                            </span>
                            <input
                              id={`${field.game}-tier`}
                              autoComplete="off"
                              maxLength={32}
                              placeholder={game.tierHint}
                              value={field.tier}
                              onChange={(event) => changeField(index, { tier: event.target.value })}
                            />
                          </label>
                        </div>
                      ) : null}
                    </fieldset>
                  );
                })}
              </div>
              <p className={styles.description}>
                사용자 입력 정보로 표시되며 계정 소유나 공식 티어를 인증하지 않습니다. 선택을
                해제하고 저장하면 해당 게임 정보가 삭제됩니다.
              </p>
              <div className={styles.actions}>
                <button className="button button-primary" disabled={pending} type="submit">
                  {pending ? "처리 중…" : "프로필 저장"}
                </button>
                {state.profile ? (
                  <button
                    className="button button-secondary"
                    disabled={pending}
                    type="button"
                    onClick={() => {
                      setFields(fieldsFor(state.profile));
                      setEditing(false);
                      setError("");
                    }}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>
          )}
          {!editing && state.profile ? (
            <div className={styles.actions}>
              <button
                className="button button-primary"
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(true);
                  setConfirmDelete(false);
                  setNotice("");
                }}
              >
                프로필 편집
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                프로필 삭제
              </button>
            </div>
          ) : null}
          {confirmDelete ? (
            <div className={styles.feedback}>
              <p>등록한 모든 게임 정보를 삭제할까요? 멤버 목록에서도 사라집니다.</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={pending}
                  onClick={() => void mutate("DELETE", {})}
                >
                  삭제 확인
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  삭제 취소
                </button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
      <p className={styles.notice} role="status">
        {notice}
      </p>
      <p className={styles.description}>
        직접 수정·삭제할 때까지 보관하며, 계정 삭제 시 함께 삭제됩니다. 삭제 문의:{" "}
        <a href="mailto:contact@jgd.gg">contact@jgd.gg</a>
      </p>
    </section>
  );
}
