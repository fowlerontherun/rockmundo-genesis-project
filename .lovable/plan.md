
# Underworld Crypto Market Overhaul -- v1.0.686

## Summary
Transform the crypto market from a static display into a volatile, player-influenced economy with 100 seeded tokens, live price fluctuations, rug-pull mechanics, and trading that's deliberately hard to profit from.

---

## What Changes

### 1. Seed 100 Crypto Tokens
- Database migration to insert 100 unique tokens with varied names, symbols, and starting prices (ranging from $0.001 to $5,000)
- Tokens span tiers: ~50 micro-caps (cheap/volatile), ~30 mid-caps, ~15 large-caps, ~5 blue-chips
- Each gets randomized initial `price_history` entries so charts aren't empty
- Remove the 3 hardcoded placeholder tokens from the frontend

### 2. New Edge Function: `simulate-crypto-market`
Runs on a cron (every 5-10 minutes) to create live volatility:

- **Base volatility**: Each tick, every token's price shifts by a random percentage. Micro-caps swing +/-15%, mid-caps +/-8%, large-caps +/-4%
- **Downward bias**: Prices trend slightly downward on average (-0.5% drift per tick) making it hard to profit long-term
- **Momentum**: Tracks short-term trend direction so prices don't just randomly walk -- they can run up or crash in streaks
- **Player impact**: Large buy orders push price up slightly, large sell orders push price down. This is calculated from recent `token_transactions` since last tick
- **Volume simulation**: Randomize `volume_24h` each tick based on price movement
- **Price history**: Append the new price to `price_history` JSONB array (capped at ~100 entries)

### 3. Rug-Pull Mechanic
Built into the edge function:

- Each tick, every micro/mid-cap token has a small chance (~0.5-2%) of "rugging"
- When rugged: price drops to $0.00, volume goes to 0, token is flagged as `is_rugged = true`
- Players holding the token lose their investment (holdings become worthless)
- A notification/toast event is logged so players see "TOKEN X has been rugged!"
- After rugging, the token is soft-deleted (hidden from market) and a brand-new replacement token is generated with fresh randomized data to maintain 100 active tokens

### 4. Database Schema Updates
Add columns to `crypto_tokens`:
- `is_rugged` (boolean, default false) -- marks dead tokens
- `volatility_tier` (text: 'micro', 'mid', 'large', 'blue_chip') -- controls swing range
- `trend_direction` (numeric, default 0) -- momentum tracker (-1 to 1)
- `is_active` (boolean, default true) -- hide rugged tokens from listings

### 5. Frontend: Live Trading UI
Upgrade the existing market section in `UnderworldNew.tsx`:

- **Auto-refresh**: Poll token prices every 30 seconds using React Query `refetchInterval`
- **Price flash**: Green/red flash animation when price changes between polls
- **Working Buy/Sell**: Wire the existing buy/sell form inputs to the `useCryptoTokens` hook's `buyToken`/`sellToken` mutations (currently just placeholder buttons)
- **Portfolio panel**: Show player's holdings, current P&L, average buy price
- **Rug alert banner**: When a held token rugs, show a dramatic red alert
- **Token count badge**: Show "X/100 Active Tokens" in the market header
- **Rugged tokens graveyard**: Small collapsible section showing recently rugged tokens

### 6. Player Impact on Price
In `useCryptoTokens.ts` buy/sell mutations, after recording the transaction:
- The edge function picks up recent transactions and factors them into the next price tick
- Large buys (>1% of market cap) cause a temporary price bump
- Large sells cause a temporary dip
- This creates a feedback loop where buying pushes price up, encouraging others, then it crashes

---

## Technical Details

### Migration SQL
- Add new columns to `crypto_tokens`
- Seed 100 tokens with INSERT statements using generate_series and randomized data
- Ensure existing 5 tokens are kept and assigned volatility tiers

### Edge Function: `simulate-crypto-market`
```text
For each active token:
  1. Get recent transactions since last update
  2. Calculate player pressure (net buy/sell volume)
  3. Apply base volatility (random within tier range)
  4. Apply downward drift (-0.5%)
  5. Apply player pressure modifier
  6. Apply momentum (trend_direction)
  7. Roll for rug-pull (micro/mid only)
  8. If rugged: set price=0, is_rugged=true, spawn replacement
  9. Update price_history, volume_24h, updated_at
```

### Files to Create
- `supabase/functions/simulate-crypto-market/index.ts`

### Files to Modify
- `src/pages/UnderworldNew.tsx` -- wire trading, add portfolio, rug alerts, auto-refresh
- `src/hooks/useCryptoTokens.ts` -- add refetchInterval, portfolio value calculation
- `src/hooks/useUnderworld.ts` -- add refetchInterval
- `src/components/VersionHeader.tsx` -- bump to 1.0.686
- `src/pages/VersionHistory.tsx` -- changelog entry
- Database migration for schema + seed data
