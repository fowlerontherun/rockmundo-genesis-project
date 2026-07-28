import { format } from "date-fns";

export function getBattleNewsDateRanges(now: Date) {
  const today = format(now, "yyyy-MM-dd");
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = format(yesterdayDate, "yyyy-MM-dd");

  return {
    today,
    todayStart: `${today}T00:00:00`,
    todayEnd: `${today}T23:59:59.999`,
    yesterdayStart: `${yesterday}T00:00:00`,
    yesterdayEnd: `${yesterday}T23:59:59.999`,
  };
}
