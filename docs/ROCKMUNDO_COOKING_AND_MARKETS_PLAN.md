# Rockmundo: Cooking, Regional Markets and Food Trading

Design proposal — 21 October 2026. Planning only; no game or database changes have been made. All numbers are initial balancing proposals. Regional examples and restrictions are fictional game configuration, not claims about real-world production, laws or drug effects. Existing repository integrations must be inspected before implementation.

## 1. Feature purpose and player loop

Create a culinary profession alongside Luthiery: learn skills, acquire materials, improve a workshop, unlock recipes, produce identifiable batches and sell crafted goods. Food is consumed and expires, giving the profession repeat demand rather than permanent-item saturation.

The loop is: visit a city market → buy local or imported ingredients → choose a recipe and batch size → drag ingredients into a pan and cook them to the right colour → inspect the result → eat, gift or sell individual portions → reinvest in skills and kitchen equipment.

A musician can make affordable soup before practice. A specialist baker can supply a band's tour. A travelling merchant can move regional ingredients between cities, accepting spoilage and transport costs. Mayors improve the infrastructure that supports these businesses.

## 2. Profession and progression

- Add Cooking under Career, with a small starter kitchen available to everyone. A shop lease is optional for selling, rather than an entry requirement for cooking.
- Use Basic → Professional → Mastered tiers, following Rockmundo's education direction. Hide locked higher tiers until their prerequisites are met.
- Core Cooking controls execution and consistency. Baking, Savoury Cooking and Drinks Preparation unlock specialist recipes; Preservation follows in a later phase.
- Gain XP from completed legitimate batches, with diminishing returns for repeating trivial recipes. Ingredient purchases, canceled jobs and self-trading award no XP.
- Learn through recipe books, university courses, mentors, fictional in-game videos and regional discoveries. Support the education hub's owned/learning/progress/next-step views.
- Unlock recipe families before rare regional variants. Provide several accessible recipes at each tier, including vegetarian options.
- Equipment improves quality ceilings, batch capacity and reliability. It never replaces required skills or eliminates restricted-item risks.

Use Luthiery's interaction pattern where appropriate: recipe selection, required ingredients, equipment, craft duration, predicted quality and completion summary. Reuse proven infrastructure only after checking it supports perishable batches and partial sales.

## 3. Ingredients and regional production

Each ingredient has a category, origin, quality, quantity/unit, purchase price, freshness timestamps and optional restriction tags. City production profiles inherit country defaults and add local specialties. Production is scheduled stock replenishment; separate farming gameplay is outside the initial scope.

| Example game region | Proposed specialties | Example recipe identity |
| --- | --- | --- |
| United Kingdom; London/Manchester variants | Apples, oats, root vegetables, dairy | Apple pie, oat biscuits, vegetable soup |
| France; Paris/Lyon variants | Flour, butter, orchard fruit, cheese | Fruit tart, onion soup, pastries |
| Italy; Rome/Naples variants | Tomatoes, herbs, citrus, wheat | Tomato soup, citrus cake, flatbread |
| Japan; Tokyo/Osaka variants | Rice, tea, mushrooms, soy ingredients | Rice bowls, mushroom soup, tea cakes |
| Mexico; Mexico City variants | Maize, beans, peppers, cocoa | Bean stew, maize bread, cocoa drinks |
| India; Mumbai/Delhi variants | Lentils, spices, tea, mango | Lentil soup, spiced tea, mango sweets |
| Brazil; São Paulo/Rio variants | Coffee, tropical fruit, sugar | Coffee cake, fruit drinks, bean stew |

These are seed examples, not exhaustive cultural definitions. Map every supported game city to a reviewed profile; avoid leaving less-developed regions without useful recipes.

- Basics remain available everywhere at reasonable quality. Local specialties are cheaper, fresher or more plentiful at origin.
- Imports cost more and arrive less frequently. Market upgrades increase access without removing regional advantages.
- Use common ingredients plus optional specialty slots, so one rare ingredient cannot block an entire profession.
- Regional recipe bonuses should encourage travel without making one city the universally best place to cook.
- Stock and prices have configurable floors, ceilings and restock caps. Scale basic supply with active demand so a few wealthy players cannot lock beginners out.

