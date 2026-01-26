

# Fix Underworld Store Health Effects and Item Consumption

## Overview
Ensure that underworld store items with health effects properly impact the player's health when used, and that consumed items correctly disappear from the inventory. Also fix the display of negative effects in the UI.

## Current State Analysis

After analyzing the code, I found:

1. **Health effects ARE being applied** - The code in `useUnderworldInventory.ts` lines 86-88 does apply health changes to the profile
2. **Items ARE being marked as used** - The `is_used: true` flag is set after use (lines 140-143)
3. **Used items ARE filtered out** - The inventory query filters `.eq("is_used", false)` (line 44)

### Issues Found

| Issue | Location | Problem |
|-------|----------|---------|
| No health floor | `useUnderworldInventory.ts:87` | Health can go below 0 for negative effects (drugs) |
| No energy floor | `useUnderworldInventory.ts:90` | Energy can go below 0 |
| Wrong sign display | `ItemDetailDialog.tsx:120` | Shows `+-10` for negative effects |
| Missing color coding | `ItemDetailDialog.tsx:119` | Negative effects not highlighted as warnings |
| Same issues in purchase | `useUnderworldStore.ts:182-185` | Instant effects also lack floor validation |

## Technical Implementation

### File 1: `src/hooks/useUnderworldInventory.ts`

Add floor validation when applying effects:

**Current (lines 85-91):**
```typescript
if (effects.health) {
  updates.health = Math.min(100, (profile?.health || 0) + (effects.health as number));
}
if (effects.energy) {
  updates.energy = Math.min(100, (profile?.energy || 0) + (effects.energy as number));
}
```

**Fixed:**
```typescript
if (effects.health) {
  updates.health = Math.max(0, Math.min(100, (profile?.health || 0) + (effects.health as number)));
}
if (effects.energy) {
  updates.energy = Math.max(0, Math.min(100, (profile?.energy || 0) + (effects.energy as number)));
}
```

### File 2: `src/hooks/useUnderworldStore.ts`

Same fix for instant effect application during purchase:

**Current (lines 181-186):**
```typescript
if (effects.health) {
  updates.health = Math.min(100, (profile?.health || 0) + (effects.health as number));
}
if (effects.energy) {
  updates.energy = Math.min(100, (profile?.energy || 0) + (effects.energy as number));
}
```

**Fixed:**
```typescript
if (effects.health) {
  updates.health = Math.max(0, Math.min(100, (profile?.health || 0) + (effects.health as number)));
}
if (effects.energy) {
  updates.energy = Math.max(0, Math.min(100, (profile?.energy || 0) + (effects.energy as number)));
}
```

### File 3: `src/components/inventory/ItemDetailDialog.tsx`

Fix effect display to handle negative values and show warnings:

**Current (line 119-121):**
```typescript
<Badge variant="outline" className="font-mono">
  +{displayValue}
</Badge>
```

**Fixed:**
```typescript
<Badge 
  variant="outline" 
  className={`font-mono ${Number(value) < 0 ? 'text-destructive border-destructive/50' : 'text-green-600 border-green-500/50'}`}
>
  {Number(value) >= 0 ? '+' : ''}{displayValue}
</Badge>
```

### File 4: `src/pages/InventoryManager.tsx`

Fix the item card badges to also show correct signs and colors for effects:

**Current (lines 147-166):**
```typescript
{effects.health && (
  <Badge variant="outline" className="gap-1 text-xs">
    <Heart className="h-3 w-3" /> +{String(effects.health)}
  </Badge>
)}
```

**Fixed:**
```typescript
{effects.health && (
  <Badge 
    variant="outline" 
    className={`gap-1 text-xs ${Number(effects.health) < 0 ? 'text-destructive border-destructive/30' : ''}`}
  >
    <Heart className="h-3 w-3" /> 
    {Number(effects.health) >= 0 ? '+' : ''}{String(effects.health)}
  </Badge>
)}
```

Apply similar fix for energy, xp, and fame badges.

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnderworldInventory.ts` | Add `Math.max(0, ...)` floor for health and energy |
| `src/hooks/useUnderworldStore.ts` | Add `Math.max(0, ...)` floor for health and energy |
| `src/components/inventory/ItemDetailDialog.tsx` | Fix sign display and add color coding for negative effects |
| `src/pages/InventoryManager.tsx` | Fix sign display and add color coding for effect badges |
| `src/components/VersionHeader.tsx` | Bump to v1.0.527 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Summary of Changes

1. **Health/Energy Floor**: Prevent stats from going below 0 when using items with negative effects
2. **Correct Sign Display**: Show `-10` instead of `+-10` for negative effects
3. **Visual Warning**: Red/destructive styling for negative effect values
4. **Green Positive**: Green styling for positive effect values

## Version Update
- Bump to **v1.0.527**
- Changelog: "Underworld: Fixed health effects properly applying when using consumable items, added floor validation (0-100 range), improved effect display with correct signs and color coding for negative effects"

