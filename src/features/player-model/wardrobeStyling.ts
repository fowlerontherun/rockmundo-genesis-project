import type { ClothingPattern, EquipmentSlot, PlayerAppearance } from './appearance';

type OutfitLook = {
  name: string;
  items: readonly [string, string, string];
  colours: readonly [string, string, string];
  fabrics?: Partial<Record<EquipmentSlot, { pattern: ClothingPattern; secondaryColor: string }>>;
};

export const OUTFIT_LOOKS: readonly OutfitLook[] = [
  { name: 'Polka-dot summer', items: ['sundress', 'briefs', 'canvas-trainers'], colours: ['#283954', '#283954', '#eee8db'], fabrics: { top: { pattern: 'dots', secondaryColor: '#eee8db' } } },
  { name: 'Checked encore', items: ['vest', 'pleated-skirt', 'black-boots'], colours: ['#eee8db', '#722f46', '#20232b'], fabrics: { bottom: { pattern: 'checks', secondaryColor: '#20232b' } } },
  { name: 'Colour-block backstage', items: ['hoodie', 'black-jeans', 'canvas-trainers'], colours: ['#90c9eb', '#20232b', '#eee8db'], fabrics: { top: { pattern: 'two-tone', secondaryColor: '#ba9bd9' } } },
  { name: 'Summer dress', items: ['sundress', 'briefs', 'canvas-trainers'], colours: ['#d376a1', '#d376a1', '#ffffff'] },
  { name: 'Pleated pop', items: ['vest', 'pleated-skirt', 'black-boots'], colours: ['#eee8db', '#8055a2', '#20232b'] },
  { name: 'Indie everyday', items: ['plain-white', 'blue-jeans', 'canvas-trainers'], colours: ['#ffffff', '#426baa', '#20232b'] },
  { name: 'Midnight stage', items: ['v-neck', 'dark-slim-jeans', 'black-boots'], colours: ['#20232b', '#283954', '#20232b'] },
  { name: 'Pastel pop', items: ['hoodie', 'chinos', 'canvas-trainers'], colours: ['#ba9bd9', '#eee8db', '#ffffff'] },
  { name: 'Summer festival', items: ['tank', 'denim-shorts', 'canvas'], colours: ['#ed7836', '#426baa', '#eee8db'] },
  { name: 'Encore tailoring', items: ['pinstripe', 'suit', 'patent'], colours: ['#283954', '#283954', '#20232b'] },
  { name: 'Backstage casual', items: ['zip-hoodie', 'black-jeans', 'canvas-trainers'], colours: ['#722f46', '#20232b', '#eee8db'] },
] as const;

export function applyOutfitLook(appearance: PlayerAppearance, look: typeof OUTFIT_LOOKS[number]): PlayerAppearance {
  const equipment = { ...appearance.equipment };
  (['top', 'bottom', 'footwear'] as const).forEach((slot, index) => {
    equipment[slot] = { itemId: `starter.${slot}.${look.items[index]}`, color: look.colours[index], ...look.fabrics?.[slot] };
  });
  return { ...appearance, equipment };
}

export function garmentCategory(slot: EquipmentSlot, id: string): string {
  if (slot === 'footwear') return /boots|punk/.test(id) ? 'Boots' : /suit|patent|two-tone/.test(id) ? 'Formal shoes' : 'Casual shoes';
  if (slot === 'bottom' && /skirt/.test(id)) return 'Skirts';
  if (/dress/.test(id)) return 'Dresses';
  if (slot === 'bottom') return /briefs/.test(id) ? 'Underwear' : /shorts/.test(id) ? 'Shorts' : 'Trousers';
  if (id.endsWith('.topless')) return 'No top';
  if (/hoodie/.test(id)) return 'Hoodies';
  if (/suit|pinstripe/.test(id)) return 'Tailoring';
  if (/tank|vest|punk|plaid/.test(id)) return 'Sleeveless tops';
  return id.endsWith('.long-sleeve') ? 'Long sleeves' : 'T-shirts';
}
