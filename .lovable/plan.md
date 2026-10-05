# More realistic luthiery instruments and equipment variety

## Workshop improvements
- Rework the existing nine guitar and bass silhouettes with recognisable cutaways, horns, waists and lower bouts; keep every existing design ID.
- Add six distinct body designs: a compact double-cut, a traditional slab single-cut, a semi-hollow guitar, a jazz-style offset bass, a modern sculpted bass and a short-scale bass.
- Correct the preview’s bridge-to-nut string alignment, tapered neck, fret spacing, headstock and tuning machines. Show six strings for guitars and four for basses, with pickups and controls placed on the body rather than overlapping the neck.
- Keep artwork clipped to the body and give satin, gloss, sunburst and metallic finishes distinct appearances.
- Carry the same body silhouettes into the 3D gig instruments so crafted instruments remain recognisable on stage.

## More component choices
- Add at least two variations to each workshop category: body construction, neck, fretboard, electronics, hardware and finish.
- Use realistic construction choices such as chambered bodies, carved tops, neck profiles, fretboard inlays, pickup configurations and bridge treatments. Variations must have visible differences where applicable, not just different labels.
- Keep existing materials usable and clearly show the materials each variation consumes. Preserve skill requirements, stock deductions and server-calculated quality rather than introducing free cosmetic upgrades.
- Keep incompatible options out of new guitar/bass selections without invalidating existing saved instruments.

## Compatibility and checks
- Preserve purchases, inventory, existing crafted instruments and immutable build records.
- Test existing crafting journeys, new variant catalogue consistency, string/fret alignment, artwork clipping and 3D shape differences.
- Check the workshop’s actual appearance and interactions in the running game; check current error reports before declaring completion.
- Update the banner to **1.1.765** and add the changes to version history.

## Technical details
- Keep shape definitions shared between the SVG workshop preview and Three.js stage rendering to prevent future silhouette drift.
- Register new shape and component IDs in both the workshop catalogue and the authoritative private crafting tables through an additive migration. Do not change ownership, payment or crafting RPC permissions.
- Reuse stocked materials for construction variants where appropriate; retain existing IDs and material aliases.
- Add regression coverage to the existing luthiery and stage-instrument test suites. If database deployment cannot be verified, report that limitation and do not describe new variants as ready for live crafting.