
# Fix Cluttered Charts on Mobile (v1.0.784)

## Problem
On mobile, the chart table uses a fixed 12-column grid. When columns like Genre, Trend, and Weeks are hidden (`hidden sm:block`), their grid space becomes empty gaps rather than being redistributed. This causes the "This Week" and "Total Sales" number columns to appear jammed together, creating a "387.6K387.6K" effect with no visual separation.

## Solution
Restructure the chart table layout to be mobile-responsive by:

1. **Switching to a responsive grid** -- Use fewer columns on mobile (e.g., `grid-cols-8 sm:grid-cols-12`) so visible columns fill the available space properly
2. **Expand song column on mobile** -- Give the song/artist name more room on small screens to avoid heavy truncation
3. **Stack metric values on mobile** -- Show "This Week" and "Total" values stacked vertically in a single column on mobile instead of side-by-side, eliminating the cramped overlap
4. **Compact audio player** -- Ensure the inline `TrackableSongPlayer` doesn't bloat card height on mobile
5. **Smaller text on mobile** -- Reduce font sizes for numbers and labels on small screens

## Technical Details

### File: `src/pages/CountryCharts.tsx`

**Header row (line 110):**
- Change from `grid-cols-12` to `grid-cols-8 sm:grid-cols-12`
- Rank: `col-span-1`
- Song: `col-span-4 sm:col-span-3` (keeps more room on mobile)
- Genre: stays `hidden sm:block col-span-2`
- Weekly value: `col-span-1 sm:col-span-2` on mobile, or stack both values
- Total value: `col-span-2 sm:col-span-2`
- Trend/Weeks: stay hidden on mobile

**Data rows (lines 138-231):**
- Match the same responsive column structure
- On mobile, combine weekly + total into a single stacked cell showing both values with small labels
- Reduce number font size on mobile (`text-xs sm:text-sm`)

**Filter bar (lines 291-390):**
- Narrow the Select trigger widths on mobile (e.g., `w-[110px] sm:w-[150px]`)
- Ensure filters wrap neatly on small screens

**Tabs (line 402):**
- Already handles mobile with shortened labels -- no change needed

### Files Modified
| File | Change |
|------|--------|
| `src/pages/CountryCharts.tsx` | Responsive grid layout, stacked values on mobile, smaller touch targets |
| `src/components/VersionHeader.tsx` | Bump to v1.0.784 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |
