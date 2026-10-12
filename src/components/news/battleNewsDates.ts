import { format } from "date-fns";

export function getBattleNewsDateRanges(now: Date) {
  const today = format(now, "yyyy-MM-dd");
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = format(yesterdayDate, "yyyy-MM-dd");

  return {
    today,
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    todayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, -1).toISOString(),
    yesterdayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(),
    yesterdayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1).toISOString(),
  };
}
