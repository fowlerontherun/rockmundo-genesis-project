import { imageCrop, loadArtworkImage, validateImageLayer, MAX_DESIGN_BYTES, type ArtworkImageLayer } from './imageLayer';
export type ArtworkSurface = 'cover' | 'cd' | 'vinyl';
export interface ArtworkDesign {
  version: 1;
  image?: ArtworkImageLayer;
  title: string;
  artist: string;
  subtitle: string;
  background: string;
  accent: string;
  ink: string;
  pattern: 'rays' | 'stripes' | 'circles';
  vinylStyle: 'black' | 'colour' | 'splatter';
  vinylColour: string;
  font: 'sans-serif' | 'serif' | 'monospace';
}
export const newArtworkDesign = (title = '', artist = ''): ArtworkDesign => ({ version: 1, title: title.slice(0, 100), artist: artist.slice(0, 100), subtitle: 'SIDE A', background: '#201431', accent: '#bf84ee', ink: '#ffffff', pattern: 'rays', vinylStyle: 'black', vinylColour: '#7c3aed', font: 'sans-serif' });
export function parseArtworkDesign(text: string): ArtworkDesign {
  if (text.length > MAX_DESIGN_BYTES) throw new Error('Design file is too large.');
  const d = JSON.parse(text);

  if (!d || d.version !== 1 || !['rays', 'stripes', 'circles'].includes(d.pattern) || !['sans-serif', 'serif', 'monospace'].includes(d.font)) throw new Error('Choose a Rockmundo artwork design file.');
  if (!['black', 'colour', 'splatter'].includes(d.vinylStyle)) throw new Error('Invalid vinyl style.');
  for (const k of ['background', 'accent', 'ink', 'vinylColour']) if (typeof d[k] !== 'string' || !/^#[0-9a-f]{6}$/i.test(d[k])) throw new Error('Invalid design colour.');
  for (const k of ['title', 'artist', 'subtitle']) if (typeof d[k] !== 'string' || d[k].length > 100) throw new Error('Design text must be 100 characters or fewer.');
  return { version: 1, title: d.title, artist: d.artist, subtitle: d.subtitle, background: d.background, accent: d.accent, ink: d.ink, pattern: d.pattern, font: d.font, vinylStyle: d.vinylStyle, vinylColour: d.vinylColour, ...(d.image === undefined ? {} : { image: validateImageLayer(d.image) }) };
}

/** One renderer for both live previews and 1200px PNG exports. No remote assets. */
export function drawArtwork(canvas: HTMLCanvasElement, design: ArtworkDesign, surface: ArtworkSurface, image?: HTMLImageElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create an artwork canvas.');
  const size = 1200;
  canvas.width = size; canvas.height = size;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  if (surface !== 'cover') {
    ctx.beginPath(); ctx.arc(600, 600, 570, 0, Math.PI * 2); ctx.clip();
  }
  ctx.fillStyle = design.background; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = design.accent; ctx.strokeStyle = design.accent;
  if (design.pattern === 'stripes') {
    for (let x = -1200; x < 2400; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 80, 0); ctx.lineTo(x + 1280, 1200); ctx.lineTo(x + 1200, 1200); ctx.fill(); }
  } else if (design.pattern === 'circles') {
    for (let y = 0; y < 1200; y += 200) for (let x = 0; x < 1200; x += 200) { ctx.beginPath(); ctx.arc(x + 70, y + 70, 60, 0, Math.PI * 2); ctx.fill(); }
  } else {
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(600, 600); ctx.lineTo(600 + Math.cos(a) * 1800, 600 + Math.sin(a) * 1800); ctx.lineTo(600 + Math.cos(a + .1) * 1800, 600 + Math.sin(a + .1) * 1800); ctx.fill(); }
  }
  if (design.image && image) {
    const crop = imageCrop(image.naturalWidth, image.naturalHeight, design.image);
    const offset = surface === 'vinyl' ? 360 : 0;
    const target = surface === 'vinyl' ? 480 : size;
    ctx.drawImage(image, crop.sx, crop.sy, crop.size, crop.size, offset, offset, target, target);
  }
  if (surface === 'vinyl') {
    ctx.save();
    ctx.beginPath(); ctx.arc(600, 600, 570, 0, Math.PI * 2); ctx.arc(600, 600, 240, 0, Math.PI * 2, true); ctx.clip('evenodd');
    ctx.fillStyle = design.vinylStyle === 'black' ? '#101014' : design.vinylColour;
    ctx.fillRect(0, 0, size, size);
    if (design.vinylStyle === 'splatter') {
      ctx.fillStyle = design.accent;
      for (let i = 0; i < 90; i++) {
        const a = i * 2.39996; const r = 250 + ((i * 71) % 320);
        ctx.beginPath(); ctx.ellipse(600 + Math.cos(a) * r, 600 + Math.sin(a) * r, 6 + i % 18, 12 + i % 30, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#ffffff28'; ctx.lineWidth = 2;
    for (let r = 260; r < 565; r += 12) { ctx.beginPath(); ctx.arc(600, 600, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  // Backing panels keep player-selected text readable against busy patterns.
  ctx.fillStyle = design.background;
  const small = surface === 'vinyl';
  const width = small ? 390 : 900;
  const top = small ? 445 : 210;
  ctx.fillRect(600 - width / 2, top - 50, width, small ? 125 : 260);
  ctx.fillRect(600 - width / 2, small ? 660 : 830, width, small ? 65 : 105);
  const text = (value: string, y: number, fontSize: number, weight = '400') => {
    ctx.fillStyle = design.ink;
    ctx.font = `${weight} ${fontSize}px ${design.font}`;
    while (ctx.measureText(value).width > width - 30 && fontSize > 12) { fontSize -= 1; ctx.font = `${weight} ${fontSize}px ${design.font}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, 600, y, width - 30);
  };
  text(design.artist, top, small ? 26 : 42);
  text(design.title, top + (small ? 55 : 110), small ? 38 : 78, '700');
  text(design.subtitle, small ? 692 : 882, small ? 22 : 32);
  if (surface === 'cd') {
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 25; ctx.beginPath(); ctx.arc(600, 600, 135, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(600, 600, 560, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  if (surface !== 'cover') {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(600, 600, surface === 'cd' ? 90 : 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

export async function artworkFile(design: ArtworkDesign, surface: ArtworkSurface): Promise<File> {
  const canvas = document.createElement('canvas');
  const image = design.image ? await loadArtworkImage(design.image) : undefined;
  drawArtwork(canvas, design, surface, image);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not export artwork.')), 'image/png'));
  return new File([blob], `rockmundo-${surface}.png`, { type: 'image/png' });
}

export function downloadArtworkFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
