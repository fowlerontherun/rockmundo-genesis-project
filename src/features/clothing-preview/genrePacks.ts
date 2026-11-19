import type { ClothingItem } from '@/hooks/useSkinStore';

/** New drops deliberately reuse the shipped rig, rather than inventing unrigged silhouettes. */
export const GENRE_PACKS = [
  { key: 'metal', name: 'Metal After Midnight', theme: 'Metal', colours: ['#24262b', '#17191d', '#292b30'], names: ['After Midnight Tee', 'Blackout Stage Jeans', 'Iron Stage Boots'], fabrics: ['plain', 'denim', 'plain'], finishes: ['cotton', 'denim', 'leather'] },
  { key: 'indie', name: 'Indie Soundcheck', theme: 'Indie Rock', colours: ['#427b70', '#40566d', '#ece9df'], names: ['Soundcheck Stripe Tee', 'Indie Straight Jeans', 'Soundcheck Canvas Trainers'], fabrics: ['stripe', 'denim', 'canvas'], finishes: ['cotton', 'denim', 'canvas'] },
  { key: 'electronic', name: 'Electronic Pulse', theme: 'Electronic', colours: ['#c34e7a', '#30343b', '#ece9df'], names: ['Pulse Stripe Tee', 'Graphite Stage Trousers', 'Pulse Canvas Trainers'], fabrics: ['stripe', 'plain', 'canvas'], finishes: ['cotton', 'cotton', 'canvas'] },
  { key: 'jazz', name: 'Jazz Club Sessions', theme: 'Jazz', colours: ['#843f49', '#343942', '#292b30'], names: ['Club Sessions Tee', 'Club Tailored Trousers', 'Club Polished Boots'], fabrics: ['plain', 'plain', 'plain'], finishes: ['vintage-cotton', 'cotton', 'polished-leather'] },
] as const;

export function genrePackItems(pack: typeof GENRE_PACKS[number]): ClothingItem[] {
  return pack.names.map((name, index): ClothingItem => {
    const slot = ['top', 'bottom', 'footwear'][index];
    return {
      id: `genre-${pack.key}-${index}`, name, description: `${pack.theme} stage wardrobe.`, category: index === 0 ? 't-shirt' : index === 1 ? 'pants' : pack.key === 'metal' || pack.key === 'jazz' ? 'boots' : 'trainers',
      wearable_slot: slot, price: 0, is_premium: false, rarity: 'uncommon', color_variants: [pack.colours[index]], collection_id: pack.key, release_date: null, expiry_date: null, is_limited_edition: false, featured: true, rpm_asset_id: null,
      curated_asset_key: `clothing.genre.${pack.key}.${slot}`, curated_asset_status: 'published', supported_frames: ['masculine', 'feminine'],
      material_config: { primaryColor: pack.colours[index], finish: pack.finishes[index] },
      render_config: { curatedSource: { kind: 'avatar-part', style: index === 1 ? 'suit' : index === 2 && (pack.key === 'metal' || pack.key === 'jazz') ? 'punk' : 'casual', part: ['body', 'legs', 'feet'][index], shape: index === 0 ? 'tee' : index === 1 ? 'trousers' : 'as-is', color: pack.colours[index], secondaryColor: '#ece9df', fabric: pack.fabrics[index], finish: pack.finishes[index] } },
    };
  });
}