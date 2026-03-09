

## Fix: Tabs Overflowing / Not Showing on All Pages (v1.1.026)

### Root Cause

The base `TabsList` component uses `inline-flex` with no overflow handling. When pages have 4-5+ tabs (Finances, Band Management, Media, etc.), they overflow their container on smaller screens — tabs get clipped, hidden, or overlap.

### Solution

**Fix the `TabsList` component globally** so all 169 files using tabs benefit automatically — no per-page changes needed.

Changes to `src/components/ui/tabs.tsx`:
- Add `overflow-x-auto` to allow horizontal scrolling when tabs exceed container width
- Add `scrollbar-hide` (or thin scrollbar) for a clean look
- Add `w-full flex-nowrap` to prevent wrapping and ensure all tabs stay in one row
- Keep `inline-flex` but ensure the list stretches properly

This single-file fix resolves every page simultaneously (Finances, Band Management, Media Campaigns, Festivals, Admin panels, etc.).

### Files to Change

1. **`src/components/ui/tabs.tsx`** — Add overflow scroll + no-wrap to `TabsList` base styles
2. **`src/index.css`** (or global CSS) — Add `.scrollbar-hide` utility if not already present
3. **`src/components/VersionHeader.tsx`** — Bump to v1.1.026
4. **`src/pages/VersionHistory.tsx`** — Add changelog entry

