"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  AXES,
  QUESTIONS,
  TYPES,
  TYPE_CODES,
  calculateType,
  compareTypes,
  formatTypeSummary,
  isTypeCode,
  type Choice,
  type TypeCode,
} from "../domain/compatibility";
import styles from "./game-compatibility.module.css";

export function GameCompatibility() {
  const [stage, setStage] = useState<"intro" | "quiz" | "result">("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Choice | null)[]>(() => QUESTIONS.map(() => null));
  const [friend, setFriend] = useState<TypeCode | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "pending" | "copied" | "failed">("idle");
  const heading = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  const copyPending = useRef(false);
  const question = QUESTIONS[index];
  const answered = answers.filter((answer) => answer !== null).length;
  const result = stage === "result" ? calculateType(answers) : null;
  const comparison = result && friend ? compareTypes(result.code, friend) : null;
  const summary = result ? formatTypeSummary(result.code, friend) : "";

  useEffect(() => {
    if (interacted.current) heading.current?.focus();
  }, [stage, index]);

  function start(edit: boolean) {
    interacted.current = true;
    setFriend(null);
    setCopyState("idle");
    setIndex(0);
    if (!edit) setAnswers(QUESTIONS.map(() => null));
    setStage(edit ? "quiz" : "intro");
  }

  async function copyResult() {
    if (copyPending.current) return;
    copyPending.current = true;
    setCopyState("pending");
    try {
      await navigator.clipboard.writeText(summary);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      copyPending.current = false;
    }
  }

  return (
    <div className={styles.page}>
      <header className="page-heading">
        <p className="eyebrow">PLAYER PERSONALITY</p>
        <h1>게임 궁합</h1>
        <p>같은 게임, 다른 플레이 스타일. 나는 어떤 플레이어일까요?</p>
      </header>

      {stage === "intro" ? (
        <>
          <section className={styles.intro} aria-labelledby="compatibility-intro">
            <div>
              <span className={styles.tag}>12문항 · 16가지 게임 성향</span>
              <h2 id="compatibility-intro" tabIndex={-1} ref={heading}>
                파티에 들어온 나,
                <br />
                어떤 캐릭터일까?
              </h2>
              <p>
                작전을 짜는 파티장부터 조용한 자유여행자까지.
                <br />
                평소의 나와 가까운 답을 고르고, 친구와 성향을 비교해 봐요.
              </p>
              <button
                className="button button-primary button-large"
                onClick={() => {
                  interacted.current = true;
                  setStage("quiz");
                }}
              >
                내 게임 성향 알아보기 <Icon name="arrow" size={18} />
              </button>
              <p className={styles.note}>로그인 없이 시작 · 답변은 새로고침하면 사라져요.</p>
            </div>
            <div className={styles.sample} aria-label="유형 예시: FITV, 즉흥 파티의 분위기메이커">
              <span className={styles.sampleLabel}>나의 파티 속 캐릭터는?</span>
              <div className={styles.letters} aria-hidden="true">
                {"FITV".split("").map((letter) => (
                  <span key={letter}>{letter}</span>
                ))}
              </div>
              <strong>즉흥 파티의 분위기메이커</strong>
              <span>즐김형 · 즉흥형 · 합류형 · 수다형</span>
              <small>16가지 유형 중 하나의 예시예요.</small>
            </div>
          </section>
          <section aria-labelledby="compatibility-axes">
            <h2 id="compatibility-axes" className={styles.sectionTitle}>
              네 가지 취향으로 만나는 나
            </h2>
            <div className={styles.axisGrid}>
              {AXES.map((axis, axisIndex) => (
                <div className={styles.axisCard} key={axis.name}>
                  <span className={styles.axisNumber}>
                    0{axisIndex + 1} / {axis.name}
                  </span>
                  <strong>
                    {axis.poles[0].label} <span>↔</span> {axis.poles[1].label}
                  </strong>
                  <p>{axis.together}</p>
                </div>
              ))}
            </div>
          </section>
          <details className={styles.catalogue}>
            <summary>16가지 게임 성향 구경하기</summary>
            <div className={styles.typeGrid}>
              {TYPE_CODES.map((code) => (
                <div key={code}>
                  <span>{code}</span>
                  <strong>{TYPES[code].name}</strong>
                  <p>{TYPES[code].description}</p>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : stage === "quiz" ? (
        <section className={styles.quiz} aria-label="게임 성향 질문">
          <div className={styles.progressLabel}>
            <span>
              질문 {index + 1} / {QUESTIONS.length}
            </span>
            <span>{answered}개 응답</span>
          </div>
          <progress
            className={styles.progress}
            value={answered}
            max={QUESTIONS.length}
            aria-label="전체 응답 진행률"
          />
          <fieldset className={styles.question}>
            <legend>
              <h2 tabIndex={-1} ref={heading}>
                {question.title}
              </h2>
            </legend>
            <p className={styles.muted}>평소의 나와 더 가까운 쪽을 골라 주세요.</p>
            <div className={styles.choices}>
              {question.choices.map((label, choice) => (
                <label className={styles.choice} key={`${index}-${choice}`}>
                  <input
                    type="radio"
                    name={`question-${index}`}
                    value={choice}
                    checked={answers[index] === choice}
                    onChange={() => {
                      setAnswers((previous) =>
                        previous.map((answer, answerIndex) =>
                          answerIndex === index ? (choice === 0 ? 0 : 1) : answer,
                        ),
                      );
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.quizActions}>
            <button
              className="button button-secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              이전 질문
            </button>
            <button
              className="button button-primary"
              disabled={answers[index] === null}
              onClick={() => {
                if (answers[index] === null) return;
                if (index < QUESTIONS.length - 1) setIndex(index + 1);
                else setStage("result");
              }}
            >
              {index === QUESTIONS.length - 1 ? "내 유형 보기" : "다음 질문"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      ) : result ? (
        <>
          <section className={styles.result} aria-labelledby="compatibility-result">
            <p className="eyebrow">나의 게임 성향</p>
            <div className={styles.letters} aria-label={`유형 코드 ${result.code}`}>
              {result.code.split("").map((letter, letterIndex) => (
                <span key={letterIndex} aria-hidden="true">
                  {letter}
                </span>
              ))}
            </div>
            <h2 id="compatibility-result" ref={heading} tabIndex={-1}>
              {result.name}
            </h2>
            <p>{result.description}</p>
            <div className={styles.axisGrid}>
              {result.axes.map((axis) => (
                <div className={styles.axisCard} key={axis.code}>
                  <span className={styles.axisNumber}>
                    {axis.name} · {axis.votes}/3개 응답
                  </span>
                  <strong>
                    {axis.code} · {axis.label}
                  </strong>
                  <p>{axis.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.friend} aria-labelledby="compatibility-friend">
            <div className={styles.friendHeading}>
              <span className="icon-tile lavender">
                <Icon name="chat" />
              </span>
              <div>
                <h2 id="compatibility-friend">친구와는 어떤 조합일까?</h2>
                <p>친구가 알려준 네 글자 유형을 골라 주세요.</p>
              </div>
            </div>
            <label htmlFor="friend-type">친구의 게임 성향</label>
            <select
              id="friend-type"
              value={friend ?? ""}
              disabled={copyState === "pending"}
              onChange={(event) => {
                setFriend(isTypeCode(event.target.value) ? event.target.value : null);
                setCopyState("idle");
              }}
            >
              <option value="">친구 유형 선택</option>
              {TYPE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} · {TYPES[code].name}
                </option>
              ))}
            </select>
            <p className={styles.comparisonStatus} role="status">
              {comparison
                ? `네 가지 중 ${comparison.filter((axis) => axis.same).length}가지 성향이 같아요.`
                : "친구도 이 테스트를 해 보면 자신의 유형을 알 수 있어요."}
            </p>
            {comparison ? (
              <div className={styles.comparisonGrid}>
                {comparison.map((axis) => (
                  <article className={styles.comparisonCard} key={axis.name}>
                    <div>
                      <h3>{axis.name}</h3>
                      <span className={axis.same ? styles.same : styles.different}>
                        {axis.same ? "공통 취향" : "다른 취향"}
                      </span>
                    </div>
                    <p className={styles.pair}>
                      나 {axis.mine} <span aria-hidden="true">/</span> 친구 {axis.friend}
                    </p>
                    <p>{axis.prompt}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className={styles.share} aria-label="결과 공유와 다시 하기">
            <button
              className="button button-primary"
              disabled={copyState === "pending"}
              aria-busy={copyState === "pending"}
              onClick={() => void copyResult()}
            >
              <Icon name={copyState === "copied" ? "check" : "copy"} size={16} />
              {copyState === "copied" ? "복사했어요" : "결과 복사하기"}
            </button>
            <button
              className="button button-secondary"
              disabled={copyState === "pending"}
              onClick={() => start(true)}
            >
              답변 수정하기
            </button>
            <button
              className="button button-secondary"
              disabled={copyState === "pending"}
              onClick={() => start(false)}
            >
              처음부터 다시 하기
            </button>
            <p role="status" className={styles.shareStatus}>
              {copyState === "copied"
                ? "원하는 대화방에 붙여넣어 내 유형을 나눠 보세요."
                : copyState === "failed"
                  ? "자동 복사가 안 됐어요. 아래 내용을 직접 선택해 복사해 주세요."
                  : ""}
            </p>
            {copyState === "failed" ? (
              <textarea
                className="copy-fallback"
                aria-label="직접 복사할 게임 성향 결과"
                readOnly
                value={summary}
                onFocus={(event) => event.currentTarget.select()}
              />
            ) : null}
          </section>
        </>
      ) : null}
      <p className={styles.disclaimer}>
        재미로 보는 게임 취향이에요. 실제 MBTI 검사나 실력 평가가 아니며, 그날의 기분과 게임에 따라
        달라질 수 있어요.
      </p>
    </div>
  );
}
