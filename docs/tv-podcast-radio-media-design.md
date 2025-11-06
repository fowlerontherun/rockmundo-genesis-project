# TV, Podcast, and Radio Media System Design

## Overview
Rockmundo currently focuses on live gigs, recording studios, and artist progression. To expand beyond Popmundo-era inspirations and give players deeper media exposure options, we introduce three interconnected media verticals: television shows, podcasts, and radio interviews. This document presents an end-to-end design covering content production, scheduling, monetization, fan engagement, analytics, and cross-media synergies.

## Objectives
- Enable artists, managers, and NPC hosts to create persistent media shows that influence fame, brand perception, and revenue.
- Provide studios and media companies with upgradeable facilities and staff that impact production quality and reach.
- Introduce strategic gameplay loops around booking, rehearsing, and promoting appearances on TV, podcasts, and radio.
- Deliver data-driven insights and live dashboards to help players measure the impact of their media activities.
- Ensure systems interoperate with existing gigs, social networks (Twaater), record labels, and cities.

## Key Personas
1. **Performing Artist / Band** – Books appearances, rehearses, negotiates contracts, manages brand.
2. **Manager / Agent** – Handles scheduling, sponsorship deals, media training.
3. **Media Producer / Host** – Creates show formats, curates guest lists, hires staff, manages ratings.
4. **Record Label Executive** – Invests in media campaigns, tracks ROI, coordinates cross-promotions.
5. **Fans / Audience Segments** – Consume content, leave feedback, influence show ratings.
6. **Advertisers / Sponsors** – Buy ad slots, offer brand placements, evaluate audience metrics.

## System Components
### Media Facilities
- **TV Studios** – Upgradable sets, technical gear, live audiences.
- **Podcast Studios** – Low-cost rooms with optional remote recording support.
- **Radio Stations** – City-based networks with broadcast reach stats.

Each facility has attributes: reputation, technical level, staff roster, and city coverage. Players or NPC corporations can own and upgrade them.

### Show Formats
- Define episode length, segment structure, genre (talk show, live performance, documentary, news magazine), recurring cast, target demographics, and monetization model (ads, premium subscription, donation-driven).
- Unlockable format modules (e.g., "Live Jam Session", "Interactive Fan Call-ins", "VR Stage Tour") influence production costs and potential rewards.

### Booking Workflow
1. Artist or manager browses available show slots in city-specific calendars.
2. Negotiates appearance terms: fee, promotion expectations, exclusivity clauses.
3. Confirms booking; schedules rehearsals and promotional activities.
4. Optional contract add-ons: recording rights, cross-posting to streaming services, merchandise tie-ins.

### Production Loop
- **Pre-production Tasks**: script writing, segment planning, guest coordination, sponsor integration.
- **Rehearsal Activities**: stage walkthroughs, soundcheck, media training mini-games.
- **Live Recording**: interactive segments (fan votes, chat participation), dynamic challenges based on player skill checks.
- **Post-production**: editing quality affects final rating, distribution decisions (syndication, VOD, clip highlights).

### Distribution & Reach
- TV episodes can air live, premiere later, or be sold to streaming platforms.
- Podcasts release immediately or as seasons; support multilingual dubbing.
- Radio interviews can be live or taped, with re-broadcast windows and regional syndication.
- Introduce **Media Reach Score** combining facility reputation, marketing spend, and city popularity to determine audience size.

### Reputation & Impact
- Shows gain **Ratings** influenced by production quality, guest fame, viewer engagement, and novelty.
- Artists earn **Media Buzz** that converts into fan growth, sales boosts, and better gig offers.
- Negative outcomes (PR scandals, poor performance) can trigger dynamic news events and social media backlash.

### Monetization Systems
- **Appearance Fees** negotiated per booking.
- **Ad Revenue Splits** based on episode reach, sponsor contracts, and target demographics.
- **Subscription Bonuses** for premium podcast/TV channels with loyal audiences.
- **Merchandise & Cross-Promotion** triggers special sales events in Rockmundo's e-commerce modules.

### Progression & Unlocks
- Media facilities unlock new set upgrades, camera gear, editing suites as their ratings improve.
- Artists gain media-related skills (e.g., On-Camera Presence, Interview Dexterity, Improv Comedy) affecting outcomes.
- Managers can research negotiation tactics and analytics dashboards.
- Record labels can invest in media campaign trees (e.g., "Global Talk Show Tour", "Podcast Blitz") unlocking global syndication.

### Analytics & Feedback
- **Media Control Center** UI shows per-episode performance metrics: reach, demographics, sentiment, revenue, fan conversion, social media trends.
- **Comparative Benchmarks** allow players to gauge performance against city averages or rival shows.
- **Heatmaps** for city-based reach, **Funnel Charts** for ad conversions, **Timeline Charts** for buzz decay.