## 4. Mayor-controlled city markets

Give every city a visible Market page and baseline market. Mayors spend city treasury funds on permanent upgrades and budget for maintenance. Benefits belong to the city and survive mayor changes.

| Upgrade track | Gameplay benefit | Guardrail |
| --- | --- | --- |
| Market size, levels 1–5 | More ingredient stock and player stall capacity | No infinite stock; demand-scaled baseline remains |
| Supplier quality, levels 1–5 | Better average ingredient quality and premium supply | High-grade stock remains limited |
| Product variety, levels 1–5 | More local varieties and import slots | Preserve regional specialties |
| Cold storage, levels 1–5 | Slower freshness loss for eligible market goods | Never restores freshness or revives expired goods |
| Trade facilities, later phase | Better import capacity and lower transport overhead | Cannot bypass destination restrictions |

Show price, build time, maintenance, expected stock changes and treasury impact before purchasing. Upgrades take time and require available funds; maintenance shortfalls pause additional benefits after a grace period rather than deleting levels or player items. Show public spending and upgrade history.

NPC ingredient supply and player food listings are separate market sections. NPC stock is a money sink. Player sales transfer money and pay a disclosed market fee to the city; fee rates are bounded. No guaranteed NPC purchase of crafted food and no promise that upgrades automatically pay for themselves.

## 5. Cooking and batch quality

Every recipe defines ingredient slots, skill prerequisites, equipment, craft time, portion yield, shelf life, effect family, legal tags and outcome rules. Show the complete cost and expected output before starting.

- One active cooking job per character initially. Hands-on cooking uses a proposed 45–120 second visual mini-game. Recipes needing further baking, simmering or setting can then have a disclosed 10–60 minute passive finishing stage.
- Reserve and consume ingredients atomically at job start. Passive finishing stages and explicitly selected assisted-cooking jobs finish while offline and appear in schedules with completion notifications. The live pan stage requires attention; disconnecting does not automatically produce a successful batch.
- Cancellation returns no consumed ingredients; disclose this before starting. Server failures support an audited recovery path.
- Proposed quality score: 30% ingredient quality + 25% relevant skill + 15% equipment + 10% recipe mastery + 20% mini-game execution. Execution reflects ingredient order and doneness when removed from the pan. Normalize inputs to 0–100; these are starting tuning weights.
- Quality grades: Poor, Standard, Good, Excellent and Exceptional. Skills modestly widen the ideal cooking window; they do not prevent burning. Burnt or undercooked essential components impose recipe-specific quality caps or fail the batch regardless of the weighted score.
- Quality affects bounded buff strength, portion yield or sale desirability. Shelf life is primarily recipe/storage based, not an unlimited high-quality multiplier.
- A low-quality result is not automatically spoiled. Failed batches can become unusable waste and give limited learning XP; never create profitable failure loops.
- Store maker, origin, recipe version, quality, craft time, portions, restrictions and expiry on each batch. A pie can produce several separately usable slices sharing the same origin and expiry.

### 5A. Visual cooking mini-game

Make cooking a hands-on activity with an ingredient tray, a large illustrated pan, a heat control and a serving plate. Players drag and drop food into the pan, watch it change colour, and remove it when cooked. Leaving it on the pan too long burns it. Include this interaction in the first cooking release.

**Player flow**

1. Choose a recipe and batch size. Preview ingredients, steps, expected yield, cooking windows and failure consequences before spending resources. A free practice tutorial gives no saleable rewards.
2. Start with the pan off. Drag ingredients from the tray into valid pan slots. The tray represents the job's already reserved ingredients. Dropping outside a target returns the item to the tray without losing it.
3. Turn on the heat. Each ingredient cooks from the moment it enters the heated pan. Add ingredients at different times when their cooking requirements differ.
4. Watch gradual colour and texture changes, steam and sizzling. Move each item onto the plate during its ideal cooking window. The plate stops further cooking. Heat controls change cooking speed: higher heat is faster but leaves less real time to react.
5. Finish plating. Show each component's doneness, the execution score and its contribution to final batch quality. Commit one outcome; consumed ingredients cannot be replayed for a better result.

