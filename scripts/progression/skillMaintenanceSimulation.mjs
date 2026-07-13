const policies = {
  advanced_light: { graceDays: 30, floor: 85, firstRustRatePerDay: .05, laterRustRatePerDay: .09, longRustRatePerDay: .03, recoveryRate: .55, comebackRecoveryMultiplier: 1.25 },
  professional_standard: { graceDays: 45, floor: 80, firstRustRatePerDay: .08, laterRustRatePerDay: .12, longRustRatePerDay: .04, recoveryRate: .6, comebackRecoveryMultiplier: 1.3 },
  mastery_specialist: { graceDays: 60, floor: 75, firstRustRatePerDay: .09, laterRustRatePerDay: .14, longRustRatePerDay: .05, recoveryRate: .65, comebackRecoveryMultiplier: 1.35 },
};
const sharp = (days, p, role=false) => { const active = Math.max(0, days - p.graceDays - (role ? 15 : 0)); const rust = Math.min(active,30)*p.firstRustRatePerDay + Math.min(Math.max(active-30,0),60)*p.laterRustRatePerDay + Math.max(active-90,0)*p.longRustRatePerDay; return Math.round(Math.max(role ? Math.min(100,p.floor+5):p.floor, 100-rust)*10)/10; };
const mod = (s) => Math.round((1 - Math.pow((100-s)/100,1.15)*.2)*1000)/1000;
const recover = (s,p,comeback=false) => Math.round(Math.min(100, s + (100-s)*p.recoveryRate*(comeback?p.comebackRecoveryMultiplier:1))*10)/10;
const scenarios = [
  ['active specialist', 'professional_standard', [0,7,14,21], true],
  ['casual weekly player', 'advanced_light', [0,7,14,21,28], true],
  ['monthly player', 'advanced_light', [0,30,60,90], false],
  ['30-day break', 'professional_standard', [0,30], false],
  ['90-day break', 'professional_standard', [0,90], false],
  ['one-year comeback', 'mastery_specialist', [0,365], true],
  ['multi-role generalist', 'advanced_light', [0,45,90], true],
  ['mastery specialist', 'mastery_specialist', [0,60,120,365], true],
];
console.log('| Scenario | Policy | Days away | Sharpness | Modifier | Recovery sessions to 99 |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const [name,key,daysList,role] of scenarios) {
 const p=policies[key]; const d=daysList.at(-1); let s=sharp(d,p,role); let sessions=0; const comeback=d>=90;
 while(s<99 && sessions<5){s=recover(s,p,comeback && sessions<2); sessions++;}
 console.log(`| ${name} | ${key} | ${d} | ${sharp(d,p,role)} | ${mod(sharp(d,p,role))} | ${sessions} |`);
}
