

## Player Game Review Survey System (v1.1.032)

### Overview

A comprehensive in-game survey system that collects player feedback across multiple game areas. Admins can toggle it on/off, and players are prompted with 10 questions on login. Completing all 10 rewards 250 XP and 25 attribute points. Admin gets a results dashboard with charts.

### Database

**New tables:**

1. **`player_survey_questions`** — stores all survey questions
   - `id`, `category` (gameplay, music, social, economy, ui, performance, content, balance), `question_text`, `question_type` (rating_1_5, multiple_choice, yes_no, free_text), `options` (jsonb, for multiple_choice), `display_order`, `is_active`, `created_at`

2. **`player_survey_responses`** — stores each player's answers
   - `id`, `user_id` (FK auth.users), `profile_id` (FK profiles), `question_id` (FK survey_questions), `survey_round` (text identifier like "2026-03"), `answer_value` (text), `answer_numeric` (int, for ratings), `created_at`
   - Unique constraint on `(user_id, question_id, survey_round)`

3. **`player_survey_completions`** — tracks who completed a full round + got rewarded
   - `id`, `user_id`, `profile_id`, `survey_round`, `completed_at`, `xp_awarded`, `attribute_points_awarded`
   - Unique on `(user_id, survey_round)`

**`game_config` entry:** Key = `player_survey_enabled`, value = `{ "enabled": true, "round": "2026-03", "questions_per_session": 10 }`

RLS: Players can insert/select their own responses. Admins can read all.

### Survey Questions (30+ seeded, 10 shown per session)

Categories and example questions:

**Gameplay** — "How engaging do you find the gig performance system?" (1-5), "Which game feature do you spend the most time on?" (MC: Music/Touring/Social/Business/Other)

**Music & Production** — "How satisfying is the songwriting process?" (1-5), "Do you feel the recording studio gives enough creative control?" (Y/N)

**Social & Community** — "How useful do you find Twaater for building your fanbase?" (1-5), "Would you like more multiplayer interaction features?" (Y/N)

**Economy & Balance** — "Do you feel the in-game economy is balanced?" (1-5), "Are streaming/sales revenues at a fair level?" (1-5)

**UI & Experience** — "How intuitive is the game navigation?" (1-5), "What area of the UI needs the most improvement?" (MC: Menus/Maps/Dashboards/Mobile)

**Content** — "Is there enough variety in gig venues?" (1-5), "What new feature would you most like to see?" (free text)

**Performance** — "How would you rate game loading times?" (1-5), "Do you experience lag during 3D gig scenes?" (Y/N)

**Progression** — "Does leveling up feel rewarding?" (1-5), "Is the skill tree deep enough?" (1-5)

### Frontend Components

1. **`PlayerSurveyModal`** — Full-screen modal shown on Dashboard mount when survey is enabled + player hasn't completed current round. Shows questions one at a time with progress bar, skip button at top, rating stars / MC buttons / text input depending on type. On completing all 10, calls `awardSpecialXp(250)` + increments `attribute_points_balance` by 25 via an edge function or direct DB update, then records completion.

2. **`src/pages/admin/PlayerSurveyAdmin.tsx`** — Admin page with:
   - Toggle switch to enable/disable survey (updates `game_config`)
   - Set current survey round identifier
   - View all questions, add/edit/deactivate questions
   - **Results tab** with:
     - Total responses count, completion rate
     - Bar charts per rating question (avg score)
     - Pie charts for multiple choice questions
     - Free text response list
     - Filter by category, date range
   - Uses Recharts (already installed)

3. **Dashboard integration** — On Dashboard load, check `game_config` for survey enabled + check if player has a completion record for current round. If not, show the modal.

### Reward Mechanism

On survey completion:
- Call `awardSpecialXp({ amount: 250, reason: "survey_completion" })` for the 250 XP
- Update `player_xp_wallet` to increment `attribute_points_balance` by 25 and `attribute_points_lifetime` by 25
- Insert into `player_survey_completions` to prevent repeat rewards

### Routing & Admin Nav

- Add `/admin/player-survey` route in `App.tsx`
- Add to AdminNav under "Players & Community" category
- Lazy import the admin page

### Version

- Bump to v1.1.032
- Changelog entry describing the survey system

### Files to Create/Edit

1. **Create** `supabase/migrations/...` — tables + seed 30 questions + RLS
2. **Create** `src/components/survey/PlayerSurveyModal.tsx` — the player-facing survey
3. **Create** `src/hooks/usePlayerSurvey.ts` — check survey status, submit answers
4. **Create** `src/pages/admin/PlayerSurveyAdmin.tsx` — admin dashboard with charts
5. **Edit** `src/pages/Dashboard.tsx` — mount survey modal
6. **Edit** `src/components/admin/AdminNav.tsx` — add nav entry
7. **Edit** `src/App.tsx` — add route
8. **Edit** `src/components/VersionHeader.tsx` — bump version
9. **Edit** `src/pages/VersionHistory.tsx` — changelog

