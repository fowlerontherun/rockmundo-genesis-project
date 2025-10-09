# Nightlife Risk & Reward Layer

## Core Design Goal
Nightlife is an **optional social risk layer** that sits on top of the band's daily schedule. It tempts players with fame, creativity, and relationship boosts, while exposing them to fatigue, scandal, addiction, and other setbacks. Players can ignore nightlife entirely for a disciplined professional playstyle.

## Activity Lineup
Nightlife activities surface dynamically in cities, festivals, post-gig events, and story beats. Each activity presents a reward lure and a counterbalancing risk.

| Activity | Primary Rewards | Primary Risks | Notes |
| --- | --- | --- | --- |
| **After-Party** | Fame bump, chemistry with hosts/bandmates | Fatigue, missed rehearsals | Invite-only; scales with band popularity. Player choices: leave early vs. stay late. |
| **VIP Clubbing** | Networking with promoters, label execs | Scandal, paparazzi exposure, theft | Random encounters can trigger deals or damage reputation. |
| **Open-Mic Jam** | Performance XP, fan growth | Public failure, stage altercation | Surprise collabs or discovery moments. |
| **Bar Crawl** | Momentum, inspiration prompts | Hangover penalty, stamina drain | Chance to unlock lyric/riff ideas via spontaneous songwriting sparks. |
| **Underground Scene** | Rare contacts (session players, producers) | Arrest, shady reputation | Aligns with edgier career archetypes; optional path. |
| **Private Party / Mansion Gig** | Cash infusion, fame spike | Security issues, romance scandals | Offered to known artists; may unlock sponsorships or romances. |
| **Chill Lounge Night** | Mood recovery, stress relief | Minimal monetary cost | Low risk option, supports chilled lifestyle archetypes. |

## Risk–Reward Flow
1. **Invite Stage** – An event generator offers nightlife hooks (based on city nightlife index, fame, current arcs). Players can accept or decline with no penalty.
2. **Decision Stage** – Within the event, players choose a stance:
   - *Stay Sober*: safe gains, reduced fame.
   - *Party Hard*: maximum fame/chemistry, elevated scandal and health risks.
   - *Network*: focuses on contact acquisition, moderate risks.
   - *Leave Early*: small rewards, negligible risk.
3. **Resolution Stage** – Outcomes draw from a probability table influenced by:
   - Player stats (Charisma, Coolness, Endurance, Fame).
   - Lifestyle traits (Professional, Party Animal, Chilled).
   - City nightlife rating and venue quality.
   - Bandmate participation (group reputation, chemistry modifiers).

## Example Outcomes
- **Exhaustion** – Temporary XP penalties, skipped rehearsal opportunities.
- **Scandal** – Viral tabloid/viral backlash, fan loss, reputation shift.
- **Addiction Arc** – Optional multi-event chain if nightlife excess continues.
- **Relationship Drama** – Impacts romance trust and intra-band chemistry.
- **Minor Arrest / Fine** – Short legal trouble, paradoxical fame bump.
- **Eureka Moment** – Unlocks lyric or riff inspiration drops (similar to Popmundo inspiration beats).

## System Integration
| System | Nightlife Impact |
| --- | --- |
| **Health & Energy** | Late nights slow recovery and add fatigue status effects. |
| **Fame & Reputation** | Tabloid-worthy outcomes can spike or tank public image. |
| **Social & Romance** | New partners, rivals, or trust complications emerge. |
| **Skill Learning** | Chance-based boosts to performance or songwriting XP. |
| **Economy** | Money sink for VIP access, drinks, bribes; occasional cash windfalls. |
| **City Pulse** | Participation increases local buzz, influencing gigs and festivals. |

## Player Archetypes & Strategy
| Archetype | Typical Approach | Reward Profile | Cost Profile |
| --- | --- | --- | --- |
| **Professional** | Skips nightlife, focuses on rest/practice. | Stable progression, reliable rehearsals. | Lower fame buzz, fewer surprise contacts. |
| **Party Animal** | Embraces nightlife every chance. | Rapid fame growth, creative spikes. | High burnout risk, scandals, addiction hooks. |
| **Balanced Artist** | Selective, case-by-case decisions. | Moderate fame, steady chemistry. | Requires judgment to avoid stacking penalties. |

## Implementation Hooks
- **Database** – `nightlife_events` table storing `(city_id, band_id, type, risk_level, fame_effect, health_effect, created_at)`.
- **Generation** – Nightly job rolls events using city nightlife index, player fame, current quests.
- **Frontend** – UI modals or feed prompts present choices and preview risk tiers.
- **Status Effects** – Track fatigue, scandal, addiction, inspiration in `player_status` with durations and stacking rules.
- **Bandmate Logic** – NPC bandmates can independently decide, affecting group chemistry.

## Future Expansions
- **Nightlife Career Path** – Players pivot into celebrity DJ, event host, or club owner routes.
- **Influencer Tie-ins** – Social posting mini-game with follower spikes or sponsorship backlash.
- **Global Hotspots** – High-end clubs in global cities grant fame multipliers and unique NPCs.

