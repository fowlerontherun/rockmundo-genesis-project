import rockmundoLogo from '@/assets/rockmundo-new-logo.png';
import { SHARE_FORMATS, type ShareFormat, type ShareMoment } from './types';

export function shareFilename(moment: ShareMoment, format: ShareFormat): string {
  const slug = moment.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || moment.type;
  return `rockmundo-${slug}-${format}.png`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min = 28): number {
  let size = start;
  while (size > min) {
    ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export function renderShareMoment(canvas: HTMLCanvasElement, moment: ShareMoment, format: ShareFormat): void {
  const { width, height } = SHARE_FORMATS[format];
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#070b12'); bg.addColorStop(.55, '#101b2b'); bg.addColorStop(1, '#28143a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * .72, height * .3, 20, width * .72, height * .3, Math.max(width, height) * .65);
  glow.addColorStop(0, '#8b5cf655'); glow.addColorStop(1, '#00000000');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

  const pad = Math.round(width * .06);
  ctx.textAlign = 'left';
  const logo = new Image();
  logo.onload = () => {
    const logoW = Math.min(260, width * .24);
    const logoH = logoW * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, pad, pad, logoW, logoH);
  };
  logo.src = rockmundoLogo;

  if (moment.eyebrow) {
    ctx.fillStyle = '#c4b5fd'; ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(moment.eyebrow.toUpperCase(), pad, height * .22);
  }

  const textWidth = format === 'landscape' ? width * .55 : width - pad * 2;
  const headlineSize = fitText(ctx, moment.headline, textWidth, format === 'landscape' ? 62 : format === 'story' ? 82 : 76);
  ctx.font = `800 ${headlineSize}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff';
  ctx.fillText(moment.headline, pad, height * .31);

  if (moment.subheadline) {
    ctx.font = '500 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#d6d3d1';
    ctx.fillText(moment.subheadline, pad, height * .31 + 54);
  }

  const metrics = moment.metrics?.slice(0, 4) ?? [];
  metrics.forEach((metric, index) => {
    const y = (format === 'story' ? height * .7 : format === 'landscape' ? height * .57 : height * .58) + index * (format === 'story' ? 78 : 58);
    ctx.fillStyle = '#ffffff88'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.fillText(metric.label.toUpperCase(), pad, y);
    ctx.fillStyle = '#fff'; ctx.font = '800 34px Inter, system-ui, sans-serif'; ctx.fillText(metric.value, pad + 220, y);
  });

  ctx.fillStyle = '#ffffff88'; ctx.font = '500 21px Inter, system-ui, sans-serif';
  ctx.fillText('Build your music career at rockmundo.uk', pad, height - pad);
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to render share image')), 'image/png'));
}
