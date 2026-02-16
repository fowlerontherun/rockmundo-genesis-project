

## Fix: Crypto Trade Button Not Working

### Problem
When a user clicks the "Trade" button on a token row, it only sets the selected token state (`setSelectedToken(token.symbol)`) but does **not scroll** the page down to the trading panel. The buy/sell form renders below the 500px-tall scrollable token table, so it's invisible to the user -- it looks like nothing happened.

There is also a secondary bug: the `buyToken` and `sellToken` mutations in `useCryptoTokens.ts` reference `holdings` from a stale closure. If holdings haven't loaded yet or are outdated, the logic for checking existing positions or balances may silently fail.

### Changes

**1. Auto-scroll to trading panel when Trade is clicked** (`src/pages/UnderworldNew.tsx`)
- Add a `ref` to the trading panel section (the `div` at line 528)
- After `setSelectedToken(token.symbol)`, scroll the trading panel into view with `scrollIntoView({ behavior: "smooth" })`
- Use a short `setTimeout` to allow React to render the panel before scrolling

**2. Fix stale closure in buy/sell mutations** (`src/hooks/useCryptoTokens.ts`)
- Change the `buyToken` and `sellToken` mutations to fetch the latest holdings from Supabase inside the mutation function, instead of relying on the outer `holdings` variable from the query cache
- This ensures the balance check and position update use fresh data

**3. Version bump**
- Update `VersionHeader.tsx` to v1.0.754
- Add changelog entry to `VersionHistory.tsx`

### Technical Details

**File: `src/pages/UnderworldNew.tsx`**
- Add `useRef` for the trade panel div
- Update the Trade button `onClick` to scroll after state update:
```typescript
const tradePanelRef = useRef<HTMLDivElement>(null);

// In Trade button onClick:
onClick={(e) => {
  e.stopPropagation();
  setSelectedToken(token.symbol);
  setTimeout(() => tradePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}}
```
- Attach `ref={tradePanelRef}` to the selected token detail div

**File: `src/hooks/useCryptoTokens.ts`**
- In `buyToken.mutationFn`: fetch the user's current holding for that token from Supabase instead of using the cached `holdings` array
- In `sellToken.mutationFn`: same — fetch the holding row fresh from Supabase before checking quantity

