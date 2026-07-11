import { metricValue } from "@/features/gig-experience/reportMetric";
import type { GigExperienceDTO, GigExperienceSongDTO } from "@/features/gig-experience/types";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";

export const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
export const money = (value: number) => `${value < 0 ? "-" : ""}$${numberFormat.format(Math.abs(value))}`;
export const pct = (value: number) => `${Math.round(value)}%`;
export const score = (value: number) => `${value.toFixed(1)}/25`;

export function headlineFromExperience(experience: GigExperienceDTO) {
  const rating = metricValue(experience.headline.overallRating, 0);
  const grade = experience.headline.performanceGrade.status === "available"
    ? experience.headline.performanceGrade.value
    : getPerformanceGrade(rating).grade;
  const gradeInfo = getPerformanceGrade(rating);
  const attendance = metricValue(experience.headline.attendance, 0);
  const capacity = metricValue(experience.headline.capacity, experience.gig.venue.capacity);
  const attendancePercent = capacity > 0 ? (attendance / capacity) * 100 : 0;
  return { rating, grade, gradeInfo, attendance, capacity, attendancePercent };
}

export function songScore(song: GigExperienceSongDTO) {
  return metricValue(song.performanceScore, 0);
}

export function crowdLabel(song?: GigExperienceSongDTO | null) {
  return song?.crowdResponse.status === "available" ? song.crowdResponse.value : "mixed";
}

export function bestSong(songs: GigExperienceSongDTO[]) {
  return [...songs].sort((a, b) => songScore(b) - songScore(a))[0] ?? null;
}

export function weakestSong(songs: GigExperienceSongDTO[]) {
  return [...songs].sort((a, b) => songScore(a) - songScore(b))[0] ?? null;
}

export function contributionTotal(song: GigExperienceSongDTO) {
  const c = song.contributions;
  return metricValue(c.songQuality, 0) + metricValue(c.rehearsal, 0) + metricValue(c.chemistry, 0) + metricValue(c.equipment, 0) + metricValue(c.crew, 0) + metricValue(c.memberSkill, 0);
}
