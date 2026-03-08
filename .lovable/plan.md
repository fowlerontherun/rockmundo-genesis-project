

# Casino System with Mini-Games

## Overview
Add a Casino feature to the Underworld/Social hub with three playable mini-games: **Blackjack**, **Roulette**, and **Slots**. All games use the player's in-game cash and tie into the existing addiction system (gambling addiction risk).

## Database Changes

**New table: `casino_transactions`**
- `id`, `profile_id` (FK profiles), `game_type` (blackjack/roulette/slots), `bet_amount`, `payout`, `net_result`, `metadata` (JSONB — hand details, spin result, etc.), `created_at`
- RLS: players can only read/insert their own rows

**No edge functions needed** — all game logic runs client-side (standard for casino games in idle/sim games). Transactions are recorded after each round.

## Pages & Components

### `/casino` — Casino Lobby Page
- Dark, neon-themed page (matching Underworld aesthetic)
- Three game cards: Blackjack, Roulette, Slots — each links to its game
- Shows player cash balance, session stats (wins/losses)
- Gambling addiction warning banner if player has gambling addiction

### `/casino/blackjack` — Blackjack Game
- Standard rules: Hit, Stand, Double Down, Split (pairs)
- Bet selection before each hand ($10–$10,000)
- Card deck rendered with styled card components (suits + values)
- Dealer AI: hits on soft 16, stands on 17
- State machine: `betting → playing → dealer-turn → result`
- Animated card dealing with framer-motion

### `/casino/roulette` — Roulette Game
- Visual roulette wheel with spinning animation (CSS/framer-motion)
- Bet types: single number, red/black, odd/even, 1-18/19-36, dozens, columns
- Multiple bets per spin allowed
- Ball animation lands on result number
- Payout table displayed

### `/casino/slots` — Slot Machine
- 3-reel slot machine with music-themed symbols (guitar, microphone, drums, vinyl, star, diamond)
- Spin animation with sequential reel stops
- Pay lines: 1 center line for simplicity
- Jackpot for 3 matching premium symbols
- Auto-spin option (up to 10 spins)

## Game Logic (all client-side in `src/lib/casino/`)
- `blackjack.ts` — deck, shuffle, hand evaluation, dealer logic
- `roulette.ts` — number generation, bet resolution, payout calculation
- `slots.ts` — reel symbols, RNG spin, payout table
- `types.ts` — shared types (BetType, GameResult, etc.)

## Integration Points
- **Cash deduction/addition**: Mutation updates `profiles.cash` via Supabase after each round
- **Gambling addiction**: Each bet triggers a roll against `player_addictions` (reuse existing addiction system — 5% chance per bet to increase gambling addiction severity)
- **Transaction logging**: Every round writes to `casino_transactions` for stats/history
- **Daily loss limit**: Optional $50,000 daily loss cap (configurable)

## Navigation
- Add "Casino" tile to **WorldSocialHub** Social group (between Underworld and Lottery)
- Icon: `Dices` from lucide-react
- Add routes: `/casino`, `/casino/blackjack`, `/casino/roulette`, `/casino/slots`
- Add i18n key `nav.casino` across all language files
- Static hub tile image for casino

## Version
Bump to next version, update VersionHistory.

## File Summary
- **Create**: `src/lib/casino/types.ts`, `blackjack.ts`, `roulette.ts`, `slots.ts`
- **Create**: `src/pages/Casino.tsx`, `src/pages/casino/Blackjack.tsx`, `Roulette.tsx`, `Slots.tsx`
- **Create**: `src/components/casino/` — `Card.tsx`, `RouletteWheel.tsx`, `SlotReel.tsx`, `BetControls.tsx`, `GameResult.tsx`
- **Edit**: `src/App.tsx` (routes), `WorldSocialHub.tsx` (tile), i18n files, `VersionHeader.tsx`, `VersionHistory.tsx`
- **Migration**: Create `casino_transactions` table with RLS

