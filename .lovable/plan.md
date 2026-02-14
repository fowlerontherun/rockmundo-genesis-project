

# Interactive Media Interviews (v1.0.667)

## Overview

When a PR media offer completes, players play an interactive interview mini-game: 3 random questions from a pool of 100, each with 4 response options and a 10-second timer. Responses modify fame, fans, cash, and reputation axes. Timeout defaults to the worst option.

## What Gets Built

### Database (1 migration)
- **`interview_questions` table**: 100 seeded questions with 4 options each, categorized by media type and theme
- **`interview_results` table**: tracks each interview session per user/band/offer
- **`interview_completed` column** added to `pr_media_offers` to gate the modal
- **RLS policies** for both new tables
- **100 seeded questions** across 6 categories (Career, Controversy, Personal, Music, Industry, Fan Engagement)

### New Files
| File | Purpose |
|------|---------|
| `src/components/pr/InterviewModal.tsx` | Full interview UI: sequential questions, 10s animated timer, response cards with effect badges, results summary |
| `src/hooks/useInterviewSession.ts` | State machine: fetches questions, tracks answers/timer, calculates combined effects, submits results, applies rewards |
| `src/data/interviewQuestions.ts` | TypeScript types for interview data structures |

### Modified Files
| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Add interview detection hook + InterviewModal to global layout |
| `src/components/VersionHeader.tsx` | Bump to v1.0.667 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Gameplay Flow

1. Player accepts a PR media offer (unchanged)
2. Offer completes via existing scheduling system
3. Layout hook detects completed offers where `interview_completed = false`
4. InterviewModal opens showing media type context and questions one at a time
5. Each question: 4 response cards + 10-second countdown bar
6. Timeout auto-selects Option D (worst outcome) with "Time's up!" flash
7. After 3 questions: results summary with combined effects
8. Effects applied to band stats and reputation, offer marked `interview_completed = true`

## Effect Multiplier System

| Response | Fame | Fans | Cash | Reputation |
|----------|------|------|------|------------|
| Great (A) | 1.3x | 1.2x | 1.1x | +3 to +8 |
| Good (B) | 1.1x | 1.1x | 1.0x | +1 to +5 |
| Risky (C) | 0.8-1.4x | 0.7-1.3x | 1.0x | -5 to +10 |
| Bad/Timeout (D) | 0.5x | 0.6x | 0.8x | -3 to -8 |

The 3 responses are averaged into a final multiplier applied to the offer's base rewards.

## Question Categories (100 total)
- **Career** (20): goals, achievements, future plans
- **Controversy** (15): criticism, scandals, rivalries
- **Personal** (15): lifestyle, influences, backstory
- **Music** (20): creative process, songs, collaborations
- **Industry** (15): labels, streaming, touring, business
- **Fan Engagement** (15): fans, social media, live shows

