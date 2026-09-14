"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { STORY_DISPLAY_MS, type StoryItem } from "../schemas/story";

export function StoryPlayback({
  story,
  position,
  total,
  hasPrevious,
  onPrevious,
  onNext,
}: {
  story: StoryItem;
  position: number;
  total: number;
  hasPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    const visibility = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    if (!ready || failed || paused || hidden || document.visibilityState !== "visible") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const duration = elapsed.current + performance.now() - started;
      setProgress(Math.min(1, duration / STORY_DISPLAY_MS));
      if (duration >= STORY_DISPLAY_MS) {
        window.clearInterval(timer);
        onNext();
      }
    }, 50);
    return () => {
      elapsed.current += performance.now() - started;
      window.clearInterval(timer);
    };
  }, [ready, failed, paused, hidden, onNext]);

  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    };
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [hasPrevious, onPrevious, onNext]);

  return (
    <>
      <div
        className="story-progress"
        aria-label="스토리 재생 진행"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position + progress}
      >
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className="story-progress-track" aria-hidden="true">
            <span
              style={{
                transform: `scaleX(${index < position ? 1 : index === position ? progress : 0})`,
              }}
            />
          </span>
        ))}
      </div>
      <div className="story-photo-stage">
        {failed ? (
          <p role="status" className="story-photo-error">
            사진을 열 수 없습니다. 공개 시간이 지났거나 연결이 끊겼을 수 있어요.
          </p>
        ) : (
          <Image
            unoptimized
            src={`/api/v1/stories/${story.id}/image`}
            alt={`${story.displayName}님의 스토리 사진`}
            width={1600}
            height={1600}
            className="story-full-photo"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        )}
        <button
          type="button"
          className="story-photo-nav story-photo-previous"
          aria-label="이전 사진"
          disabled={!hasPrevious}
          onClick={onPrevious}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className="story-photo-nav story-photo-next"
          aria-label="다음 사진"
          onClick={onNext}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="story-controls">
        <span aria-label="현재 스토리">
          {position + 1} / {total}
        </span>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setPaused(!paused)}
        >
          {paused ? "재생" : "일시정지"}
        </button>
      </div>
    </>
  );
}
