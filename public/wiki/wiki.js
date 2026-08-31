const articles = [
  {
    id: "mechanics-disclosure",
    category: "Start here",
    title: "How the Compendium explains mechanics",
    summary: "What RockMundo will tell you, what it will hint at, and what stays deliberately hidden.",
    level: "Reference",
    tags: ["mechanics", "formulas", "balance", "rng", "guide"],
    sections: [
      {
        title: "The useful-information rule",
        html: `<p>RockMundo is a simulation, not a spreadsheet puzzle. The Compendium therefore explains <strong>which things matter</strong>, the direction they normally matter in, and the trade-offs a player should understand before making a decision.</p><div class="info-box"><strong>Example:</strong> a gig guide can tell you that song familiarity, performer readiness, band chemistry, venue fit and stage preparation can all influence the night. It will not publish the internal weighting of each factor.</div>`
      },
      {
        title: "What we publish",
        html: `<ul><li>Rules needed to make a valid booking or action.</li><li>Visible costs, durations, restrictions and player-facing consequences.</li><li>Broad factors that improve or reduce an outcome.</li><li>Warnings about meaningful risks, such as fatigue, travel conflicts or late cancellation.</li><li>Strategies that make sense in-world rather than strategies based on reverse-engineering numbers.</li></ul>`
      },
      {
        title: "What stays hidden",
        html: `<div class="hidden-box"><strong>Behind the curtain:</strong> exact coefficients, hidden thresholds, anti-abuse checks, detailed random-event odds, NPC catch-up logic and other values that would make a single mathematically optimal loop easy to exploit are intentionally omitted.</div><p>Some mechanics are also allowed to evolve. A wiki page that says “quality, preparation and relevant skills matter” remains useful after balancing; a page that publishes a coefficient can become misleading overnight.</p>`
      },
      {
        title: "How to experiment safely",
        html: `<p>Players are encouraged to compare approaches over time. Change one or two meaningful choices, watch the feedback the game gives you, and build your own style. Discovery is part of RockMundo.</p>`
      }
    ],
    related: ["getting-started", "skills", "gigs", "songwriting"]
  },
  {
    id: "getting-started",
    category: "Start here",
    title: "Getting started",
    summary: "Your first days in RockMundo: create a character, learn the rhythm of the schedule and begin building a music career.",
    level: "Beginner",
    tags: ["new player", "character", "first day", "tutorial"],
    sections: [
      { title: "Your first priorities", html: `<p>Start by understanding your character, current city, schedule and skills. RockMundo rewards steady development more than trying to rush straight to fame.</p><ol><li>Review your character and wellness.</li><li>Choose a small number of musical skills to develop.</li><li>Write or learn material and practise it.</li><li>Meet other players or explore band recruitment.</li><li>Use low-pressure performance opportunities before chasing bigger shows.</li></ol>` },
      { title: "Time matters", html: `<p>Most meaningful actions occupy time. Travel, lessons, work, songwriting, rehearsal and performances can conflict with each other, so the schedule is one of your most important tools.</p><div class="tip-box"><strong>New-player tip:</strong> leave breathing room around important gigs. A perfectly packed diary can become a problem when travel or preparation is required.</div>` },
      { title: "There is no single career path", html: `<p>You can focus on being a performer, songwriter, producer, teacher, entrepreneur, media personality, politician or a mixture. Bands can become the centre of your game, but solo development and side careers are valid too.</p>` }
    ],
    related: ["schedule", "skills", "wellness", "bands"]
  },
  {
    id: "schedule",
    category: "Start here",
    title: "Schedule & activities",
    summary: "How bookings, activity duration and time conflicts shape day-to-day play.",
    level: "Beginner",
    tags: ["calendar", "booking", "activities", "time", "conflicts"],
    sections: [
      { title: "One world, one clock", html: `<p>Your character cannot meaningfully be in two places at once. Activities reserve time and may require a specific city, venue, studio or group of participants.</p>` },
      { title: "Before booking", html: `<table class="mechanics-table"><thead><tr><th>Check</th><th>Why it matters</th></tr></thead><tbody><tr><td>Time</td><td>Overlapping commitments can make an activity invalid or prevent attendance.</td></tr><tr><td>Location</td><td>You may need enough time to travel before the activity starts.</td></tr><tr><td>Participants</td><td>Band and collaborative activities can depend on who is available.</td></tr><tr><td>Money</td><td>Studios, lessons, travel and other bookings may charge a character or group account.</td></tr></tbody></table>` },
      { title: "History and feedback", html: `<p>Completed activities are part of your career history. Pay attention to outcome messages: they are intentionally one of the main ways RockMundo teaches you how preparation and circumstances affected an action.</p>` }
    ],
    related: ["travel-cities", "wellness", "rehearsals-jams", "gigs"]
  },
  {
    id: "skills",
    category: "Character",
    title: "Skills & progression",
    summary: "Develop musical, career and specialist abilities over the long term.",
    level: "Beginner",
    tags: ["xp", "skills", "experience", "mastery", "instruments"],
    sections: [
      { title: "Skills are capabilities, not instant wins", html: `<p>Skills improve what your character is capable of, but outcomes usually combine skill with context. A highly skilled musician can still underperform if exhausted, unfamiliar with the material or badly prepared.</p>` },
      { title: "Experience and specialisation", html: `<p>Experience can be invested into progression, while activities, education and practice support longer-term development. Some areas open into more specialised abilities as your character grows.</p><div class="note-box"><strong>Worth knowing:</strong> broad competence is useful, but deliberate specialisation can make your role in a band or career more distinctive.</div>` },
      { title: "Hidden interactions", html: `<p>Some combinations of ability, role and circumstance may produce benefits that are not listed as a formula. The game is designed so players can discover strong combinations without the Compendium publishing a complete optimisation map.</p>` }
    ],
    related: ["education-employment", "practice", "recording", "gigs"]
  },
  {
    id: "wellness",
    category: "Character",
    title: "Wellness & lifestyle",
    summary: "Health, energy, stress and lifestyle can support or undermine your plans.",
    level: "Beginner",
    tags: ["health", "energy", "stress", "sleep", "lifestyle"],
    sections: [
      { title: "Your condition follows you", html: `<p>Wellness is not a separate mini-game. Your condition can influence how well you handle demanding activities, performances and sustained schedules.</p>` },
      { title: "Pressure has consequences", html: `<p>Long stretches of activity, poor recovery and certain lifestyle choices can create trade-offs. Rest and sensible scheduling are legitimate career decisions, especially before important events.</p>` },
      { title: "Random events", html: `<p>Life is not perfectly predictable. Illness, injury and other events may sometimes interrupt plans. Exact event odds are intentionally not published, and the system may take recent behaviour into account.</p>` }
    ],
    related: ["schedule", "gigs", "travel-cities", "character-life"]
  },
  {
    id: "character-life",
    category: "Character",
    title: "Inventory, wardrobe, housing & personal vehicles",
    summary: "The possessions and lifestyle systems around your character.",
    level: "Beginner",
    tags: ["inventory", "wardrobe", "clothes", "housing", "vehicles", "gear"],
    sections: [
      { title: "Inventory and gear", html: `<p>Your inventory contains equipment and other owned items. Some gear is functional, some is collectible and some is primarily expressive. Read item details before assuming an expensive item is automatically better for every situation.</p>` },
      { title: "Wardrobe and appearance", html: `<p>Clothing, skins, tattoos and avatar options let you shape how your character appears. Cosmetic items are intended to provide identity and visual progression rather than pay-to-win power.</p>` },
      { title: "Housing and transport", html: `<p>Property and personal vehicles extend the life-simulation side of RockMundo. They can carry financial commitments and lifestyle value without replacing the separate band touring and logistics systems.</p>` }
    ],
    related: ["finances-banking", "stage-equipment", "premium"]
  },
  {
    id: "family-legacy",
    category: "Character",
    title: "Family, history & legacy",
    summary: "Long-term character history, family milestones and the record of a life in RockMundo.",
    level: "Intermediate",
    tags: ["family", "children", "legacy", "history", "timeline"],
    sections: [
      { title: "A career leaves a record", html: `<p>Major achievements, relationships, releases, performances and life events can become part of your lasting history. The Legacy and timeline views are designed to make an old character feel meaningfully different from a new one.</p>` },
      { title: "Family systems", html: `<p>Family features add personal milestones and longer-term narrative. They are not intended to be a shortcut to musical progression.</p>` },
      { title: "Hall of Immortals", html: `<p>Exceptional long-term accomplishments can feed into prestige systems and historical recognition. The exact path is deliberately broader than simply maximising one stat.</p>` }
    ],
    related: ["achievements-awards", "social", "getting-started"]
  },
  {
    id: "songs",
    category: "Music",
    title: "Songs & repertoire",
    summary: "Owned songs, band repertoire, covers and the material that powers your music career.",
    level: "Beginner",
    tags: ["songs", "repertoire", "covers", "catalogue"],
    sections: [
      { title: "Songs are long-lived assets", html: `<p>A song can move through writing, practice, band repertoire, rehearsal, recording, release and live performance. Its usefulness depends on more than a single displayed quality value.</p>` },
      { title: "Band repertoire", html: `<p>Bands maintain a shared pool of material they can prepare and perform. Familiarity and preparation matter, so adding a song and being stage-ready with it are not the same thing.</p>` },
      { title: "Cover songs", html: `<p>Players can discover other artists' songs for live use and, where required, seek permission to make recordings. Rights and royalty splits are handled separately from simply knowing how to play the material.</p>` }
    ],
    related: ["songwriting", "practice", "setlists", "releases"]
  },
  {
    id: "songwriting",
    category: "Music",
    title: "Songwriting",
    summary: "Create original material alone or collaboratively while building a catalogue over time.",
    level: "Beginner",
    tags: ["writing", "songs", "lyrics", "composition", "co-writers"],
    sections: [
      { title: "Writing a song", html: `<p>Songwriting combines your character's relevant abilities with time and creative development. The standard songwriting flow remains the normal route; optional interactive exercises can provide an additional way to engage with the process.</p>` },
      { title: "Collaboration", html: `<p>Co-writing can record multiple creators and their shares. Agreeing ownership matters later when a song is recorded, released or earns royalties.</p>` },
      { title: "Quality is not a solved equation", html: `<p>Skills, genre understanding, development and circumstances can all matter. Exact generation weights are not published, and a strong songwriter still benefits from continuing to develop material.</p><div class="tip-box"><strong>Useful approach:</strong> write enough material to create choice, then invest preparation in the songs that fit your current band and ambitions.</div>` }
    ],
    related: ["songs", "practice", "recording", "releases"]
  },
  {
    id: "practice",
    category: "Music",
    title: "Practice & interactive music exercises",
    summary: "Improve personal ability and familiarity through regular practice, with optional mini-games for players who want more hands-on play.",
    level: "Beginner",
    tags: ["practice", "mini game", "familiarity", "training"],
    sections: [
      { title: "Practice has two jobs", html: `<p>Practice can help the musician and help the material. Developing your own ability and becoming comfortable with a specific song are related but not identical goals.</p>` },
      { title: "Optional mini-games", html: `<p>Interactive practice is designed to be easy to understand and difficult to master. Strong play can improve feedback and rewards, but players are not forced to use a mini-game to progress.</p>` },
      { title: "Musical feedback", html: `<p>Timing, accuracy, streaks and mistakes can be translated into music-themed feedback. Exact reward ceilings may be tuned over time, so the wiki focuses on the principle: better execution helps, but it does not replace the underlying character system.</p>` }
    ],
    related: ["skills", "rehearsals-jams", "songs", "gigs"]
  },
  {
    id: "rehearsals-jams",
    category: "Music",
    title: "Rehearsals & jam sessions",
    summary: "Prepare a band, improve shared material and build cohesion before important performances.",
    level: "Beginner",
    tags: ["rehearsal", "jam", "chemistry", "cohesion", "familiarity"],
    sections: [
      { title: "Rehearsals are preparation", html: `<p>Rehearsal is where a band turns individually known songs into a stronger shared performance. Attendance, relevant skills, song familiarity and the rehearsal environment can all matter.</p>` },
      { title: "Jam sessions are broader", html: `<p>Jam sessions are useful for shared musicianship, chemistry and working together. Different session lengths create different time commitments, and having more of the intended members present is generally better than rehearsing around constant absences.</p>` },
      { title: "No magic number", html: `<p>The Compendium does not publish a single “rehearse exactly X times” breakpoint. Your current readiness, ambitions and the importance of the upcoming show should guide how much preparation you invest.</p>` }
    ],
    related: ["band-chemistry", "setlists", "gigs", "schedule"]
  },
  {
    id: "recording",
    category: "Music",
    title: "Recording studios & sessions",
    summary: "Turn songs into recordings using studio time, performers, engineers and production choices.",
    level: "Intermediate",
    tags: ["recording", "studio", "producer", "engineer", "session musician"],
    sections: [
      { title: "Booking a session", html: `<p>Studios differ in quality and price, and recording consumes scheduled time. Bands can normally fund band work from band money, with personal funding available where the booking flow allows it.</p>` },
      { title: "What broadly affects a recording", html: `<table class="mechanics-table"><thead><tr><th>Factor</th><th>General effect</th></tr></thead><tbody><tr><td>Song</td><td>The underlying material and how well it has been developed set the foundation.</td></tr><tr><td>Performers</td><td>Relevant skills, roles, attendance and condition matter.</td></tr><tr><td>Preparation</td><td>Familiarity and rehearsal reduce the risk of taking unprepared material into an expensive session.</td></tr><tr><td>Studio & staff</td><td>Studio quality, engineering, production and equipment can raise the ceiling.</td></tr><tr><td>Time</td><td>More time can help, but additional days are not intended to be an unlimited linear multiplier.</td></tr></tbody></table>` },
      { title: "Producers and session musicians", html: `<p>Outside expertise can fill gaps or raise quality. A producer is not a substitute for every weak part of a project, and hired musicians do not erase the importance of the artists actually making the record.</p>` }
    ],
    related: ["songwriting", "rehearsals-jams", "releases", "finances-banking"]
  },
  {
    id: "releases",
    category: "Music",
    title: "Releases, streaming & record sales",
    summary: "Publish recordings, distribute them across formats and build a commercial music career.",
    level: "Intermediate",
    tags: ["release", "streaming", "vinyl", "digital", "sales", "royalties"],
    sections: [
      { title: "From recording to release", html: `<p>A finished recording can be packaged into releases and made available through supported channels. Release decisions include timing, format, costs and the promotional environment around the music.</p>` },
      { title: "Streams and sales are different signals", html: `<p>Streaming, digital purchases and physical formats can behave differently. Audience size, artist momentum, song and recording appeal, promotion, current competition and world activity can all influence demand.</p>` },
      { title: "Royalties and splits", html: `<p>Money can flow to the appropriate parties according to ownership and agreements. Collaboration and cover rights therefore matter after the creative work is finished.</p><div class="hidden-box"><strong>Not published:</strong> exact sales-generation weights, daily demand multipliers and chart manipulation thresholds.</div>` }
    ],
    related: ["charts-pulse", "media-pr", "labels-business", "songs"]
  },
  {
    id: "setlists",
    category: "Music",
    title: "Setlists",
    summary: "Build a show from songs your act is ready to perform, and reuse or switch setlists when plans change.",
    level: "Beginner",
    tags: ["setlist", "gig", "songs", "performance"],
    sections: [
      { title: "A setlist is a performance plan", html: `<p>Setlists organise the material you intend to play. The setlist selected while booking a gig should carry through to that booked performance, while still allowing you to change it later when the rules permit.</p>` },
      { title: "Choosing songs", html: `<p>Think about preparation, quality, familiarity, pacing and the audience you expect. Simply filling every slot with your newest songs is not automatically the strongest live plan.</p>` },
      { title: "Changing plans", html: `<p>Late changes can be useful when a song is not ready, but switching material does not magically transfer rehearsal or familiarity from the old set.</p>` }
    ],
    related: ["gigs", "songs", "rehearsals-jams", "stage-equipment"]
  },
  {
    id: "bands",
    category: "Band & live",
    title: "Bands, members & roles",
    summary: "Form a band, assign meaningful musical roles and build a shared career.",
    level: "Beginner",
    tags: ["band", "members", "roles", "instruments"],
    sections: [
      { title: "A band is a shared entity", html: `<p>Bands have their own repertoire, finances, history, gigs, touring plans, equipment and internal structure. Joining one changes what you can coordinate with other players.</p>` },
      { title: "Roles should reflect actual skills", html: `<p>Band roles connect to the instrument and performance abilities that exist in the game. A well-covered lineup gives the band more flexibility, but unconventional lineups can still be part of an act's identity.</p>` },
      { title: "Leadership and responsibility", html: `<p>Some actions require appropriate band authority. Recruitment, finances, agreements and strategic changes should be handled through the band's own management systems rather than one member acting as if all band assets were personal assets.</p>` }
    ],
    related: ["band-governance", "band-chemistry", "band-finances", "gigs"]
  },
  {
    id: "band-governance",
    category: "Band & live",
    title: "Recruitment, governance & agreements",
    summary: "Find members, manage invitations and record important band decisions and contracts.",
    level: "Intermediate",
    tags: ["recruitment", "contracts", "agreements", "governance", "proposals"],
    sections: [
      { title: "Recruitment", html: `<p>Players can discover bands looking for members, while bands can advertise for the skills and roles they need. Invitations should make the proposed role clear before someone joins.</p>` },
      { title: "Governance", html: `<p>Important group decisions can use proposals and permissions rather than relying on off-game assumptions. This is especially useful when a band grows, has shared assets or includes members with different responsibilities.</p>` },
      { title: "Agreements", html: `<p>Written agreements can clarify ownership, contributions and expectations. They matter most when money, songs or long-lived rights are involved.</p>` }
    ],
    related: ["bands", "social", "songwriting", "band-finances"]
  },
  {
    id: "band-chemistry",
    category: "Band & live",
    title: "Band chemistry",
    summary: "The long-term value of members repeatedly working and performing together.",
    level: "Intermediate",
    tags: ["chemistry", "cohesion", "band", "teamwork"],
    sections: [
      { title: "More than a displayed stat", html: `<p>Chemistry represents how naturally a group functions together. Rehearsing, jamming, performing and maintaining a stable working relationship can help build that shared understanding.</p>` },
      { title: "Lineup changes", html: `<p>Changing members can be the right decision, but a new lineup may need time together before it performs like an established one.</p>` },
      { title: "Why the exact curve is hidden", html: `<p>Publishing exact chemistry breakpoints would turn a social, musical system into a stopwatch. The game instead provides visible feedback and gradual progression.</p>` }
    ],
    related: ["rehearsals-jams", "bands", "gigs", "tours"]
  },
  {
    id: "gigs",
    category: "Band & live",
    title: "Gigs & live performance",
    summary: "Book shows, prepare properly and turn a setlist into a live result.",
    level: "Intermediate",
    tags: ["gig", "show", "performance", "venue", "booking"],
    sections: [
      { title: "Booking rules", html: `<p>A gig is tied to a date, venue and performance slot. Avoid overlapping shows unless the booking rules explicitly allow enough separation at the same venue. Your travel and other scheduled commitments still matter.</p>` },
      { title: "What affects the night", html: `<table class="mechanics-table"><thead><tr><th>Area</th><th>Examples</th></tr></thead><tbody><tr><td>Material</td><td>Song strength, setlist suitability and familiarity.</td></tr><tr><td>Performers</td><td>Relevant skills, wellness, attendance and chemistry.</td></tr><tr><td>Preparation</td><td>Rehearsal, stage setup and practical readiness.</td></tr><tr><td>Production</td><td>Venue, stage equipment and crew support.</td></tr><tr><td>Audience</td><td>Fame, local interest, promotion and the type of event.</td></tr></tbody></table>` },
      { title: "Cancellation", html: `<p>Shows can be cancelled, but the closer you are to performance time the more serious the consequences can become. This protects venues, fans and other participants from risk-free last-minute changes.</p>` },
      { title: "Live feedback", html: `<p>The performance result is intended to explain what went well and what hurt the show without revealing the full scoring formula. Use it as your band's post-gig review.</p>` }
    ],
    related: ["setlists", "stage-equipment", "tours", "fame-fans"]
  },
  {
    id: "stage-equipment",
    category: "Band & live",
    title: "Stage equipment, setup & show crew",
    summary: "Prepare the production around a performance instead of treating the band as the only input.",
    level: "Intermediate",
    tags: ["stage", "equipment", "crew", "gear", "production"],
    sections: [
      { title: "Band stage equipment", html: `<p>Stage gear belongs to the live-production side of the band. Different pieces support different needs, and owning expensive equipment is not useful if it does not suit the lineup or cannot be supported properly.</p>` },
      { title: "Stage setup", html: `<p>Preparation can include arranging the stage and ensuring the right production choices are in place before showtime. The aim is to make gig preparation a real decision rather than a hidden background bonus.</p>` },
      { title: "Crew", html: `<p>Touring and show crew can provide specialist support. Crew quality and role fit matter broadly, but exact internal contribution weights are not listed.</p>` }
    ],
    related: ["gigs", "tours", "bands", "character-life"]
  },
  {
    id: "tours",
    category: "Band & live",
    title: "Tours, riders & band vehicles",
    summary: "Link multiple shows together while managing travel, logistics and the practical needs of a touring act.",
    level: "Advanced",
    tags: ["tour", "travel", "bus", "van", "rider", "logistics"],
    sections: [
      { title: "A tour is a chain of commitments", html: `<p>Tours connect dates, venues and travel. A strong tour plan leaves enough time to move the act and equipment between cities rather than assuming each show exists in isolation.</p>` },
      { title: "Vehicles and transport", html: `<p>Vans, buses, trucks, planes and ferries have different use cases. Capacity, comfort, speed, cost and route availability can all matter. Upgrades can improve touring life without removing the need to plan.</p>` },
      { title: "Riders and crew", html: `<p>Riders express production and hospitality needs, while crew help deliver the show. Ambitious touring increases operational complexity as well as potential reach.</p>` }
    ],
    related: ["travel-cities", "gigs", "stage-equipment", "band-finances"]
  },
  {
    id: "travel-cities",
    category: "World",
    title: "Travel, cities & location",
    summary: "Move through the RockMundo world and make sure your character is where their commitments actually happen.",
    level: "Beginner",
    tags: ["travel", "cities", "location", "automatic travel"],
    sections: [
      { title: "Location is real", html: `<p>Your current city affects which local opportunities and facilities are immediately available. Being booked elsewhere does not mean your character teleports there.</p>` },
      { title: "Travel planning", html: `<p>Travel has duration and can interact with your schedule. Where available, follow-band or automatic travel options can help coordinate members, but they should still respect real conflicts and existing activities.</p>` },
      { title: "Cities differ", html: `<p>Cities can have different venues, businesses, studios, events and community activity. Local fame and opportunities give touring a reason beyond simply collecting map locations.</p>` }
    ],
    related: ["schedule", "tours", "world-places", "politics"]
  },
  {
    id: "world-places",
    category: "World",
    title: "Venues, studios & companies",
    summary: "The places and organisations that make each city function.",
    level: "Beginner",
    tags: ["venue", "studio", "company", "city", "business"],
    sections: [
      { title: "Venues", html: `<p>Venues provide the physical setting for gigs and events. Capacity, quality, availability and suitability can matter when deciding where an act should perform.</p>` },
      { title: "Studios", html: `<p>Recording and rehearsal studios provide bookable facilities with their own costs and quality. A prestigious studio can help, but it does not replace good songs and prepared performers.</p>` },
      { title: "Companies", html: `<p>The world contains operational businesses such as labels, venues, studios, security, logistics and merchandising organisations. Some are managed by players under the game's business rules.</p>` }
    ],
    related: ["recording", "gigs", "businesses", "labels-business"]
  },
  {
    id: "festivals",
    category: "World",
    title: "Festivals",
    summary: "Large multi-act events with programming, stages, operations, sponsorship and financial risk.",
    level: "Advanced",
    tags: ["festival", "stages", "sponsors", "applications", "tickets"],
    sections: [
      { title: "Attending as an artist", html: `<p>Festivals can offer application or invitation opportunities. A festival slot is still a live performance, so your material, lineup and readiness matter.</p>` },
      { title: "Running a festival", html: `<p>Festival operators choose the event identity, dates, scale and site approach, then manage stages, artist programming, contracts, sponsorship, operations and finance. Bigger is not automatically safer or more profitable.</p>` },
      { title: "Festival economics", html: `<p>Tickets, food and drink, merchandise and sponsorship can generate revenue, while the site, acts, infrastructure, staffing and operations create costs. Reputation and past editions can shape future opportunities.</p>` },
      { title: "What remains undisclosed", html: `<div class="hidden-box"><strong>Not a guaranteed-profit recipe:</strong> demand curves, sponsor acceptance weights, exact settlement multipliers and event-outcome coefficients are not published.</div>` }
    ],
    related: ["events", "gigs", "businesses", "charts-pulse"]
  },
  {
    id: "events",
    category: "World",
    title: "Open mics, Battle of the Bands & major events",
    summary: "Competitive and special-event performance routes outside ordinary gig booking.",
    level: "Beginner",
    tags: ["open mic", "battle of the bands", "major events", "competition"],
    sections: [
      { title: "Open mic", html: `<p>Open mic nights are lower-barrier performance opportunities and a useful way to gain live experience before your act is ready for larger bookings.</p>` },
      { title: "Battle of the Bands", html: `<p>Battle of the Bands runs as a recurring city competition for eligible acts. Entrants prepare a small set and are ranked by live outcome, with meaningful rewards and historical recognition for winners.</p>` },
      { title: "Major and seasonal events", html: `<p>Special events can introduce unusual eligibility rules, prestige and rewards. Read the event page carefully rather than assuming normal gig rules apply unchanged.</p>` }
    ],
    related: ["gigs", "achievements-awards", "fame-fans", "festivals"]
  },
  {
    id: "charts-pulse",
    category: "World",
    title: "Charts, leaderboards & World Pulse",
    summary: "How RockMundo reflects success across songs, releases, artists, cities and the wider world.",
    level: "Intermediate",
    tags: ["charts", "world pulse", "leaderboard", "rankings", "streams", "sales"],
    sections: [
      { title: "Charts measure different things", html: `<p>Some charts focus on songs, sales, streaming or geography, while leaderboards can track broader artist and band success. A high position in one area does not mean the act leads every measure.</p>` },
      { title: "World Pulse", html: `<p>World Pulse combines current activity into a readable picture of what is happening across RockMundo. Daily signals can roll into longer views, helping players spot momentum and a changing musical landscape.</p>` },
      { title: "Weights are intentionally abstracted", html: `<p>The game may weight different commercial signals to stop one activity from dominating everything. The Compendium explains the ingredients but not the exact recipe.</p>` }
    ],
    related: ["releases", "fame-fans", "media-pr", "events"]
  },
  {
    id: "politics",
    category: "World",
    title: "Politics, elections & city governance",
    summary: "Take part in civic life, city elections and longer-term political careers.",
    level: "Intermediate",
    tags: ["politics", "elections", "mayor", "parliament", "party"],
    sections: [
      { title: "City politics", html: `<p>Characters can participate in elections and civic systems where enabled. Reputation, engagement and the rules of the specific election matter more than musical fame alone.</p>` },
      { title: "Leadership", html: `<p>Mayoral and parliamentary systems connect player activity to the wider world. Office can provide responsibility and influence, not unrestricted control over game systems.</p>` },
      { title: "Political progression", html: `<p>Political parties, standings and career history create a separate progression path that can coexist with a music career.</p>` }
    ],
    related: ["travel-cities", "social", "finances-banking"]
  },
  {
    id: "nightlife-underworld",
    category: "World",
    title: "Nightlife, casino & underworld",
    summary: "Optional risk-and-recreation systems away from the main music career.",
    level: "Intermediate",
    tags: ["nightclub", "casino", "underworld", "blackjack", "roulette", "slots"],
    sections: [
      { title: "Nightlife", html: `<p>Nightclubs and social venues provide entertainment and can connect to wider city and business systems.</p>` },
      { title: "Casino games", html: `<p>Casino activities use in-game systems and are optional. They should be treated as entertainment rather than a dependable career-income strategy.</p>` },
      { title: "Underworld systems", html: `<p>Where underworld content is available, it is separated from ordinary career progression and can carry its own risks and consequences. Exploit-sensitive probabilities and enforcement rules are intentionally not documented.</p>` }
    ],
    related: ["finances-banking", "wellness", "world-places"]
  },
  {
    id: "education-employment",
    category: "Career & economy",
    title: "Education, teaching & employment",
    summary: "Learn through multiple routes, earn money and develop careers beyond performing.",
    level: "Beginner",
    tags: ["education", "jobs", "teaching", "university", "tutor", "career"],
    sections: [
      { title: "Learning routes", html: `<p>Lessons, tutorials, personal practice, tutors, other musicians and universities provide different ways to develop. They vary in cost, time and suitability.</p>` },
      { title: "Teaching", html: `<p>Experienced characters can turn expertise into a teaching path where the relevant systems permit it. Being highly skilled and being an effective teacher are related concepts rather than necessarily the same number.</p>` },
      { title: "Employment", html: `<p>Jobs provide income and career activity, but they occupy time that could otherwise be used for travel, writing, recording or performance. The right job depends partly on what else your character is trying to achieve.</p>` }
    ],
    related: ["skills", "schedule", "finances-banking", "businesses"]
  },
  {
    id: "finances-banking",
    category: "Career & economy",
    title: "Finances, banking, loans & property",
    summary: "Keep personal and group money understandable while funding a growing career.",
    level: "Intermediate",
    tags: ["money", "bank", "loan", "mortgage", "property", "finances"],
    sections: [
      { title: "Separate pots of money", html: `<p>Character money, bank accounts, band money and company finances represent different owners. A band recording should not silently behave like a personal purchase if the band is meant to fund it.</p>` },
      { title: "Banking", html: `<p>Accounts allow money to be deposited, held and transferred through supported flows. Transactions should feed into finance history so players can understand where money went.</p>` },
      { title: "Loans and property", html: `<p>Borrowing and property systems create longer-term commitments. Consider recurring obligations before tying up money needed for travel, recording, promotion or touring.</p>` }
    ],
    related: ["band-finances", "businesses", "character-life", "education-employment"]
  },
  {
    id: "band-finances",
    category: "Career & economy",
    title: "Band finances",
    summary: "Shared income, spending and financial responsibility inside a band.",
    level: "Intermediate",
    tags: ["band money", "income", "expenses", "royalties", "tour costs"],
    sections: [
      { title: "Band money belongs to the band", html: `<p>Gig income, band costs and shared activities should flow through band finances where appropriate. Members can still pay personally when a feature explicitly offers that choice.</p>` },
      { title: "Typical pressures", html: `<p>Studios, rehearsal, crew, stage equipment, travel and touring can create significant costs before larger income arrives. Bands that grow too quickly can become famous and cash-poor at the same time.</p>` },
      { title: "Audit your history", html: `<p>Use transaction and finance views to understand inflows and outflows instead of judging only the current balance.</p>` }
    ],
    related: ["bands", "gigs", "tours", "finances-banking"]
  },
  {
    id: "fame-fans",
    category: "Career & economy",
    title: "Fame, fans & sponsorships",
    summary: "Build an audience, convert attention into opportunities and manage the difference between recognition and loyalty.",
    level: "Intermediate",
    tags: ["fame", "fans", "sponsor", "popularity", "audience"],
    sections: [
      { title: "Fame and fans are related, not identical", html: `<p>Fame describes recognition; fans represent an audience with stronger attachment. Performances, releases, media and sustained activity can contribute in different ways.</p>` },
      { title: "Local and broader reach", html: `<p>Your strength can vary by city or audience. Touring and media can expand reach rather than every act instantly becoming equally famous everywhere.</p>` },
      { title: "Sponsorship", html: `<p>Brands and sponsors care about fit as well as raw scale. Reputation, audience and the context of an opportunity can influence whether a partnership makes sense.</p>` }
    ],
    related: ["media-pr", "gigs", "releases", "charts-pulse"]
  },
  {
    id: "achievements-awards",
    category: "Career & economy",
    title: "Awards, achievements & career history",
    summary: "Recognition for milestones, competition success and long-term careers.",
    level: "Beginner",
    tags: ["awards", "achievements", "trophy", "history", "legacy"],
    sections: [
      { title: "Achievements", html: `<p>Achievements reward notable milestones and encourage players to explore more of the world. Some are obvious goals; others can be discovered through play.</p>` },
      { title: "Awards", html: `<p>Awards recognise standout performance in relevant periods or categories. Their value is prestige and history rather than simply another source of raw power.</p>` },
      { title: "Long-term record", html: `<p>Discography, statistics, journals and legacy views make it possible to look back on the shape of a career rather than only the latest leaderboard.</p>` }
    ],
    related: ["family-legacy", "events", "charts-pulse", "releases"]
  },
  {
    id: "media-pr",
    category: "Career & economy",
    title: "Media, PR & self-promotion",
    summary: "Use radio, television, press, podcasts and promotional activity to expand awareness.",
    level: "Intermediate",
    tags: ["pr", "radio", "tv", "newspaper", "magazine", "podcast", "promotion"],
    sections: [
      { title: "Media ecosystem", html: `<p>RockMundo includes radio, television, newspapers, magazines, podcasts, films, websites and other media surfaces. Opportunities may differ in reach, fit and requirements.</p>` },
      { title: "Public relations", html: `<p>PR opportunities are scheduled commitments with eligibility and timing. If your character is busy, in the wrong place or the opportunity has expired, the game should tell you why rather than fail silently.</p>` },
      { title: "Promotion is supportive, not magical", html: `<p>Promotion can increase attention around worthwhile activity, but it is not intended to turn an unprepared song or poor show into guaranteed success.</p>` }
    ],
    related: ["fame-fans", "releases", "social", "charts-pulse"]
  },
  {
    id: "social",
    category: "Social & community",
    title: "Friends, players, messages & social activities",
    summary: "Find people, communicate, form relationships and create shared activity outside band management.",
    level: "Beginner",
    tags: ["friends", "messages", "players", "social", "invitations", "contracts"],
    sections: [
      { title: "Finding people", html: `<p>Player search and discovery help you find musicians, collaborators and friends. Band recruitment is connected to the social world but has its own role-focused tools.</p>` },
      { title: "Communication", html: `<p>Messages and invitations keep collaboration inside the game. Where supported, players can also exchange permitted items or money through explicit flows rather than informal database side effects.</p>` },
      { title: "Social activities and contracts", html: `<p>Activities create scheduled shared experiences, while contracts and agreements provide structure for commitments that should persist beyond a chat message.</p>` }
    ],
    related: ["twaater", "band-governance", "family-legacy", "media-pr"]
  },
  {
    id: "twaater",
    category: "Social & community",
    title: "Twaater, Gettit & social feeds",
    summary: "Public conversation, followers and community-driven attention inside the game world.",
    level: "Beginner",
    tags: ["twaater", "gettit", "social media", "followers", "posts"],
    sections: [
      { title: "Twaater", html: `<p>Twaater lets characters and bands post publicly, build followers, discuss releases and gigs, and become part of the game's social narrative.</p>` },
      { title: "Followers and fame", html: `<p>Audience size can connect to wider fame without every post becoming a guaranteed growth action. Content, account context and world activity can all shape outcomes.</p>` },
      { title: "Community feeds", html: `<p>Gettit and related feeds make player activity discoverable. They are designed to make the world feel inhabited rather than act as a mandatory progression grind.</p>` }
    ],
    related: ["social", "fame-fans", "media-pr"]
  },
  {
    id: "businesses",
    category: "Business",
    title: "Companies & business management",
    summary: "Operate approved businesses, employ staff and balance service quality with financial sustainability.",
    level: "Advanced",
    tags: ["business", "company", "staff", "recruitment", "reports"],
    sections: [
      { title: "Business ownership", html: `<p>RockMundo's business systems cover specific company types and management roles rather than turning every player into an unrestricted tycoon. Access and ownership rules can vary by business type.</p>` },
      { title: "Operating a company", html: `<p>Staff, recruitment, finances, advertising and reports are the core management concerns. A business should create value in the world it serves, not only generate passive cash.</p>` },
      { title: "Specialist businesses", html: `<p>Venues, rehearsal studios, recording studios, security firms, merchandise factories, logistics companies, labels and festivals each have domain-specific management on top of general company finances.</p>` }
    ],
    related: ["world-places", "labels-business", "merch-logistics", "festivals"]
  },
  {
    id: "labels-business",
    category: "Business",
    title: "Record labels & music business",
    summary: "The commercial organisations around releases, artist relationships and recorded music.",
    level: "Advanced",
    tags: ["label", "record label", "release", "contract", "royalty"],
    sections: [
      { title: "Labels", html: `<p>Labels can support the commercial side of recorded music, including releases and artist relationships. Management requires more than simply owning a catalogue.</p>` },
      { title: "Rights and money", html: `<p>Song ownership, recording rights, agreements and royalties should remain traceable. A successful release can involve several parties with different shares.</p>` },
      { title: "Artist fit", html: `<p>Commercial scale matters, but a label's value also comes from choosing suitable artists and supporting releases at the right stage of a career.</p>` }
    ],
    related: ["releases", "businesses", "songwriting", "finances-banking"]
  },
  {
    id: "merch-logistics",
    category: "Business",
    title: "Merchandise, factories & logistics",
    summary: "Turn audience demand into products while paying the real operational costs behind them.",
    level: "Intermediate",
    tags: ["merch", "factory", "logistics", "shipping", "production"],
    sections: [
      { title: "Merchandise demand", html: `<p>Merch can sell during ordinary periods and around live activity. Demand broadly follows audience strength and context rather than being a fixed daily print-money button.</p>` },
      { title: "Costs", html: `<p>Production, staffing, packaging, shipping and other operational costs mean gross sales are not the same as profit.</p>` },
      { title: "Specialist providers", html: `<p>Factories and logistics businesses support the supply chain. Scale creates efficiencies and opportunities, but also larger commitments and potential bottlenecks.</p>` }
    ],
    related: ["businesses", "fame-fans", "gigs", "tours"]
  },
  {
    id: "premium",
    category: "Reference",
    title: "VIP, cosmetics & premium items",
    summary: "How paid and premium systems fit around the game without becoming pay-to-win progression.",
    level: "Reference",
    tags: ["vip", "skins", "premium", "cosmetics", "store"],
    sections: [
      { title: "Cosmetics first", html: `<p>Premium clothing, instruments, skins and collectible presentation are intended to support personalisation and the game economically without selling decisive musical power.</p>` },
      { title: "VIP", html: `<p>VIP or subscription-style benefits should improve convenience, presentation or optional extras while preserving the integrity of the core simulation.</p>` },
      { title: "No hidden purchase multiplier", html: `<p>The Compendium will not imply that spending money is required to compete. If a premium item has a gameplay-relevant effect, that effect should be visible and understandable rather than secretly boosting outcomes.</p>` }
    ],
    related: ["character-life", "mechanics-disclosure", "getting-started"]
  },
  {
    id: "faq",
    category: "Reference",
    title: "Frequently asked questions",
    summary: "Short answers to common questions about progression and the simulation.",
    level: "Reference",
    tags: ["faq", "help", "questions"],
    sections: [
      { title: "Do I need to join a band?", html: `<p>No. Bands unlock a large part of the shared live-music experience, but solo development, work, education, songwriting and other careers remain useful.</p>` },
      { title: "Is there a best skill build?", html: `<p>No single published build is intended to dominate every activity. Your goals, role, band lineup and preferred career should shape your choices.</p>` },
      { title: "How do I guarantee a hit song?", html: `<p>You cannot. Strong material, recording, audience, promotion and timing can improve your chances, but RockMundo deliberately keeps uncertainty in the music market.</p>` },
      { title: "How many times should I rehearse before a gig?", html: `<p>There is no official magic count. Use your current familiarity, chemistry, readiness and the importance of the show to decide.</p>` },
      { title: "Why does the wiki not show exact formulas?", html: `<p>Because the game should reward understanding and good decisions without collapsing into one solved optimisation route. See the mechanics disclosure policy for the full approach.</p>` }
    ],
    related: ["mechanics-disclosure", "getting-started", "gigs", "releases"]
  }
];

