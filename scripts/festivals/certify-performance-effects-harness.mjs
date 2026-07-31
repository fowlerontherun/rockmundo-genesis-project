import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../../supabase/tests/live_performance_progression_harness.sql',import.meta.url),'utf8');
const required=[
 'claim_next_festival_settlement_effect','apply_festival_performance_result_effect','apply_festival_band_fans_effect',
 'apply_festival_band_fame_effect','apply_festival_member_xp_effect','apply_festival_band_chemistry_effect',
 'apply_festival_song_familiarity_effect','apply_festival_song_popularity_effect','acknowledge_festival_settlement_effect',
 'finalise_festival_settlement_effects','seeded Festival performance','ordinary-gig scenario','NPC scenario','solo scenario',
 'Festival/gig overlap scenario','Replay assertions','live_performance_outcomes','player_xp_wallet','ROLLBACK'
];
const missing=required.filter(token=>!sql.includes(token));
if(missing.length) throw new Error(`progression harness missing required coverage: ${missing.join(', ')}`);
if(/may be added below|information_schema\.columns|pg_get_functiondef/i.test(sql)) throw new Error('progression harness is metadata-only');
console.log(`Festival progression harness contract: ${required.length} required markers present`);
