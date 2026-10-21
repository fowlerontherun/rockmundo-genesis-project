import type { ArtworkDesign } from './design';

type ArtworkStyle = Pick<ArtworkDesign, 'background' | 'accent' | 'ink' | 'pattern' | 'font' | 'vinylStyle' | 'vinylColour'>;
export interface ArtworkPreset { id: string; name: string; style: ArtworkStyle }

export const artworkPresets: readonly ArtworkPreset[] = [
  { id: 'neon', name: 'Neon nights', style: { background: '#15102b', accent: '#f05ad4', ink: '#ffffff', pattern: 'rays', font: 'sans-serif', vinylStyle: 'splatter', vinylColour: '#7036b8' } },
  { id: 'garage', name: 'Garage punk', style: { background: '#191919', accent: '#d9ef45', ink: '#ffffff', pattern: 'stripes', font: 'monospace', vinylStyle: 'splatter', vinylColour: '#516222' } },
  { id: 'soul', name: 'Golden soul', style: { background: '#402218', accent: '#e4a64d', ink: '#fff4db', pattern: 'rays', font: 'serif', vinylStyle: 'colour', vinylColour: '#b87520' } },
  { id: 'pop', name: 'Bubblegum pop', style: { background: '#f8d9ed', accent: '#d64e97', ink: '#39182d', pattern: 'circles', font: 'sans-serif', vinylStyle: 'colour', vinylColour: '#ed91c4' } },
  { id: 'midnight', name: 'Midnight jazz', style: { background: '#102e3b', accent: '#45969b', ink: '#f6eedc', pattern: 'circles', font: 'serif', vinylStyle: 'black', vinylColour: '#45969b' } },
  { id: 'mono', name: 'Monochrome', style: { background: '#161616', accent: '#777777', ink: '#ffffff', pattern: 'stripes', font: 'monospace', vinylStyle: 'black', vinylColour: '#777777' } },
];

export function matchesArtworkPreset(design: ArtworkDesign, preset: ArtworkPreset): boolean {
  return (Object.keys(preset.style) as (keyof ArtworkStyle)[]).every(key => design[key] === preset.style[key]);
}
