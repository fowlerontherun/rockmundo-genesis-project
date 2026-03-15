

## Fix Plan: Characters Hub Tile Image + `unlock_cost` Column Error

### Issue 1: Missing Characters Tile Image
The `/characters` path maps to key `characters`, but there is no `characters.png` in `public/hub-tiles/`. No exact match exists. The closest relevant image would be `buy-character-slot.png`. We can either add a `tileImageKey` override to reuse that image, or accept the icon fallback. Since no new assets can be created here, the pragmatic fix is to add `tileImageKey: "buy-character-slot"` to the characters tile in `CharacterHub.tsx` so it uses the existing slot image rather than showing a bare icon.

### Issue 2: `unlock_cost` Column Does Not Exist
In `src/hooks/useCharacterSlots.ts` line 137, the insert includes `unlock_cost: 0` but that column does not exist on the `profiles` table. Simply remove that property from the insert object.

### Files to Edit
1. **`src/pages/hubs/CharacterHub.tsx`** — Add `tileImageKey: "buy-character-slot"` to the characters tile.
2. **`src/hooks/useCharacterSlots.ts`** — Remove `unlock_cost: 0` from the profile insert (line 137).

Two small, targeted fixes. No database changes needed.

