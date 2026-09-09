import { describe, expect, it } from "vitest";
import { getDailyTopics } from "./daily-topic";

describe("라운지의 오늘의 대화", () => {
  it("같은 KST 날짜에는 두 종류의 같은 주제를 제공한다", () => {
    const topics = getDailyTopics(new Date("2026-09-09T15:00:00Z"));
    expect(topics).toEqual(getDailyTopics(new Date("2026-09-10T14:59:59Z")));
    expect(topics.map((topic) => topic.id)).toEqual(["daily", "gaming"]);
    expect(topics[0].question).not.toEqual(topics[1].question);
  });

  it("UTC 날짜가 같아도 KST 자정에 주제가 바뀐다", () => {
    expect(getDailyTopics(new Date("2026-09-09T14:59:59Z"))).not.toEqual(
      getDailyTopics(new Date("2026-09-09T15:00:00Z")),
    );
  });

  it("14일 동안 같은 주제를 반복하지 않고 이후 순환한다", () => {
    const questions = Array.from(
      { length: 14 },
      (_, day) => getDailyTopics(new Date(Date.UTC(2026, 8, 1 + day)))[0].question,
    );
    expect(new Set(questions).size).toBe(14);
    expect(getDailyTopics(new Date("2026-09-01T00:00:00Z"))).toEqual(
      getDailyTopics(new Date("2026-09-15T00:00:00Z")),
    );
  });
});
