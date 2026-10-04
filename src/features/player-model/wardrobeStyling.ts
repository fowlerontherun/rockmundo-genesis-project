import type { EquipmentSlot, PlayerAppearance } from './appearance';

export const OUTFIT_LOOKS = [
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
    equipment[slot] = { itemId: `starter.${slot}.${look.items[index]}`, color: look.colours[index] };
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
