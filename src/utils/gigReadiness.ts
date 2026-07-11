export type ReadinessRating = 'poor' | 'average' | 'good' | 'excellent' | 'legendary';
export type ReadinessStatus = 'positive' | 'neutral' | 'warning' | 'critical';

export interface ReadinessFactor { key: string; label: string; score: number; weight: number; status: ReadinessStatus; explanation: string }
export interface ReadinessResult { score: number; rating: ReadinessRating; factors: ReadinessFactor[]; blockingIssues: string[]; warnings: string[] }
export interface ReadinessSong { id: string; durationSeconds: number | null; rehearsalLevel?: number | null }
export interface GigReadinessInput {
  setlistSongs: ReadinessSong[];
  slotDurationSeconds?: number | null;
  recentRehearsalDaysAgo?: number | null;
  recentJamDaysAgo?: number | null;
  bandChemistry?: number | null;
  fatigueScore?: number | null;
  healthScore?: number | null;
  requiredPerformers?: number | null;
  assignedPerformers?: number | null;
  additionalFactors?: ReadinessFactor[];
  additionalBlockingIssues?: string[];
  additionalWarnings?: string[];
}

export const GIG_READINESS_WEIGHTS = {
  setlistCompleteness: 0.24,
  durationFit: 0.14,
  songPractice: 0.18,
  recentRehearsal: 0.14,
  recentJam: 0.08,
  chemistry: 0.10,
  fatigueHealth: 0.06,
  performers: 0.06,
} as const;

export const READINESS_PERFORMANCE_MODIFIER = { maxBonus: 0.06, maxPenalty: -0.10 } as const;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function ratingForReadiness(score: number): ReadinessRating {
  if (score >= 90) return 'legendary';
  if (score >= 70) return 'excellent';
  if (score >= 50) return 'good';
  if (score >= 30) return 'average';
  return 'poor';
}

function statusFor(score: number): ReadinessStatus {
  if (score < 30) return 'critical';
  if (score < 60) return 'warning';
  if (score >= 80) return 'positive';
  return 'neutral';
}

export function calculateReadinessPerformanceModifier(score: number) {
  const normalized = (clamp(score) - 70) / 30;
  const raw = normalized >= 0 ? normalized * READINESS_PERFORMANCE_MODIFIER.maxBonus : (Math.abs(normalized) / (70 / 30)) * READINESS_PERFORMANCE_MODIFIER.maxPenalty;
  return Math.max(READINESS_PERFORMANCE_MODIFIER.maxPenalty, Math.min(READINESS_PERFORMANCE_MODIFIER.maxBonus, raw));
}

export function calculateGigReadiness(input: GigReadinessInput): ReadinessResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const songs = input.setlistSongs ?? [];
  const totalDuration = songs.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const missingDuration = songs.some((s) => !s.durationSeconds || s.durationSeconds <= 0);
  if (songs.length === 0) blockingIssues.push('A saved setlist with at least one song is required.');
  if (missingDuration) blockingIssues.push('Every setlist song needs an estimated duration.');

  const slot = input.slotDurationSeconds ?? 7200;
  const durationRatio = slot > 0 ? totalDuration / slot : 1;
  if (songs.length > 0 && durationRatio < 0.85) warnings.push('Set duration is shorter than the booked performance slot.');
  if (durationRatio > 1.08) warnings.push('Set duration is longer than the booked performance slot.');

  const performerScore = input.requiredPerformers ? clamp(((input.assignedPerformers ?? 0) / input.requiredPerformers) * 100) : 75;
  if (input.requiredPerformers && (input.assignedPerformers ?? 0) < input.requiredPerformers) blockingIssues.push('Required performers are missing from the gig lineup.');

  const practiceAvg = songs.length ? songs.reduce((sum, s) => sum + (s.rehearsalLevel ?? 0), 0) / songs.length : 0;
  const rehearsalDays = input.recentRehearsalDaysAgo;
  const jamDays = input.recentJamDaysAgo;
  const rehearsalScore = rehearsalDays == null ? 55 : clamp(100 - rehearsalDays * 8);
  const jamScore = jamDays == null ? 55 : clamp(100 - jamDays * 6);
  const chemistryScore = input.bandChemistry == null ? 60 : clamp(input.bandChemistry);
  const fatigueHealthScore = clamp(((input.fatigueScore ?? 75) + (input.healthScore ?? 75)) / 2);
  const durationScore = songs.length === 0 ? 0 : clamp(100 - Math.abs(1 - durationRatio) * 180);
  const completeScore = songs.length === 0 ? 0 : missingDuration ? 45 : 100;

  const defs: Array<[keyof typeof GIG_READINESS_WEIGHTS, string, number, string]> = [
    ['setlistCompleteness', 'Setlist completeness', completeScore, songs.length ? `${songs.length} song(s) saved for this gig.` : 'No gig setlist has been saved yet.'],
    ['durationFit', 'Booked slot fit', durationScore, `${Math.round(totalDuration / 60)} minutes planned for a ${Math.round(slot / 60)} minute slot.`],
    ['songPractice', 'Song familiarity', practiceAvg, `Average rehearsal level is ${Math.round(practiceAvg)}%.`],
    ['recentRehearsal', 'Recent rehearsal', rehearsalScore, rehearsalDays == null ? 'No recent rehearsal data found.' : `Last rehearsal was ${rehearsalDays} day(s) ago.`],
    ['recentJam', 'Recent jam session', jamScore, jamDays == null ? 'No recent jam session data found.' : `Last jam was ${jamDays} day(s) ago.`],
    ['chemistry', 'Band chemistry', chemistryScore, `Band chemistry contributes ${Math.round(chemistryScore)}%.`],
    ['fatigueHealth', 'Fatigue and health', fatigueHealthScore, 'Current member condition is included when profile data is available.'],
    ['performers', 'Required performers', performerScore, input.requiredPerformers ? `${input.assignedPerformers ?? 0}/${input.requiredPerformers} performers assigned.` : 'No required performer template is configured yet.'],
  ];
  const baseFactors = defs.map(([key, label, score, explanation]) => ({ key, label, score: Math.round(clamp(score)), weight: GIG_READINESS_WEIGHTS[key], status: statusFor(score), explanation }));
  const additionalFactors = input.additionalFactors ?? [];
  const totalWeight = baseFactors.reduce((sum, f) => sum + f.weight, 0) + additionalFactors.reduce((sum, f) => sum + f.weight, 0);
  const factors = [...baseFactors, ...additionalFactors].map((f) => ({ ...f, score: Math.round(clamp(f.score)), weight: totalWeight > 0 ? f.weight / totalWeight : f.weight }));
  blockingIssues.push(...(input.additionalBlockingIssues ?? []));
  warnings.push(...(input.additionalWarnings ?? []));
  const finalScore = Math.round(clamp(factors.reduce((sum, f) => sum + f.score * f.weight, 0)));
  return { score: finalScore, rating: ratingForReadiness(finalScore), factors, blockingIssues, warnings };
}