### Integration Points
- Gig system: TV specials can capture live gig footage; successful podcasts boost ticket sales.
- Social media: Auto-post clips on Twaater; trending segments grant viral bonuses.
- Education: Media-related courses unlock new skill caps and production efficiencies.
- Record label: Contract clauses include minimum media appearances and profit-sharing rules.
- Nightlife and tourism: City events can spike media ratings; tourism board sponsorships add seasonal modifiers.

## Suggested Improvements Over Popmundo (30 Items)
1. Dynamic media facility ownership with upgradeable equipment trees.
2. Full-fledged media staff hiring (producers, camera crew, editors) impacting quality.
3. Detailed show format builder with modular segments and unlockable gimmicks.
4. Negotiation mini-game for appearance contracts with skill checks.
5. Rehearsal and media training activities influencing performance outcomes.
6. Integrated sponsor management with unique brand missions.
7. Cross-platform distribution (TV, streaming, VOD, clips) for maximizing reach.
8. Audience segmentation by demographics and interests.
9. Real-time fan interaction mechanics (live polls, social chat).
10. Reputation/rating system tied to production quality and guest synergy.
11. Media Buzz mechanic affecting gigs, sales, and social media trends.
12. Negative event system (PR crises, technical failures) with mitigation paths.
13. Merchandise tie-ins triggered by successful appearances.
14. Player-run media companies with investment and staffing gameplay.
15. Customizable set design affecting audience appeal and sponsor bonuses.
16. Podcast season planning with cliffhangers and narrative arcs.
17. Radio syndication networks allowing regional or global coverage expansion.
18. Localization support for multilingual releases and subtitling.
19. Analytics dashboards with reach, conversion, and sentiment metrics.
20. Comparative benchmarking against rival shows and city averages.
21. Media campaign trees for record labels and managers to invest in.
22. Integration with education system for skill-based efficiencies.
23. City tourism events providing temporary rating multipliers.
24. Fan club-exclusive behind-the-scenes content to boost loyalty.
25. Clip editing mini-game influencing virality on Twaater.
26. Sponsorship reputation tiers unlocking premium brand deals.
27. Marketplace for trading/licensing episode rights and archives.
28. Automated highlight reels for cross-promotion on in-game platforms.
29. Media awards ceremonies recognizing top shows and performances.
30. Reputation decay mechanics requiring consistent content cadence.

## Technical Architecture Outline
- **Services**: Media service (CRUD for shows, episodes), Scheduling service (calendar), Analytics service, Marketing service.
- **Data Models**: Facilities, ShowFormats, Episodes, Contracts, Sponsors, AudienceSegments, Ratings, MediaBuzzEvents.
- **Integrations**: Connect to existing Gig, Education, Record Label APIs; extend Notification system for bookings and alerts.
- **Scalability**: Use event-driven architecture; episodes emit events consumed by analytics and marketing pipelines.
- **Storage**: Utilize Supabase for structured data; media assets stored in object storage with CDN.

## UX Considerations
- Dashboard cards summarizing upcoming appearances, pending negotiations, and ratings trends.
- Timeline view to align gig schedules with media commitments.
- Episode builder wizard guiding producers through pre-production to post-release.
- Contextual tooltips explaining how skills and staff influence outcomes.

## Balancing & Economy
- Tune appearance fees and ad revenue to complement gig income without eclipsing it.
- Introduce upkeep costs for facilities to encourage continuous use.
- Calibrate skill progression curves so media-focused playstyles remain viable alongside touring-focused artists.

## Implementation Roadmap
1. **Phase 1** – Core data models, facility ownership, basic booking & production flows.
2. **Phase 2** – Ratings, Media Buzz, sponsor contracts, analytics dashboards.
3. **Phase 3** – Advanced features (syndication, campaigns, awards, crises) and tight integration with gig/social systems.
4. **Phase 4** – Live ops tuning, seasonal events, community feedback incorporation.

## Risks & Mitigations
- **Content Overload**: Provide presets and tutorials for new show creators; allow quick-start templates.
- **Economic Inflation**: Monitor money sources; adjust appearance fees dynamically.
- **Player Fatigue**: Offer automation options (e.g., recurring bookings) and hireable staff to reduce micromanagement.
- **Technical Complexity**: Adopt modular services with clear APIs; reuse existing scheduling components.

## Success Metrics
- Increase in player engagement time associated with media activities.
- Uptick in cross-feature usage (gigs promoted via media, record label campaigns).
- Diversity of content produced (number of active shows, formats, demographics reached).
- Positive community feedback on depth and replayability of media systems.

