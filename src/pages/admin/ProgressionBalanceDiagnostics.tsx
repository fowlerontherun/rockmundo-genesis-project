import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PROGRESSION_BALANCE } from "@/utils/progressionBalance";

export default function ProgressionBalanceDiagnostics() {
  return (
    <main className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Progression Balance Diagnostics</CardTitle>
          <CardDescription>Read-only summary for admins. Version {PROGRESSION_BALANCE.version}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h2 className="font-semibold">XP curves</h2>
            <ul className="list-disc pl-5">
              {Object.entries(PROGRESSION_BALANCE.curves).map(([key, curve]) => (
                <li key={key}>{key}: L1 {curve.perLevelXp[0]} XP, L50 {curve.perLevelXp[49]} XP, L100 {curve.perLevelXp[99]} XP</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-semibold">Practice</h2>
            <p>{PROGRESSION_BALANCE.practice.baseXpPerHour} base XP/hour, {PROGRESSION_BALANCE.practice.dailySessionLimit} daily sessions, same-skill multipliers {PROGRESSION_BALANCE.practice.sameSkillDiminishingReturns.join(", ")}.</p>
          </section>
          <section>
            <h2 className="font-semibold">Learning modifiers</h2>
            <p>Primary cap {(PROGRESSION_BALANCE.learning.primaryMaxBonus * 100).toFixed(0)}%, secondary cap {(PROGRESSION_BALANCE.learning.secondaryMaxBonus * 100).toFixed(0)}%, total cap {(PROGRESSION_BALANCE.learning.totalAttributeBonusCap * 100).toFixed(0)}%.</p>
          </section>
          <section>
            <h2 className="font-semibold">Beginner and catch-up</h2>
            <p>Beginner bonuses: {PROGRESSION_BALANCE.beginner.levelBonuses.map((b) => `below ${b.maxExclusiveLevel}: +${b.bonus * 100}%`).join(", ")}. Catch-up max bonus {PROGRESSION_BALANCE.catchUp.maxRestedBonus * 100}% below level {PROGRESSION_BALANCE.catchUp.maxEligibleLevel}.</p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
