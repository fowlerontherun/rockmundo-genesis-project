-- Complete the production material catalogue required by the Phase 3 Luthiery workbench.
-- Idempotent by name: existing live catalogue rows and their balanced prices are preserved.

with missing_materials(name, category, rarity, quality_tier, base_cost, description) as (
  values
    ('Pine Body Blank', 'wood', 'common', 1, 6000, 'Soft, lightweight tonewood suitable for early Luthiery projects.'),
    ('Poplar Body Blank', 'wood', 'common', 1, 7000, 'Neutral, workable tonewood for beginner custom instruments.'),
    ('Ash Body Blank', 'wood', 'uncommon', 2, 15000, 'Bright, resonant body wood with pronounced grain.'),
    ('Korina Body Blank', 'wood', 'epic', 4, 45000, 'Rare lightweight tonewood with distinctive resonance and character.'),
    ('Brazilian Rosewood Set', 'wood', 'legendary', 5, 120000, 'Extremely rare premium rosewood stock reserved for masterwork instruments.'),
    ('Alnico V Pickup', 'electronics', 'uncommon', 2, 22000, 'Higher-output Alnico V pickup assembly with strong clarity.'),
    ('PAF Clone Pickup', 'electronics', 'rare', 3, 30000, 'Vintage-voiced humbucker assembly inspired by classic PAF pickups.'),
    ('Hand-Wound Boutique Pickup', 'electronics', 'epic', 4, 48000, 'Artisan hand-wound pickup assembly for premium custom instruments.'),
    ('Locking Tuners Set', 'hardware', 'uncommon', 2, 12000, 'Locking tuning machines for improved tuning stability and quicker string changes.'),
    ('Tune-O-Matic Bridge', 'hardware', 'common', 1, 7500, 'Fixed adjustable bridge for stable intonation and sustain.'),
    ('Tremolo Bridge', 'hardware', 'uncommon', 2, 15000, 'Vibrato bridge assembly for expressive pitch movement.'),
    ('Floyd Rose Tremolo', 'hardware', 'rare', 3, 30000, 'Double-locking tremolo system for extreme pitch effects with improved stability.'),
    ('Gold Hardware Set', 'hardware', 'epic', 4, 42000, 'Premium coordinated gold-plated bridge, controls and fittings.'),
    ('Satin Lacquer', 'finish', 'common', 1, 5000, 'Smooth low-sheen protective finish for custom instruments.'),
    ('Gloss Nitrocellulose', 'finish', 'uncommon', 2, 12000, 'Traditional gloss finish with a deep polished appearance.'),
    ('Burst Sunburst Finish', 'finish', 'rare', 3, 22000, 'Multi-tone burst finish applied over the selected body colour.'),
    ('Metallic Flake Finish', 'finish', 'rare', 3, 26000, 'High-impact metallic flake finish designed for stage presence.'),
    ('Custom Artwork Finish', 'finish', 'epic', 4, 55000, 'Premium artwork-ready finish required for custom workbench decal placement.')
)
insert into public.crafting_materials (name, category, rarity, quality_tier, base_cost, description)
select m.name, m.category, m.rarity, m.quality_tier, m.base_cost, m.description
from missing_materials m
where not exists (
  select 1
  from public.crafting_materials existing
  where lower(existing.name) = lower(m.name)
);
