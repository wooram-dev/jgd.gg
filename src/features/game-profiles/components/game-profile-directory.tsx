"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profileErrorMessage, requestProfile } from "../client/api";
import {
  gameProfileListResponseSchema,
  PROFILE_GAMES,
  type GameProfileListData,
} from "../schemas/profile";
import { GameProfileCard } from "./game-profile-card";
import styles from "./game-profiles.module.css";

export function GameProfileDirectory() {
  const [game, setGame] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  return (
    <section aria-label="멤버 게임 프로필" className={styles.directory}>
      <div className={styles.toolbar}>
        <label htmlFor="profile-game-filter">
          게임별 보기
          <select
            id="profile-game-filter"
            value={game}
            onChange={(event) => {
              setGame(event.target.value);
              setCursor(null);
            }}
          >
            <option value="">모든 게임</option>
            {PROFILE_GAMES.map((game) => (
              <option key={game.id} value={game.id}>
                {game.shortName}
              </option>
            ))}
          </select>
        </label>
        <Link href="/내정보#game-profile" className="button button-primary">
          내 프로필 등록·수정
        </Link>
      </div>
      <ProfilePage
        key={`${game}:${cursor}:${version}`}
        game={game}
        cursor={cursor}
        onNext={setCursor}
        onRetry={() => setVersion((value) => value + 1)}
      />
      {cursor ? (
        <button className="button button-secondary" type="button" onClick={() => setCursor(null)}>
          처음으로
        </button>
      ) : null}
    </section>
  );
}

function ProfilePage({
  game,
  cursor,
  onNext,
  onRetry,
}: {
  game: string;
  cursor: string | null;
  onNext: (cursor: string) => void;
  onRetry: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: GameProfileListData }
  >({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (game) query.set("game", game);
    if (cursor) query.set("cursor", cursor);
    void requestProfile(
      `/api/v1/game-profiles${query.size ? `?${query}` : ""}`,
      gameProfileListResponseSchema,
      { signal: controller.signal },
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: profileErrorMessage(failure) });
      });
    return () => controller.abort();
  }, [game, cursor]);

  if (state.status === "loading")
    return (
      <p className={styles.feedback} role="status">
        멤버 프로필을 불러오는 중…
      </p>
    );
  if (state.status === "error")
    return (
      <div className={styles.feedback} role="alert">
        <p>{state.message}</p>
        <button className="button button-secondary" type="button" onClick={onRetry}>
          다시 불러오기
        </button>
      </div>
    );
  return (
    <>
      {state.data.items.length ? (
        <div className={styles.cardGrid}>
          {state.data.items.map((profile) => (
            <GameProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      ) : (
        <p className={styles.feedback}>
          이 페이지에 표시할 게임 프로필이 없습니다. 내 프로필을 등록해 보세요.
        </p>
      )}
      {state.data.nextCursor ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            if (state.data.nextCursor) onNext(state.data.nextCursor);
          }}
        >
          다음 멤버 보기
        </button>
      ) : null}
    </>
  );
}