| State | Visual and accessible feedback | Result on removal |
| --- | --- | --- |
| Raw / undercooked | Original colour and texture; labelled early progress | Quality penalty, or unusable if an essential component requires full cooking |
| Cooking | Gradual colour shift, steam and sizzling | Below target; reduced execution score |
| Ready | Recipe-specific golden, browned, softened or translucent appearance; “Ready” label and optional chime | Highest execution score within the ideal window |
| Overdone | Darker edges and an “Overdone” warning | Reduced quality and potentially fewer usable portions |
| Burnt | Blackened areas, smoke and a clear “Burnt” label | Irreversible failed component; essential components can fail the batch |

Use different visual stages per ingredient: onions turn translucent then golden; mushrooms darken. Do not apply one generic colour tint to everything. Pair colour with labels, textures and a doneness indicator so players do not need colour perception or audio to succeed. Smoke is feedback, not a separate fire-management system.

**Timing, difficulty and quality**

- Recipe steps define ingredient order, pan capacity, heat response, ideal window and burn threshold. Illustrative tutorial timing at medium heat: ready at 12–16 seconds, overdone after 16 seconds and burnt at 21 seconds. Other ingredients use different timings; all numbers require playtesting.
- Score required components by doneness, with a small order bonus only where the recipe calls for a particular order. Avoid rapid clicking, pixel-perfect placement and decorative plating requirements.
- Cooking progress accumulates across removal and re-entry. Neither resets the item or reverses burning. Plating or splitting items never creates extra servings beyond the recipe's yield.
- A burnt garnish may lower quality or yield; a burnt essential component may fail the batch. Display those rules before starting. Unusable burnt or undercooked results cannot be sold or consumed as ordinary food.
- Higher skills and better equipment provide clearer hints and modestly wider ideal windows, within limits. Leaving food on the heat indefinitely always burns it. Mini-game success cannot remove restricted-item risks, restrictions or expiry.
- Start with one pan, three to five ingredient groups and one plating stage. Large batches scale portions, not the number of individual pieces players must drag.

**Recipe types and offline play**

Pan dishes use the full add → colour change → remove loop. Soup can start with pan-cooked ingredients before a passive simmer; pies can use a pan-cooked filling before baking. Cakes use mixing and an oven presentation with batter-to-golden-to-burnt stages. Drinks use appropriate preparation steps instead of forcing every recipe into a pan.

An explicitly selected assisted-cooking route preserves offline crafting. Choose it before spending ingredients: use the passive job system and a disclosed skill-based execution contribution, with no manual timing bonus. Balance it so assisted cooking remains useful and skilled hands-on play can improve quality without an exclusive buff tier. A player cannot switch an already burning manual attempt into assisted success.

**Mobile, accessibility and interruptions**

Support touch dragging with large targets and cues that remain visible around the player's finger. Offer equivalent tap ingredient → tap pan/plate and keyboard controls. Include reduced motion, optional sounds and a labelled slower timing setting that preserves the same progress relationships and quality opportunities.

During a manual session, heat continues while backgrounded or disconnected. Warn before starting; provide a prominent “Heat off” action while connected. Reconnecting restores the actual cooking state, including burning. Turning heat off stops further cooking without resetting accumulated progress or ingredient freshness. Enforce a disclosed maximum session lifetime so abandoned jobs finalize once instead of blocking a character indefinitely.

**Implementation and verification**

