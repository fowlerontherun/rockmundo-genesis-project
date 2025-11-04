# Record Label System Roadmap

## Current Mechanics in Popmundo

- **Contracts as a prerequisite.** Artists or bands must hold an active contract with a record label before releasing singles or albums. Contracts define the artist's royalty share and usually grant discounts on the label's studio bookings.
- **Studio recordings feed releases.** Songs must be recorded in advance by booking studio sessions. Completed tracks paired with a contract unlock the ability to submit releases.
- **Release cadence and timing.** Players coordinate single and album launches around fixed cooldowns (roughly 28 days for singles and 112 days for albums) and consider market timing plus song quality.
- **Revenue sharing.** Sales from singles and albums pay the artist according to the agreed royalty while the label retains the remainder, effectively monetising the label's infrastructure support.
- **Label selection factors.** Artists weigh label experience, roster quality, geographic studio access, and discounts when reviewing offers; seasoned labels signal reliability through their artist list.
- **System limitations.** Popmundo's implementation keeps contract terms and label dynamics simple—little transparency for promotion, limited contract variations, rigid release timers, and few levers for label strategy.

## Opportunities for RockMundo Enhancements

### Contract & Deal Complexity
1. **Advance payments** that are recoupable against future royalties.
2. **Explicit contract terms and extension options** based on years or number of releases.
3. **Multiple deal archetypes** (traditional, 360, distribution, profit-share) with distinct economics.
4. **Master ownership choices** influencing royalty rates and control of catalogues.
5. **Territorial and rights scoping** for domestic/international or sync/licensing variations.

### Label Reputation & Economics
6. **Reputation metrics** shaped by artist success, releases, and promotions.
7. **Promotion budgeting** that affects sales performance and recoupment.
8. **Sub-labels or imprints** for genre niches under larger parent companies.
9. **Competitive market share** tracking and roster strategy constraints.
10. **Full label P&L modelling** of costs (studio, marketing) and revenues (sales, licensing).

### Release & Artist Management
11. **Flexible release scheduling** with lead-time requirements and strategic timing.
12. **Structured campaign phases** (pre-release, launch, post-release support).
13. **Artist development pipelines** where labels invest in training for favourable deal terms.
14. **Royalty statements with audit rights** to monitor recoupment and detect discrepancies.
15. **Cross-media revenue streams** (sync, merchandising) governed by contract clauses.

### Strategic Depth & Long-Term Play
16. **Roster slot caps and exclusivity rules** to encourage thoughtful signings.
17. **Genre and territorial specialisation** affecting contract attractiveness and release success.
18. **Mergers, acquisitions, and partnerships** that can transfer artist contracts.
19. **Relationship management mechanics** for delivery obligations and penalties.
20. **Reputation-driven chart bonuses** where strong labels boost hit potential.

## Implementation Phases

### Phase 0 – Specification
- Document functional requirements and entity relationships (Label, Contract, Release, DealType, Territory, PromotionBudget, RoyaltyStatement, etc.).
- Update the ERD to include new tables: `labels`, `artist_label_contracts`, `label_releases`, `promotion_campaigns`, `royalty_statements`, `territories`, `deal_types`, `roster_slots`.
- Define contract term schemas (start/end, release quota, royalty splits, advances, master ownership, territories).
- Formalise reputation and market share metrics and how they derive from releases.
- Describe the release workflow from recording through promotion to sales tallying.

### Phase 1 – Core Backend
- Ship database migrations for new tables and relationships.
- Implement ORM models/services for labels, contracts, releases, promotion campaigns, royalty statements.
- Build business logic for contract offers, roster slot checks, release submission, sales computation, and recoupment.
- Add APIs such as:
  - `GET /labels`, `GET /labels/{id}` for roster and reputation insights.
  - `POST /artists/{id}/contracts` & `GET /artists/{id}/contracts` for signing and history.
  - `POST /releases`, `GET /releases/{id}` for release lifecycle data.
  - `GET /artists/{id}/royalties` for statements and recoupment status.
- Update reputation scores after releases and ensure transactional integrity with SQLite.

### Phase 2 – Frontend & UX
- Create contract browsing/signing interfaces highlighting royalties, advances, ownership, territories, and term details.
- Build label profile views with logos, genre focus, roster capacity, and reputation trends.
- Enhance artist dashboards with contract milestones, deliverable counters, and release scheduling tools.
- Provide release submission forms to select tracks, schedule dates, and assign promotion budgets.
- Add promotion management screens and royalty statement viewers with breakdowns.
- Surface analytics pages for top labels, deals, and campaign performance.

