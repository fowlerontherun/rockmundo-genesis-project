
# Nightclub Feature Expansion

## 1. Club Events & Theme Nights

### Database
- **`nightclub_events`** table: `id`, `club_id` (FK city_night_clubs), `event_name`, `event_type` (theme_night, special_event, competition), `genre_focus`, `day_of_week` (0-6 for recurring), `scheduled_date` (for one-offs), `cover_charge_override`, `fame_multiplier`, `xp_multiplier`, `special_guest_name`, `description`, `is_recurring`, `is_active`

### UI Changes
- Add "Events" tab to `NightClubDetail.tsx` showing tonight's event (if any) and upcoming schedule
- Events provide genre-specific bonuses (e.g., "Hip-Hop Monday" gives +50% fame for hip-hop artists)
- Special guests listed on event cards

### Logic
- When visiting a club during an active event, the stance outcome multipliers get boosted by `fame_multiplier` and `xp_multiplier`
- Theme night genre matches player's genre → extra bonus

---

## 2. VIP Lounges & Bottle Service

### Database
- **`nightclub_vip_packages`** table: `id`, `club_id` (FK city_night_clubs), `package_name`, `price`, `perks` (JSONB - e.g., free drinks count, fame boost, exclusive NPC access), `min_reputation_tier`, `max_guests`
- **`player_vip_bookings`** table: `id`, `profile_id`, `club_id`, `package_id` (FK nightclub_vip_packages), `booked_at`, `expires_at`, `status` (active, expired, cancelled)

### UI Changes
- Add "VIP" section to `NightClubDetail.tsx` with available packages
- Locked packages show required reputation tier
- Active VIP booking shows perks and expiry
- Bottle service animation/badge when VIP is active

### Logic
- VIP perks: skip cover charge, free drinks, +fame multiplier, exclusive stance outcomes
- Higher reputation tiers unlock premium packages
- VIP expires after 24 game hours

---

## 3. Club Ownership & Management

### Database
- **`player_owned_nightclubs`** table: `id`, `profile_id`, `club_id` (FK city_night_clubs, nullable for custom clubs), `club_name`, `city_id`, `quality_level`, `capacity`, `cover_charge`, `drink_markup_pct`, `staff_count`, `weekly_revenue`, `weekly_expenses`, `reputation_score`, `is_open`, `purchased_at`, `purchase_price`
- **`nightclub_staff`** table: `id`, `owned_club_id` (FK player_owned_nightclubs), `staff_type` (bouncer, bartender, dj, promoter, manager), `name`, `skill_level`, `salary_weekly`, `hired_at`
- **`nightclub_revenue_log`** table: `id`, `owned_club_id`, `revenue_type` (cover, drinks, vip, events), `amount`, `recorded_at`

### UI Changes
- New page `NightclubManagement.tsx` accessible from My Companies hub
- Dashboard: revenue/expenses, staff roster, event scheduling, pricing controls
- Buy clubs from the NightclubHub (button on club cards for clubs in player's city)
- Staff hiring with skill levels affecting revenue and incident rates

### Logic
- Revenue generated based on: city population × quality × reputation × event bonuses
- Expenses: staff salaries + maintenance + drink costs
- Weekly auto-calculation via existing company system patterns
- Quality degrades without maintenance spending

---

## Files to Create
1. `src/hooks/useNightclubEvents.ts` — CRUD for club events
2. `src/hooks/useNightclubVip.ts` — VIP packages and bookings
3. `src/hooks/useNightclubOwnership.ts` — Owned clubs management
4. `src/components/nightclub/ClubEventsSection.tsx` — Events display
5. `src/components/nightclub/VipLoungeSection.tsx` — VIP packages UI
6. `src/pages/NightclubManagement.tsx` — Club owner dashboard

## Files to Modify
1. `src/pages/NightClubDetail.tsx` — Add Events tab, VIP section
2. `src/pages/NightclubHub.tsx` — Add "Buy" button for purchasable clubs
3. `src/components/VersionHeader.tsx` — Version bump
4. `src/pages/VersionHistory.tsx` — Changelog

## Database Migration
6 new tables with RLS policies for profile-based access.