Record recipe version, selected mode, accepted add/remove/heat actions, progress timestamps and final execution score. The server derives doneness from its clock and validated actions; the client animates that state and cannot submit arbitrary quality. Use a bounded latency allowance and generous windows suitable for mobile connections. Browser timer throttling and low frame rates must not alter the outcome. A second device cannot restart or duplicate the session.

Verify ideal timing, early removal, staggered ingredients, heat changes, overcooking, irreversible burning, invalid drops, repeated removal/re-entry, partial failures, timeout, reconnect and concurrent devices. Drag, tap and keyboard controls must yield equivalent results. Test reduced motion and colour-independent cues. Completion retries must never duplicate batches, ingredient charges or XP.

## 6. Example recipes and boosts

Boosts apply to actions performed during their duration, not retroactively to already-started jobs. Values below are fictional game modifiers.

| Item | Main effect proposal | Duration | Base shelf life |
| --- | --- | --- | --- |
| Vegetable soup | +5% recovery from eligible rest actions | 3 hours | 2 days |
| Hearty pie | +5% rehearsal effectiveness | 3 hours | 3 days |
| Apple cake | +5% songwriting polish gain | 2 hours | 3 days |
| Spiced lentil stew | +5% practice XP | 3 hours | 2 days |
| Tea and oat biscuits | +5% learning XP | 2 hours | 4 days |
| Fruit drink | +5% energy restored by eligible recovery actions | 1 hour | 2 days |
| Premium coffee | +8% learning XP with a short cooldown | 1 hour | 2 days |
| Regional celebration cake | +8% songwriting consistency gain | 2 hours | 3 days |

Percentage gains affect the gain awarded by eligible gameplay, not permanent base stats. Energy/rest bonuses respect existing caps. Do not multiply direct AP purchases, VIP benefits or other premium entitlements.

Give food two buff slots: Meal and Drink. Only one effect per slot; overlapping stat bonuses use the stronger contribution rather than adding or multiplying. Propose a +10% total legal-food cap per stat. The consume preview shows what will replace an existing effect. Repeated consumption cannot extend buffs beyond the configured duration cap. No automatic consumption by default and no penalty for choosing not to participate.

Bind effect calculation to the server. Define each integration point explicitly: reading/course/practice reward, songwriting consistency/polish action, rehearsal result and recovery action. Show the food contribution in the result breakdown. Completion after a buff expires must follow the documented action eligibility rule; never let long-running jobs snapshot a short buff across their full duration accidentally.

## 7. Freshness, expiry and storage

Use real elapsed time, including time offline, with exact expiry dates and the player's local display time. Most prepared goods last 2–4 days; all launch food and drink remains perishable.

- Fresh: full quality. Near expiry: visible amber warning and a disclosed reduction in beneficial strength. Expired: cannot consume, list, sell, gift or use as an ingredient.
- Ingredients have their own shelf lives; dry staples may last longer than prepared food. The recipe output expiry is the earlier of its recipe deadline and the earliest relevant ingredient expiry plus an explicit recipe-specific processing allowance. Default allowance is zero. Recooking near-expired stock must never silently reset it to a full shelf life.
- Refrigeration slows remaining freshness loss within a fixed maximum extension. Track elapsed freshness consumption across storage changes; moving, listing, relisting, splitting or trading never resets age.
- Keep a simple fixed expiry model for the first release. Add storage modifiers later after testing transport and marketplace transitions.
- Listing expiry can be shorter than food expiry. Buyer sees exact remaining life, including any storage changes on collection.
- Expired listings are withdrawn automatically. Transaction-time checks protect players if cleanup is late. Expired items can be discarded; composting is a later cosmetic or tightly capped utility, not a cash refund.
- Effects already active continue to their own end time even if unused portions in the source batch expire.

## 8. Player trading and shops

Start with local city stalls. Sellers list a portion quantity and price; the listed quantity is placed in escrow and cannot also be consumed. Purchases deliver to the buyer's inventory in that city atomically. Later, optional player kitchens and branded shops add menus, seller reputation and bulk band orders.

