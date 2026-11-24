import metal from '@/assets/wardrobe/metal.webp.asset.json';
import indie from '@/assets/wardrobe/indie.webp.asset.json';
import electronic from '@/assets/wardrobe/electronic.webp.asset.json';
import jazz from '@/assets/wardrobe/jazz.webp.asset.json';

const artwork: Record<string, string> = {
  'Metal After Midnight': metal.url,
  'Indie Soundcheck': indie.url,
  'Electronic Pulse': electronic.url,
  'Jazz Club Sessions': jazz.url,
};
export const collectionArtwork = (name: string) => artwork[name];