

# Plan: Text Tattoos with Font Styles (v1.0.914)

## Overview

Add a dedicated "Text Tattoo" creator within the tattoo parlour that lets players type custom text (band names, lyrics, quotes, dates) and choose from different font styles. Text tattoos are stored as regular player_tattoos with additional text metadata.

## Database Changes (1 migration)

### Add columns to `player_tattoos`
- `custom_text TEXT` — the text content (e.g. "Born to Rock")
- `font_style TEXT` — chosen font (e.g. 'gothic', 'script', 'typewriter', 'bold', 'minimal', 'graffiti', 'old_english', 'japanese_brush')

### Add text tattoo designs to `tattoo_designs`
- Insert ~8 text-style seed designs (one per font) with 'text' category, different body slots, and genre affinities favoring Rock/Punk/Hip-Hop

## Font Styles (8 total)

| Font ID | Label | Visual Style | CSS Font | Price Modifier |
|---------|-------|-------------|----------|---------------|
| gothic | Gothic | Dark, pointed serifs | `serif` + letter-spacing | 1.0x |
| script | Elegant Script | Flowing cursive | `cursive` / italic | 1.2x |
| typewriter | Typewriter | Monospace, worn | `monospace` | 0.8x |
| bold_caps | Bold Caps | Blocky uppercase | `sans-serif` bold | 1.0x |
| minimal | Minimal | Thin, clean | `sans-serif` light | 0.9x |
| graffiti | Graffiti | Street art style | custom display | 1.3x |
| old_english | Old English | Blackletter | serif styled | 1.4x |
| japanese_brush | Brush Stroke | Calligraphic | styled brush | 1.5x |

## File Changes

### New: `src/components/tattoo/TextTattooCreator.tsx`
- Dialog/panel for creating text tattoos
- Text input (max 40 chars), font style picker with live preview of each font
- Body slot selector (filtered to available slots)
- Price display based on parlour, artist, font modifier
- Preview section showing the text in the chosen font on a skin-colored background
- Submit triggers the same purchase flow as regular tattoos

### New: `src/data/tattooFonts.ts`
- Font style definitions with labels, CSS classes, price multipliers, descriptions
- Helper to get font CSS for rendering

### Modified: `src/pages/TattooParlour.tsx`
- Add "✍️ Text Tattoo" as a 4th tab alongside Shop/My Tattoos/Custom
- Import and render `TextTattooCreator` with parlour/artist context
- In "My Tattoos" tab, show custom_text with font styling for text tattoos

### Modified: `src/components/tattoo/TattooBodyPreview.tsx`
- For text tattoos, show a small "Aa" or the first letter instead of "✓" on the body map

### Modified: `src/data/tattooDesigns.ts`
- Extend `PlayerTattoo` interface with optional `custom_text` and `font_style` fields

### Modified: `src/components/VersionHeader.tsx` → v1.0.914
### Modified: `src/pages/VersionHistory.tsx` → add entry

## Text Tattoo Purchase Flow

1. Player goes to "Text Tattoo" tab, types text, picks font style and body slot
2. Price = base $150 × parlour multiplier × artist premium × font price modifier
3. Quality calculated same as regular tattoos (parlour tier + artist bonus)
4. Infection risk same as parlour's base risk
5. Inserted into `player_tattoos` with `custom_text` and `font_style` filled, `tattoo_design_id` null
6. Genre affinity for text tattoos: Rock +2%, Punk +3%, Hip Hop +5%, Pop -2%, Classical -4%

## Visual Preview in Font Picker

Each font option shows the player's typed text rendered in that style, so they can compare before committing. The preview renders on a dark card with the ink color applied.

