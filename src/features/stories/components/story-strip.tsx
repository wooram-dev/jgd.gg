"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";

import {
  MAX_STORY_BYTES,
  STORY_TYPES,
  storyFeedSchema,
  storySchema,
  type StoryItem,
  type StoryGroup,
} from "../schemas/story";
import { StoryPlayback } from "./story-playback";

function StoryDialog({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="story-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="story-dialog-heading">
        <h3>{title}</h3>
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
          aria-label="스토리 닫기"
          disabled={busy}
        >
          닫기 ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

const errorSchema = z.object({ error: z.object({ message: z.string() }) });
class StoryRequestError extends Error {}
async function responseData(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    throw new StoryRequestError(
      error.success ? error.data.error.message : "스토리를 불러오지 못했습니다.",
    );
  }
  return body;
}

function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function publish() {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    uploadKey.current ??= crypto.randomUUID();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/v1/stories", {
        method: "POST",
        headers: { "Content-Type": file.type, "Idempotency-Key": uploadKey.current },
        body: file,
        signal: controller.signal,
      });
      z.object({ data: z.object({ story: storySchema }) }).parse(await responseData(response));
      onPosted();
    } catch (failure) {
      setError(
        failure instanceof StoryRequestError
          ? failure.message
          : "사진을 게시하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <StoryDialog
      title="내 스토리 올리기"
      busy={busy}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <p className="story-muted">
        로그인한 멤버에게 24시간 공개돼요. 이후에는 숨겨지며 사진 원본은 서버에 보관됩니다. 스토리
        목록의 프로필 사진과 이름은 누구나 볼 수 있어요.
      </p>
      <label className="story-file-label">
        사진 선택 <span>JPEG · PNG · WebP / 최대 5MB · 24시간 내 10장</span>
        <input
          type="file"
          accept={STORY_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0];
            setPreview(null);
            setFile(null);
            setError(null);
            uploadKey.current = null;
            if (!next) return;
            if (
              !STORY_TYPES.some((type) => type === next.type) ||
              next.size > MAX_STORY_BYTES ||
              !next.size
            ) {
              setError("5MB 이하의 정지 사진(JPEG, PNG, WebP)을 선택해 주세요.");
              return;
            }
            setFile(next);
            setPreview(URL.createObjectURL(next));
          }}
        />
      </label>
      {preview && (
        <Image
          unoptimized
          src={preview}
          alt="게시할 사진 미리보기"
          width={600}
          height={600}
          className="story-preview"
        />
      )}
      {error && (
        <p role="alert" className="story-error">
          {error}
        </p>
      )}
      <button
        className="button button-primary story-publish"
        disabled={!file || busy}
        aria-busy={busy}
        onClick={() => void publish()}
      >
        {busy ? "게시하는 중…" : "24시간 공개하기"}
      </button>
      <p className="story-muted">
        직접 공유할 수 있는 사진을 올려 주세요. 원본 삭제 문의: contact@jgd.gg
      </p>
    </StoryDialog>
  );
}

