

# Interactive Media Interviews Feature (v1.0.667)

## Overview

When a player accepts a PR media offer (podcast, TV, radio, newspaper, internet/website, or magazine), they will play through an interactive interview mini-game before rewards are applied. The interview consists of **3 randomly selected questions** from a pool of **100 seeded questions**. Each question has **4 response options** with different effects on fame, fans, cash, and reputation axes. A **10-second countdown timer** forces quick decisions -- if time runs out, the worst option is auto-selected.

## How It Works

1. Player accepts a PR media offer (existing flow, unchanged)
2. When the scheduled activity completes, instead of silently applying rewards, an **Interview Modal** appears
3. The modal shows the media type context (e.g., "Live on BBC Radio 1") and presents questions one at a time
4. Each question has 4 clickable response cards showing their potential effects
5. A 10-second progress bar counts down per question -- if it expires, option D (the worst one) is auto-selected
6. After all 3 questions, a results summary shows what happened and the combined effects are applied
7. Effects modify: fame, fans, cash, and the 4 reputation axes (authenticity, attitude, reliability, creativity)

## Question Design

Questions are categorized by media type so podcast questions feel different from TV questions. Each of the 100 questions has:
- A question text and media type tag (some are universal, some type-specific)
- 4 response options ranging from great to terrible
- Each response has effect multipliers on the base offer rewards plus direct reputation shifts

Example:
> **"Your latest single has divided critics. How do you respond?"**
> - A) "Art should provoke. I'm proud of it." (+fame, +authenticity)
> - B) "We appreciate all feedback and keep growing." (+fans, +reliability)
> - C) "The critics don't understand our vision." (-fans, +attitude toward diva)
> - D) *silence / no answer* (-fame, -reliability)

## Technical Plan

### 1. New Database Table: `interview_questions`

Stores the 100 seeded questions with their 4 options and effects.

```text
interview_questions
  id              uuid PK
  question_text   text
  media_types     text[]          -- which media types this applies to (or 'all')
  category        text            -- theme: career, controversy, personal, music, industry
  option_a_text   text
  option_a_effects jsonb          -- { fame_mult: 1.2, fan_mult: 1.0, cash_mult: 1.0, reputation: { authenticity: 5 } }
  option_b_text   text
  option_b_effects jsonb
  option_c_text   text
  option_c_effects jsonb
  option_d_text   text            -- the "bad" default timeout option
  option_d_effects jsonb
  created_at      timestamptz
```

### 2. New Database Table: `interview_results`

Records each interview session for history tracking.

```text
interview_results
  id              uuid PK
  user_id         uuid FK
  band_id         uuid FK
  offer_id        uuid FK (pr_media_offers)
  media_type      text
  questions       jsonb           -- array of { question_id, chosen_option, timed_out }
  total_effects   jsonb           -- aggregated effects applied
  created_at      timestamptz
```

### 3. Migration: Seed 100 Questions

A SQL migration seeds 100 interview questions across 6 categories:
- **Career** (20): about goals, achievements, future plans
- **Controversy** (15): handling criticism, scandals, rivalries
- **Personal** (15): lifestyle, influences, backstory
- **Music** (20): creative process, songs, genre, collaborations
- **Industry** (15): labels, streaming, touring, business
- **Fan engagement** (15): relationship with fans, social media, live shows

Each question has 4 options with escalating risk/reward. Option A and B are generally positive but differ in reputation axis impact. Option C is risky/edgy. Option D is always the worst (timeout default).

### 4. New Component: `InterviewModal.tsx`

A full-screen dialog that:
- Shows media outlet name, type icon, and interview context
- Displays questions sequentially (1 of 3, 2 of 3, 3 of 3)
- Renders 4 response cards with effect badges (reusing the existing EffectDisplay pattern from EventNotificationModal)
- Animated 10-second progress bar per question using framer-motion
- Auto-selects option D on timeout with a "Time's up!" flash
- After question 3, shows a results summary card with all effects
- "Done" button applies effects and closes

### 5. New Hook: `useInterviewSession.ts`

Manages the interview state machine:
- Fetches 3 random questions matching the media type from Supabase
- Tracks current question index, selected answers, timer state
- Calculates combined effects (multipliers applied to base offer rewards)
- Submits results to `interview_results` table
- Applies reputation changes via the existing `updateReputation` API from `src/lib/api/roleplaying.ts`
- Applies fame/fan/cash boosts by updating band stats

### 6. Integration with Existing PR Flow

Modify `process-pr-activity` edge function's `complete` action:
- Instead of directly applying rewards, set the offer status to `interview_pending`
- The frontend detects offers in `interview_pending` status and opens the InterviewModal
- After the interview, the frontend calls a new mutation that applies the modified rewards

Alternatively (simpler approach): Keep the existing completion flow but add a **new hook** that checks for recently completed offers that haven't had interviews yet. When one is found, the modal opens. This avoids modifying the edge function.

The chosen approach: Add an `interview_completed` boolean column to `pr_media_offers`. When an offer completes, if `interview_completed` is false, the InterviewModal appears. After the interview, it marks the flag true and applies bonus/penalty modifiers to the already-applied base rewards.

### 7. Files to Create

| File | Purpose |
|------|---------|
| `src/components/pr/InterviewModal.tsx` | The interview UI with timer, questions, results |
| `src/hooks/useInterviewSession.ts` | State management, question fetching, result submission |
| `src/data/interviewQuestions.ts` | TypeScript types for interview data |
| `supabase/migrations/xxx_interview_system.sql` | Tables + seed 100 questions |

### 8. Files to Modify

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Add InterviewModal to global layout (like EventNotificationModal) |
| `src/components/VersionHeader.tsx` | Bump to v1.0.667 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

### 9. Effect Multiplier System

Interview responses modify the base offer rewards with multipliers:

| Response Quality | Fame Mult | Fan Mult | Cash Mult | Reputation |
|-----------------|-----------|----------|-----------|------------|
| Great (A)       | 1.3x      | 1.2x    | 1.1x     | +3 to +8 on relevant axis |
| Good (B)        | 1.1x      | 1.1x    | 1.0x     | +1 to +5 on relevant axis |
| Risky (C)       | 0.8-1.4x  | 0.7-1.3x| 1.0x     | -5 to +10 (high variance) |
| Bad/Timeout (D) | 0.5x      | 0.6x    | 0.8x     | -3 to -8 on relevant axis |

The 3 question results are averaged to produce a final interview performance multiplier applied to the offer's base fame_boost, fan_boost, and compensation.

