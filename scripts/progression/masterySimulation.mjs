const curves = { mastery_professional: [0, 2200, 8500, 26000, 70000], mastery_elite: [0, 3200, 12500, 40000, 110000] };
const archetypes = [
  ["focused specialist", 900, "mastery_professional"], ["broad veteran", 420, "mastery_professional"], ["highly active performer", 1050, "mastery_professional"], ["recording professional", 980, "mastery_elite"], ["songwriter", 820, "mastery_elite"], ["teacher", 520, "mastery_professional"], ["casual long-term player", 180, "mastery_professional"],
];
console.log("archetype,rank1_weeks,rank2_weeks,rank3_weeks,rank4_weeks,total_advantage_cap,trivial_grind_fastest");
for (const [name, weekly, curve] of archetypes) {
  const weeks = curves[curve].slice(1).map((xp) => Math.ceil(xp / weekly));
  console.log(`${name},${weeks.join(",")},0.10,false`);
}