export function StoryStrip({
  viewer,
}: {
  viewer: { displayName: string; status: "ACTIVE" | "BANNED" } | null;
}) {
  const [items, setItems] = useState<StoryGroup[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [composer, setComposer] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  const sequence = useRef(0);
  const loggedIn = viewer !== null;
  const load = useCallback(async (next?: string) => {
    const request = ++sequence.current;
    setState("loading");
    try {
      const response = await fetch(
        `/api/v1/stories${next ? `?cursor=${encodeURIComponent(next)}` : ""}`,
        { cache: "no-store" },
      );
      const body = z.object({ data: storyFeedSchema }).parse(await responseData(response));
      if (request !== sequence.current) return;
      offset.current = Date.parse(body.data.serverNow) - Date.now();
      setNow(Date.parse(body.data.serverNow));
      setItems((previous) =>
        next
          ? [
              ...previous,
              ...body.data.items.filter(
                (item) =>
                  !previous.some((old) =>
                    old.stories.some((photo) =>
                      item.stories.some((incoming) => incoming.id === photo.id),
                    ),
                  ),
              ),
            ]
          : body.data.items,
      );
      setCursor(body.data.nextCursor);
      setState("ready");
    } catch {
      if (request !== sequence.current) return;
      setItems([]);
      setSelected(null);
      setState("error");
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loggedIn, load]);
  const visible = items
    .map((group) => ({
      ...group,
      stories: group.stories.filter((story) => Date.parse(story.expiresAt) > now),
    }))
    .filter((group) => group.stories.length > 0);
  const playlist = visible.flatMap((group) => group.stories);
  const index = playlist.findIndex((item) => item.id === selected);
  const active = playlist[index];
  const activeGroup = visible.find((group) => group.stories.some((story) => story.id === selected));
  function open(story: StoryItem) {
    if (!viewer) {
      setLoginRequired(true);
      return;
    }
    setSelected(story.id);
    setSeen((previous) => new Set(previous).add(story.id));
  }
  return (
    <section className="story-section" aria-labelledby="stories-heading">
      <div className="story-section-heading">
        <div>
          <p className="eyebrow">MOMENTS TOGETHER</p>
          <h2 id="stories-heading">
            지금, 우리 이야기<span className="title-dot">.</span>
          </h2>
          <p className="story-muted">가볍게 남기는 오늘의 한 장 · 24시간 공개</p>
        </div>
      </div>
      <div className="story-strip" aria-label="24시간 스토리 목록">
        <button
          className="story-entry story-add"
          disabled={viewer?.status === "BANNED"}
          onClick={() => (viewer ? setComposer(true) : setLoginRequired(true))}
        >
          <span className="story-add-ring" aria-hidden="true">
            ＋
          </span>
          <span>내 스토리</span>
          <small>사진 올리기</small>
        </button>
        {visible.map((story) => (
          <button
            key={story.id}
            className={`story-entry${story.stories.every((item) => seen.has(item.id)) ? " story-seen" : ""}`}
            aria-label={`${story.displayName}님의 스토리 보기${story.stories.every((item) => seen.has(item.id)) ? " (확인함)" : ""}`}
            onClick={() =>
              open(story.stories.find((item) => !seen.has(item.id)) ?? story.stories[0])
            }
          >
            <span className="story-ring">
              <Avatar
                key={story.avatarUrl}
                name={story.displayName}
                src={story.avatarUrl}
                size={80}
              />
            </span>
            <span title={story.displayName}>{story.isViewer ? "나" : story.displayName}</span>
            <small>
              {now - Date.parse(story.createdAt) < 60_000
                ? "방금 전"
                : now - Date.parse(story.createdAt) < 3_600_000
                  ? `${Math.floor((now - Date.parse(story.createdAt)) / 60_000)}분 전`
                  : `${Math.floor((now - Date.parse(story.createdAt)) / 3_600_000)}시간 전`}
            </small>
          </button>
        ))}
        {state === "ready" && !visible.length && (
          <div className="story-empty">
            <strong>오늘의 첫 이야기를 기다려요.</strong>
            <p>게임 속 순간도, 소소한 일상도 좋아요.</p>
          </div>
        )}
        {cursor && state === "ready" && (
          <button className="button button-secondary" onClick={() => void load(cursor)}>
            더 보기
          </button>
        )}
      </div>
      {state === "loading" && (
        <p role="status" className="story-muted">
          스토리를 불러오는 중…
        </p>
      )}
      {state === "error" && (
        <div role="alert" className="story-error">
          스토리를 불러오지 못했습니다. 로그인이 만료됐다면 다시 로그인해 주세요.{" "}
          <button className="button button-secondary" onClick={() => void load()}>
            다시 불러오기
          </button>{" "}
          <Link href="/login?returnTo=%2F">로그인</Link>
        </div>
      )}
      {viewer?.status === "BANNED" && (
        <p className="story-muted">이 계정은 사진을 게시할 수 없습니다.</p>
      )}
      <div className="story-section-footer">
        <a href="#daily-topic">오늘의 이야기 만나기 →</a>
      </div>
      {message && (
        <p role="status" className="story-muted">
          {message}
        </p>
      )}
      {!viewer && loginRequired && (
        <StoryDialog title="로그인이 필요해요" onClose={() => setLoginRequired(false)}>
          <p className="story-muted">스토리 사진을 보거나 올리려면 Discord로 로그인해 주세요.</p>
          <Link href="/login?returnTo=%2F" className="button button-primary story-publish">
            로그인하기
          </Link>
        </StoryDialog>
      )}
      {viewer?.status === "ACTIVE" && composer && (
        <Composer
          onClose={() => setComposer(false)}
          onPosted={() => {
            setComposer(false);
            setMessage("사진을 게시했습니다. 지금부터 24시간 동안 공개됩니다.");
            void load();
          }}
        />
      )}
      {viewer && selected && (
        <StoryDialog
          title={active ? `${active.displayName}님의 스토리` : "공개 시간이 끝난 스토리"}
          onClose={() => setSelected(null)}
        >
          {active && activeGroup ? (
            <>
              <p className="story-muted">
                {new Intl.DateTimeFormat("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Seoul",
                }).format(new Date(active.createdAt))}{" "}
                · {Math.max(1, Math.ceil((Date.parse(active.expiresAt) - now) / 3_600_000))}시간
                이내 숨김
              </p>
              <StoryPlayback
                key={active.id}
                story={active}
                position={activeGroup.stories.findIndex((story) => story.id === selected)}
                total={activeGroup.stories.length}
                hasPrevious={index > 0}
                onPrevious={() => {
                  if (index > 0) open(playlist[index - 1]);
                }}
                onNext={() => {
                  if (index < playlist.length - 1) open(playlist[index + 1]);
                  else setSelected(null);
                }}
              />
            </>
          ) : (
            <p role="status">24시간이 지나 이 사진은 더 이상 열람할 수 없습니다.</p>
          )}
        </StoryDialog>
      )}
    </section>
  );
}
