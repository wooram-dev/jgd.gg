"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

type Topic = { id: string; label: string; question: string };

export function DailyTopic({ topics }: { topics: Topic[] }) {
  const [selected, setSelected] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "pending" | "copied" | "failed">("idle");
  const topic = topics[selected];

  async function copyTopic() {
    setCopyState("pending");
    try {
      await navigator.clipboard.writeText(`[JGD.GG 오늘의 대화] ${topic.question}`);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="lounge-panel daily-topic" id="daily-topic" aria-labelledby="topic-heading">
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="icon-tile lavender">
            <Icon name="chat" />
          </span>
          <h2 id="topic-heading">오늘의 대화 한 조각</h2>
        </div>
        <span className="tiny-label">DAILY TOPIC</span>
      </div>
      <div className="topic-categories" role="group" aria-label="대화 주제 종류">
        {topics.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === index}
            disabled={copyState === "pending"}
            onClick={() => {
              setSelected(index);
              setCopyState("idle");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="topic-question">
        <span className="question-mark" aria-hidden="true">
          Q.
        </span>
        <h3>{topic.question}</h3>
        <p>
          거창한 이야기가 아니어도 좋아요.
          <br />
          디스코드에 툭 던지고, 서로의 이야기를 들어봐요.
        </p>
      </div>
      <div className="topic-bottom">
        <span>
          <Icon name="clock" size={14} /> 매일 새로운 이야기
        </span>
        <button
          className="button button-secondary"
          type="button"
          disabled={copyState === "pending"}
          aria-busy={copyState === "pending"}
          onClick={() => void copyTopic()}
        >
          <Icon name={copyState === "copied" ? "check" : "copy"} size={16} />
          {copyState === "copied" ? "복사했어요" : "주제 복사하기"}
        </button>
      </div>
      <p className="copy-status" role="status">
        {copyState === "copied"
          ? "디스코드의 원하는 채널에 붙여넣어 대화를 시작해 보세요."
          : copyState === "failed"
            ? "자동 복사가 안 됐어요. 아래 내용을 직접 선택해 복사해 주세요."
            : ""}
      </p>
      {copyState === "failed" ? (
        <textarea
          className="copy-fallback"
          aria-label="직접 복사할 대화 주제"
          readOnly
          value={`[JGD.GG 오늘의 대화] ${topic.question}`}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </section>
  );
}
