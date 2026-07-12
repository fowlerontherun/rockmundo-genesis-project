import { PROGRESSION_BALANCE, getAttributeUpgradeCost, getBeginnerBonus, getLevelFromLifetimeXp, getProgressWithinLevel } from "../src/utils/progressionBalance";

type Scenario = { name: string; sessionsPerDay: number; educationDaysPerWeek: number; curve: string; attributeStart: number; catchUp?: boolean };
const scenarios: Scenario[] = [
  { name: "casual player", sessionsPerDay: 1, educationDaysPerWeek: 0, curve: "foundation_fast", attributeStart: 80 },
  { name: "regular player", sessionsPerDay: 2, educationDaysPerWeek: 1, curve: "standard_role", attributeStart: 150 },
  { name: "highly active player", sessionsPerDay: 5, educationDaysPerWeek: 2, curve: "standard_role", attributeStart: 250 },
  { name: "education-focused player", sessionsPerDay: 1, educationDaysPerWeek: 4, curve: "specialist", attributeStart: 200 },
  { name: "practice-focused player", sessionsPerDay: 5, educationDaysPerWeek: 0, curve: "standard_role", attributeStart: 200 },
  { name: "broad generalist", sessionsPerDay: 3, educationDaysPerWeek: 1, curve: "business", attributeStart: 150 },
  { name: "focused specialist", sessionsPerDay: 4, educationDaysPerWeek: 2, curve: "specialist", attributeStart: 300 },
  { name: "new-player catch-up", sessionsPerDay: 2, educationDaysPerWeek: 1, curve: "foundation_fast", attributeStart: 100, catchUp: true },
  { name: "returning player", sessionsPerDay: 2, educationDaysPerWeek: 1, curve: "standard_role", attributeStart: 220, catchUp: true },
  { name: "veteran at high skill levels", sessionsPerDay: 3, educationDaysPerWeek: 1, curve: "mastery", attributeStart: 700 },
];
const targets = [1,2,3,5,10,20,40,60,80,90];
const simulate = (scenario: Scenario) => {
  const skill = { slug: scenario.name.replaceAll(" ", "_"), max_level: 100, progression_curve_key: scenario.curve };
  let lifetimeXp = scenario.name.includes("veteran") ? 50000 : 0;
  let ap = 0, attr = scenario.attributeStart;
  const hit: Record<number, number> = {};
  for (let day = 1; day <= 1460; day++) {
    const level = getLevelFromLifetimeXp(skill, lifetimeXp);
    const repetition = PROGRESSION_BALANCE.practice.sameSkillDiminishingReturns;
    for (let i=0; i<scenario.sessionsPerDay; i++) {
      const beginner = getBeginnerBonus(level);
      const catchUp = scenario.catchUp && level < PROGRESSION_BALANCE.catchUp.maxEligibleLevel ? 0.15 : 0;
      lifetimeXp += Math.round(PROGRESSION_BALANCE.practice.baseXpPerHour * (repetition[i] ?? 0.4) * (1 + beginner + catchUp));
    }
    if (day % 7 < scenario.educationDaysPerWeek) lifetimeXp += Math.round(180 * PROGRESSION_BALANCE.education.lessonMultiplier);
    ap += PROGRESSION_BALANCE.attribute.dailyBaseAp;
    while (attr < 1000 && ap >= getAttributeUpgradeCost(attr)) { ap -= getAttributeUpgradeCost(attr); attr += PROGRESSION_BALANCE.attribute.increment; }
    for (const target of targets) if (!hit[target] && getLevelFromLifetimeXp(skill, lifetimeXp) >= target) hit[target] = day;
  }
  return { scenario: scenario.name, daysToLevels: hit, finalLevel: getLevelFromLifetimeXp(skill, lifetimeXp), progress: getProgressWithinLevel(skill, lifetimeXp), finalAttribute: attr };
};
console.log(JSON.stringify({ version: PROGRESSION_BALANCE.version, generatedAt: "deterministic", scenarios: scenarios.map(simulate) }, null, 2));
