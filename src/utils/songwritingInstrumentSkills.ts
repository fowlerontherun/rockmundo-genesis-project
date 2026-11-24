/**
 * Preview the same instrument bonus that the completion RPC awards.
 * Old general skills are useful songwriting experience, but are not equivalent
 * to training in every specialist instrument in the family.
 */
export interface SongwritingInstrumentSkillDefinition {
  slug: string;
  alsoMatch: readonly string[];
}

export interface SongwritingSkillProgress {
  skill_slug: string;
  current_level?: number | null;
}

export interface ResolvedSongwritingInstrumentSkill {
  level: number;
  source: "specialist" | "general" | "none";
  generalFamily: string | null;
}

const getLevel = (progress: readonly SongwritingSkillProgress[], slugs: readonly string[]): number =>
  progress.reduce((max, entry) => {
    if (!slugs.includes(entry.skill_slug)) return max;
    const level = Number(entry.current_level ?? 0);
    return Number.isFinite(level) ? Math.max(max, level, 0) : max;
  }, 0);

const getGeneralFamily = (aliases: readonly string[]): string | null => {
  if (aliases.some((slug) => ["piano", "basic_keyboard"].includes(slug))) return "keys";
  if (aliases.some((slug) => ["vocals", "basic_singing", "lead_vocals_mastery"].includes(slug))) return "vocals";
  return aliases[0] ?? null;
};

export const resolveSongwritingInstrumentSkill = (
  instrument: SongwritingInstrumentSkillDefinition,
  progress: readonly SongwritingSkillProgress[],
): ResolvedSongwritingInstrumentSkill => {
  const specialistSlugs = [
    instrument.slug,
    instrument.slug.replace("instruments_basic_", "instruments_professional_"),
    instrument.slug.replace("instruments_basic_", "instruments_mastery_"),
  ];
  const specialistLevel = getLevel(progress, specialistSlugs);
  if (specialistLevel > 0) {
    return { level: specialistLevel, source: "specialist", generalFamily: null };
  }

  const generalLevel = getLevel(progress, instrument.alsoMatch);
  return generalLevel > 0
    ? { level: generalLevel, source: "general", generalFamily: getGeneralFamily(instrument.alsoMatch) }
    : { level: 0, source: "none", generalFamily: null };
};

export const calculateSongwritingInstrumentBonus = (
  selected: readonly string[],
  instruments: readonly SongwritingInstrumentSkillDefinition[],
  progress: readonly SongwritingSkillProgress[],
): number => {
  const usedGeneralFamilies = new Set<string>();
  const seenInstruments = new Set<string>();
  let bonus = 0;

  selected.forEach((slug, position) => {
    if (seenInstruments.has(slug)) return;
    seenInstruments.add(slug);
    const instrument = instruments.find((entry) => entry.slug === slug);
    if (!instrument) return;

    const skill = resolveSongwritingInstrumentSkill(instrument, progress);
    if (skill.source === "general") {
      if (!skill.generalFamily || usedGeneralFamilies.has(skill.generalFamily)) return;
      usedGeneralFamilies.add(skill.generalFamily);
    }
    if (skill.source === "none") return;

    const firstFour = position < 4;
    const limit = firstFour ? 30 : 15;
    const multiplier = firstFour ? 1.5 : 0.75;
    // Legacy general experience is worth half the specialist contribution.
    const generalFactor = skill.source === "general" ? 0.5 : 1;
    bonus += Math.min(limit * generalFactor, skill.level * multiplier * generalFactor);
  });

  return Math.min(150, Math.round(bonus));
};