### Phase 3 – Sales & Mechanics
- Implement a sales simulation engine factoring in reputation, promotion, artist popularity, genre/territory fit, and release cadence.
- Model recoupment flows: advances and recoupable costs must be recovered before royalty payouts.
- Extend revenue streams for licensing/sync when contracts grant those rights.
- Track label operating costs to compute profitability and adjust roster capacity or reputation as needed.
- Enforce release cooldowns and lead times to maintain pacing and campaign realism.
- Monitor contract fulfilment and trigger penalties or renegotiations on missed obligations.

### Phase 4 – Advanced Features
- Support sub-label hierarchies and parent label resource sharing.
- Introduce label mergers/acquisitions with contract transfer logic.
- Add development contracts offering training in exchange for lower initial royalties.
- Enable audit requests and penalties for underpayment or delayed statements.
- Expand to 360 and distribution deals covering touring/merch revenue or artist-owned masters.
- Layer in dynamic market trends to influence promotion effectiveness and territorial strategy.

### Phase 5 – Deployment & Iteration
- Create comprehensive unit, integration, and regression tests for new logic and endpoints.
- Plan data migration for existing artists/releases and update backup routines for new tables.
- Draft user-facing documentation explaining contract mechanics and strategy tips.
- Instrument analytics dashboards tracking advances, recoupment, roster growth, and churn.
- Roll out behind feature flags or beta cohorts, gather feedback, and balance economic parameters.

## Timeline Snapshot (12 Weeks)

| Weeks | Focus |
| ----- | ----- |
| 1–2 | Specification, ERD updates, contract/deal definitions. |
| 3–4 | Backend migrations, models, core APIs. |
| 5–6 | Frontend UIs for labels, contracts, releases. |
| 7–8 | Sales simulation, recoupment, territory logic. |
| 9–10 | Advanced deal types, audits, sub-label mechanics. |
| 11 | Testing, QA, data migration, documentation. |
| 12 | Deployment, monitoring, soft launch, feedback. |

## Schema Excerpt (Simplified)

```sql
CREATE TABLE labels (
  id INTEGER PRIMARY KEY,
  name TEXT,
  logo_url TEXT,
  genre_specialisation TEXT,
  reputation_score INTEGER DEFAULT 0,
  roster_slot_capacity INTEGER,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE deal_types (
  id INTEGER PRIMARY KEY,
  name TEXT,
  description TEXT,
  artist_royalty_pct REAL,
  label_royalty_pct REAL,
  advance_required BOOLEAN,
  masters_owned_by_artist BOOLEAN
);

CREATE TABLE artist_label_contracts (
  id INTEGER PRIMARY KEY,
  label_id INTEGER REFERENCES labels(id),
  artist_id INTEGER,
  deal_type_id INTEGER REFERENCES deal_types(id),
  start_date DATE,
  end_date DATE,
  number_of_releases_required INTEGER,
  releases_remaining INTEGER,
  advance_amount INTEGER DEFAULT 0,
  recouped_amount INTEGER DEFAULT 0,
  royalty_artist_pct REAL,
  royalty_label_pct REAL,
  masters_owned_by_artist BOOLEAN,
  territories TEXT,
  FOREIGN KEY (label_id) REFERENCES labels(id)
);

CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  contract_id INTEGER REFERENCES artist_label_contracts(id),
  title TEXT,
  release_type TEXT,
  scheduled_date DATE,
  actual_release_date DATE,
  promotion_budget INTEGER,
  territory TEXT,
  sales_units INTEGER DEFAULT 0,
  revenue_generated INTEGER DEFAULT 0,
  FOREIGN KEY (contract_id) REFERENCES artist_label_contracts(id)
);

CREATE TABLE royalty_statements (
  id INTEGER PRIMARY KEY,
  contract_id INTEGER REFERENCES artist_label_contracts(id),
  period_start DATE,
  period_end DATE,
  artist_share INTEGER,
  label_share INTEGER,
  recoupment_balance INTEGER,
  created_at DATETIME
);
```

## Balancing & Monitoring Considerations

- Tune advance sizes relative to expected sales so recoupment feels attainable without unbalancing the in-game economy.
- Calibrate reputation growth to reward consistent label success while allowing new entrants to compete through smart deals.
- Maintain release pacing limits to avoid content oversaturation and ensure promotional planning matters.
- Use diminishing returns on promotion budgets to encourage strategic allocation rather than brute-force spending.
- Model territory and genre demand curves to reward thoughtful label specialisation.
- Provide in-game help, developer documentation, analytics dashboards, and player feedback loops to iterate quickly on the system.