Listings display artwork, maker, origin, grade, effect range, duration, legal status, quantity and remaining shelf life. Filters cover food type, effect, quality, origin, price and freshness. No cross-city instant purchasing initially: travelling with goods preserves the regional economy and exposes them to destination rules.

Split quantities retain batch identity and expiry; prices are per portion. Buyers cannot be charged for expired goods, missing quantity or stock sold concurrently. Avoid NPC resale guarantees, circular-trade XP and seller-created hidden effects. Use a ledger, bounded fees and audit tools to investigate duplication or self-trade abuse.

## 9. Restricted and illegal goods

Support item-specific rules at country and city level: Allowed, Licensed or Banned. Country defaults provide the base; city policy can tighten rules, and can relax them only where country configuration permits. This is a fictional game law system. Show restrictions on the map, ingredient cards, recipe screen, travel screen and purchase/consume preview.

Model possession, crafting, sale, consumption and transport separately. A city can permit possession but prohibit sale. Evaluate rules at action time, including ingredients and finished items. Cooking does not strip an ingredient's restriction tags.

Mayors can propose policy changes within configured bounds. Announce changes with a 24-hour notice period and immutable policy history. Existing owners receive clear handling options before enforcement; do not apply retrospective fines. Banned listings are suspended and returned to their owner's secured inventory, without making an otherwise illegal sale possible.

Introduce licensed trade before a dedicated underground market. A later underground channel can allow prohibited transactions explicitly, with server-resolved inspection risk, confiscation, bounded fines and temporary market restrictions. Public stalls must never accidentally allow banned sales. No real-world recipes, drug quantities or operational concealment instructions are part of the game content.

### Example: cannabis cake

An optional restricted recipe with a higher possible songwriting creativity boost and unpredictable adverse effects. The following probabilities are fictional balancing values, not medical claims.

| Outcome | Probability | Gameplay result |
| --- | --- | --- |
| Inspired | 40% | +15% creativity gain for 2 hours |
| Distracted inspiration | 25% | +10% creativity gain and −5% polish gain for 2 hours |
| No useful effect | 20% | No songwriting bonus; portion consumed |
| Bad reaction | 15% | −10% creativity gain for 2 hours and −5 health, clamped to the game's nonfatal floor |

This gives higher peaks but only +7% expected creativity gain before considering the polish/health costs. Compare against reliable premium legal alternatives in simulations. If the ordinary-food cap is +10%, restricted outcomes may reach +15%, subject to one global +15% food cap; restricted items occupy the Meal slot and never stack with other restricted effects.

Show every possible outcome and probability before consuming. Resolve the outcome once on the server when consumption commits; retries, refreshes and reconnections cannot reroll it. Negative results cannot be cleared by immediately eating another meal. Add an example six-hour restricted-item cooldown, bounded adverse duration, clear recovery information and no permanent skill loss. Better cooks improve product quality but cannot remove the fundamental adverse-outcome floor. Keep legal food competitive and all core content achievable without restricted goods.

## 10. Screens and presentation

- Career → Cooking: interactive ingredient tray, drag-and-drop pan, colour-changing food, heat control, plate and doneness feedback; recipe book, equipment, skills, active job and recent batches.
- City → Market: illustrated ingredient stalls, regional specialties, mayor upgrades, NPC supply and player listings.
- Inventory → Food & Drink: item art, portions, visible freshness bars, expiry sorting and consume preview.
- Character status: current Meal/Drink effects, adverse effects and end times.
- Schedule: cooking jobs and completion; alerts for finished batches, sales and optional near-expiry reminders.
- Mobile companion: touch cooking mini-game with tap alternatives; buy, check progress, collect, consume and manage listings with the same rules as desktop.

Use appealing food thumbnails, interactive pan/oven visuals with clear colour changes and burning feedback and regional stall identity. Pair all colors with text/icons. Artwork must not imply an unavailable ingredient or undisclosed effect. Explain quantities, currency and remaining time clearly on small screens.

## 11. Proposed implementation boundaries