const categoryOrder = [
  "Start here",
  "Character",
  "Music",
  "Band & live",
  "World",
  "Career & economy",
  "Social & community",
  "Business",
  "Reference"
];

const articleById = new Map(articles.map((article) => [article.id, article]));
const contentEl = document.getElementById("article-content");
const navigationEl = document.getElementById("category-navigation");
const tocEl = document.getElementById("page-toc");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("wiki-search");
const searchResultsEl = document.getElementById("search-results");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildNavigation() {
  navigationEl.innerHTML = categoryOrder
    .map((category) => {
      const links = articles
        .filter((article) => article.category === category)
        .map((article) => `<a href="#${article.id}" data-article-link="${article.id}">${escapeHtml(article.title)}</a>`)
        .join("");
      return `<section class="nav-group"><h2>${escapeHtml(category)}</h2>${links}</section>`;
    })
    .join("");
}

function relatedMarkup(article) {
  const related = (article.related || [])
    .map((id) => articleById.get(id))
    .filter(Boolean)
    .slice(0, 4);

  if (!related.length) return "";

  return `<nav class="article-footer-nav" aria-label="Related articles">${related
    .map(
      (item) => `<a class="article-link" href="#${item.id}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary)}</span></a>`
    )
    .join("")}</nav>`;
}

function renderToc(article) {
  tocEl.innerHTML = article.sections
    .map((section) => {
      const id = `section-${slugify(section.title)}`;
      return `<li><a href="#${id}" data-local-anchor="true">${escapeHtml(section.title)}</a></li>`;
    })
    .join("");
}

function renderArticle(article) {
  document.title = `${article.title} | RockMundo Compendium`;
  contentEl.innerHTML = `
    <p class="article-kicker">${escapeHtml(article.category)} · ${escapeHtml(article.level)}</p>
    <h1>${escapeHtml(article.title)}</h1>
    <p class="article-lead">${escapeHtml(article.summary)}</p>
    <div class="article-meta">
      <span>Player-facing guide</span>
      <span>Formula-safe</span>
      <span>Reviewed for the current game structure</span>
    </div>
    ${article.sections
      .map((section) => `<section><h2 id="section-${slugify(section.title)}">${escapeHtml(section.title)}</h2>${section.html}</section>`)
      .join("")}
    ${relatedMarkup(article)}
  `;

  renderToc(article);
  updateActiveNavigation(article.id);
  searchResultsEl.hidden = true;
  document.getElementById("article")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderHome() {
  document.title = "RockMundo Compendium";
  const portals = categoryOrder
    .filter((category) => !["Start here", "Reference"].includes(category))
    .map((category) => {
      const first = articles.find((article) => article.category === category);
      const count = articles.filter((article) => article.category === category).length;
      return `<a class="portal-card" href="#${first.id}"><strong>${escapeHtml(category)}</strong><span>${count} guide${count === 1 ? "" : "s"} covering this part of RockMundo.</span></a>`;
    })
    .join("");

  contentEl.innerHTML = `
    <p class="article-kicker">The RockMundo player bible</p>
    <h1>RockMundo Compendium</h1>
    <p class="article-lead">A practical guide to the people, music, places, careers and systems that make up RockMundo. It is detailed enough to help you make good decisions without publishing the hidden numbers that would turn the simulation into a solved spreadsheet.</p>

    <div class="note-box"><strong>Start here:</strong> if this is your first day, read <a href="#getting-started">Getting started</a>, then <a href="#schedule">Schedule & activities</a> and <a href="#skills">Skills & progression</a>.</div>

    <h2 id="explore">Explore the world</h2>
    <div class="portal-grid">${portals}</div>

    <h2 id="career-loop">The core music-career loop</h2>
    <ol>
      <li><strong>Develop:</strong> build skills and look after your character.</li>
      <li><strong>Create:</strong> write or discover songs worth investing in.</li>
      <li><strong>Prepare:</strong> practise, rehearse, jam and build chemistry.</li>
      <li><strong>Record:</strong> use performers, studios and production to make recordings.</li>
      <li><strong>Release:</strong> distribute music and support it with media and promotion.</li>
      <li><strong>Perform:</strong> build setlists, production and touring plans.</li>
      <li><strong>Grow:</strong> turn activity into fans, fame, opportunities, history and new ambitions.</li>
    </ol>
    <p>The loop is deliberately not linear. You can spend weeks touring, focus on songwriting, become a producer, build a business, teach, enter politics or simply develop a character at your own pace.</p>

    <h2 id="mechanics">Understanding mechanics without spoilers</h2>
    <table class="mechanics-table"><thead><tr><th>The Compendium tells you</th><th>The Compendium does not publish</th></tr></thead><tbody><tr><td>Which broad factors affect an outcome</td><td>Exact coefficients and hidden scoring weights</td></tr><tr><td>Visible rules, costs and restrictions</td><td>Anti-abuse thresholds or manipulation checks</td></tr><tr><td>What good preparation looks like</td><td>One mathematically optimal grind loop</td></tr><tr><td>Why something probably went well or badly</td><td>Full random-event probability tables</td></tr></tbody></table>
    <p>Read <a href="#mechanics-disclosure">How the Compendium explains mechanics</a> for the policy used across every article.</p>

    <h2 id="featured">Useful starting articles</h2>
    <div class="link-grid">
      <a class="article-link" href="#songwriting"><strong>Songwriting</strong><span>Create original material and collaborate without reducing songs to a published formula.</span></a>
      <a class="article-link" href="#gigs"><strong>Gigs & live performance</strong><span>Understand bookings, preparation, production and post-show feedback.</span></a>
      <a class="article-link" href="#releases"><strong>Releases, streaming & sales</strong><span>Follow music from finished recording to commercial performance.</span></a>
      <a class="article-link" href="#festivals"><strong>Festivals</strong><span>Perform at or operate complex multi-stage events.</span></a>
    </div>
  `;

  tocEl.innerHTML = `
    <li><a href="#explore" data-local-anchor="true">Explore the world</a></li>
    <li><a href="#career-loop" data-local-anchor="true">Core music-career loop</a></li>
    <li><a href="#mechanics" data-local-anchor="true">Mechanics without spoilers</a></li>
    <li><a href="#featured" data-local-anchor="true">Useful starting articles</a></li>
  `;
  updateActiveNavigation(null);
  searchResultsEl.hidden = true;
}

function updateActiveNavigation(activeId) {
  document.querySelectorAll("[data-article-link]").forEach((link) => {
    if (link.dataset.articleLink === activeId) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function currentRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "home") return { type: "home" };
  if (hash.startsWith("section-")) return { type: "section" };
  if (articleById.has(hash)) return { type: "article", article: articleById.get(hash) };
  return { type: "home" };
}

function route() {
  const target = currentRoute();
  if (target.type === "section") return;
  if (target.type === "article") {
    renderArticle(target.article);
  } else {
    renderHome();
  }
}

function articleSearchText(article) {
  return [
    article.title,
    article.summary,
    article.category,
    article.level,
    ...(article.tags || []),
    ...article.sections.map((section) => `${section.title} ${section.html.replace(/<[^>]*>/g, " ")}`)
  ]
    .join(" ")
    .toLowerCase();
}

function search(query) {
  const clean = query.trim().toLowerCase();
  if (!clean) {
    searchResultsEl.hidden = true;
    return;
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  const results = articles
    .map((article) => {
      const haystack = articleSearchText(article);
      const title = article.title.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (title.includes(token)) score += 6;
        if (article.tags.some((tag) => tag.includes(token))) score += 4;
        if (article.summary.toLowerCase().includes(token)) score += 2;
        if (haystack.includes(token)) score += 1;
      }
      return { article, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, 12);

  searchResultsEl.hidden = false;
  searchResultsEl.innerHTML = `
    <h2>Search results for “${escapeHtml(query.trim())}”</h2>
    ${results.length
      ? results
          .map(
            ({ article }) => `<a class="search-result" href="#${article.id}"><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.category)} — ${escapeHtml(article.summary)}</span></a>`
          )
          .join("")
      : `<p class="search-empty">No articles matched. Try a broader term such as “gig”, “skills”, “money”, “band” or “release”.</p>`}
  `;
  searchResultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  search(searchInput.value);
});

searchInput.addEventListener("input", () => {
  if (!searchInput.value.trim()) {
    searchResultsEl.hidden = true;
  }
});

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("section-")) return;
  route();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-local-anchor='true']");
  if (!link) return;
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
});

buildNavigation();
route();
