import { TZDate } from "@date-fns/tz";
import { addDays, addWeeks, startOfDay, startOfWeek } from "date-fns";

export const SERVICE_TIME_ZONE = "Asia/Seoul";

export type RankingPeriodKey = "today" | "week" | "all";

export type RankingPeriod = {
  key: RankingPeriodKey;
  timeZone: typeof SERVICE_TIME_ZONE;
  startsAt: Date | null;
  endsAt: Date | null;
};

export function getRankingPeriod(key: RankingPeriodKey, now: Date): RankingPeriod {
  if (key === "all") {
    return { key, timeZone: SERVICE_TIME_ZONE, startsAt: null, endsAt: null };
  }

  const zonedNow = new TZDate(now, SERVICE_TIME_ZONE);
  const startsAt =
    key === "today" ? startOfDay(zonedNow) : startOfWeek(zonedNow, { weekStartsOn: 1 });
  const endsAt = key === "today" ? addDays(startsAt, 1) : addWeeks(startsAt, 1);

  return {
    key,
    timeZone: SERVICE_TIME_ZONE,
    startsAt: new Date(startsAt.getTime()),
    endsAt: new Date(endsAt.getTime()),
  };
}