Logical records: ingredient definitions; country/city production profiles; ingredient lots; recipe versions and requirements; kitchen/equipment state; cooking jobs and authoritative mini-game sessions/actions; crafted batches and portion balances; active effects; city market upgrades and stock; listings and transaction ledger; restriction policies; enforcement events.

Fit these to existing inventory, crafting, skills, schedules, trading and mayor systems after a repository/schema review. Do not introduce a duplicate wallet, inventory or health model. Follow existing character identity and ownership rules, including additional characters.

Server-authoritative operations: start/complete/cancel craft; validate mini-game add/remove/heat actions and session timeout; restock market; list/buy/cancel listing; consume portion; expire lot; buy upgrade; apply policy; inspect prohibited trade. Use row locking, idempotency keys and durable transactions for all item/currency changes. Completion and cleanup workers must catch up missed runs safely. Enforce identity and ownership at every endpoint; public clients cannot choose quality, effects, timestamps or random outcomes.

Database migrations and direct live changes are separate implementation steps requiring environment inspection and verification. This plan does not claim any schema exists or any migration has been applied.

## 12. Delivery phases and acceptance gates

| Phase | Scope | Required evidence before moving on |
| --- | --- | --- |
| 0 — Foundation audit | Inspect Luthiery, inventory, buffs, education, schedules, markets, mayor finance and workers; confirm time rules | Integration map, reviewed schema, effect eligibility and balancing specification |
| 1 — Cooking slice | Starter kitchen, drag-and-drop pan mini-game, 12 legal recipes, ingredients, batch quality, portions, fixed expiry, consume effects | Buy → cook visually → plate → consume; colour changes and burning affect quality; assisted/offline finishing works; no duplication; expiry enforced without cleanup job |
| 2 — Regional economy | Reviewed city profiles, local stock, import pricing and local player stalls | Origin matters; concurrent buys safe; trading retains expiry; beginners retain staple access |
| 3 — Mayor markets | Size, quality and variety upgrades; treasury spend, maintenance and public history | Funds cannot overspend; upgrades survive elections; stock cannot restock twice |
| 4 — Restricted goods | Policy matrix, advance notices, licensed goods, cannabis-cake outcome model | Correct restrictions for every action; outcome odds visible; adverse effects cannot be rerolled or overwritten |
| 5 — Expansion | Refrigeration, transport, dedicated shops, catering, seasonal recipes and underground market | Storage never refreshes age; travel handles policy changes; new systems pass economic simulation |

Recommended first public launch: phases 1–3 after foundation review, including roughly 30 ingredients and 12 recipes. Add restricted goods behind an admin-controlled flag once the legal economy and effect limits are stable.

## 13. Verification and operations

Test full journeys for multiple characters and mobile as well as desktop: market purchase, partial batch sales, offline craft completion, job retries, low balance, ingredient substitution, expiring inputs, active effect replacement, cap enforcement, expiry during purchase, cold-storage transitions, travel into a banned city and announced policy changes.

Concurrency tests must cover consume versus sell, two buyers of the last portion, duplicate completion callbacks, multiple mayor upgrades and repeated worker execution. Negative effects persist across logout and cannot be deleted by replacing a positive buff. Invalid or failed requests must change neither currency nor inventory.

Run economy simulations for ingredient costs, expected yield, seller margins, stock concentration, money sinks, demand and spoilage. Simulate outcome distributions and expected songwriting gains against ordinary food. Tune configurable values rather than hard-coding them across clients.

Admin tools show stock health, stuck jobs, expiry backlog, craft success/quality distributions, prices, sales, buff use, restricted outcomes and enforcement. Include per-subsystem pause switches and auditable recovery actions; pausing a worker does not disable transaction-time expiry checks. Roll out to test characters, then a small city cohort, then the world with complete baseline city coverage.

Success means cooking is a viable optional profession, regional trade creates useful travel decisions, mayors have visible public improvements to fund, players can understand every boost and expiry before buying, and restricted items add uncertainty without becoming mandatory.
