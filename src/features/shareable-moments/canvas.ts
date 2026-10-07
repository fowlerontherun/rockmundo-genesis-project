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

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2): number {
  const words = text.trim().split(/\s+/); const lines: string[] = []; let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; if (lines.length === maxLines - 1) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(' ').split(/\s+/).length;
  if (consumed < words.length && lines.length) {
    let last = lines.length - 1; let value = lines[last];
    while (value && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1);
    lines[last] = value.replace(/[\s,.;:-]+$/, '') + '…';
  }
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

export function renderShareMoment(canvas: HTMLCanvasElement, moment: ShareMoment, format: ShareFormat, avatar?: CanvasImageSource | null, artwork?: CanvasImageSource | null, logo?: CanvasImageSource | null): void {
  const { width, height } = SHARE_FORMATS[format];
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const themes: Record<string, [string,string,string,string]> = {
    chart: ['#050816','#102047','#312e81','#60a5fa'],
    release: ['#0d0710','#351020','#6b213d','#fb7185'],
    achievement: ['#120d03','#3b2607','#713f12','#fbbf24'],
    gig_result: ['#030b0a','#07352f','#14532d','#34d399'],
    festival: ['#100317','#351052','#701a75','#e879f9'],
    tour: ['#041014','#0b2d38','#164e63','#22d3ee'],
    band_profile: ['#09070f','#21123b','#4c1d95','#a78bfa'],
    character_profile: ['#070b12','#101b2b','#28143a','#8b5cf6'],
  };
  const [start,mid,end,accent]=themes[moment.type] ?? themes.character_profile;
  const headlineVariant = moment.type === 'festival' && moment.variant === 'headline';
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0,start); bg.addColorStop(.55,mid); bg.addColorStop(1,end);
  ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*.72,height*.3,20,width*.72,height*.3,Math.max(width,height)*.65);
  glow.addColorStop(0,accent+'66'); glow.addColorStop(1,'#00000000'); ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
  if (headlineVariant) { const halo=ctx.createRadialGradient(width*.5,height*.22,10,width*.5,height*.22,width*.55);halo.addColorStop(0,'#fef08a55');halo.addColorStop(1,'#00000000');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height); }
  ctx.save(); ctx.globalAlpha=headlineVariant ? .22 : .12; ctx.strokeStyle=headlineVariant?'#fde047':accent; ctx.lineWidth=Math.max(2,width*.003);
  if(moment.type==='tour'){ctx.beginPath();ctx.moveTo(width*.58,height*.18);ctx.bezierCurveTo(width*.72,height*.12,width*.75,height*.34,width*.9,height*.27);ctx.stroke();for(const [x,y] of [[.58,.18],[.73,.2],[.9,.27]]){ctx.beginPath();ctx.arc(width*x,height*y,width*.012,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();}}
  else if(moment.type==='festival'){for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(width*(.68+i*.07),height*(.18+i*.025),width*(.04+i*.018),0,Math.PI*2);ctx.stroke();}}
  else if(moment.type==='gig_result'){for(let x=-height;x<width;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+height,height);ctx.stroke();}}
  else if(moment.type==='chart'){for(let i=0;i<6;i++){const barW=width*.035,barH=height*(.08+i*.035);ctx.fillStyle=accent;ctx.fillRect(width*.76+i*barW*1.25,height*.78-barH,barW,barH);}}
  else if(moment.type==='achievement'){ctx.beginPath();ctx.arc(width*.82,height*.24,width*.14,0,Math.PI*2);ctx.stroke();}
  else if(moment.type==='release'){ctx.beginPath();ctx.arc(width*.82,height*.26,width*.18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(width*.82,height*.26,width*.055,0,Math.PI*2);ctx.stroke();}
  ctx.restore();

  if (artwork) {
    const size=format==='landscape'?height*.48:width*.34, x=width-size-width*.065, y=height*.08;
    ctx.save(); ctx.globalAlpha=.88; ctx.beginPath(); ctx.roundRect(x,y,size,size,Math.max(18,size*.06)); ctx.clip(); ctx.drawImage(artwork,x,y,size,size); ctx.restore();
  }

  if (avatar) {
    const avatarW = format === 'landscape' ? width * .34 : width * .5;
    const avatarH = format === 'landscape' ? height * .82 : height * .52;
    const avatarX = width - avatarW - Math.round(width * .035);
    const avatarY = format === 'story' ? height * .42 : height * .16;
    ctx.save(); ctx.globalAlpha = .96; ctx.drawImage(avatar, avatarX, avatarY, avatarW, avatarH); ctx.restore();
  }

  const pad = Math.round(width * .06);
  const rightVisual = Boolean(avatar || artwork);
  const textWidth = rightVisual
    ? (format === 'landscape' ? width * .54 : format === 'square' ? width * .52 : width - pad * 2)
    : width - pad * 2;
  ctx.textAlign = 'left';
  if (logo) {
    const logoW = Math.min(width * .22, 250); const ratio = Number((logo as HTMLImageElement).naturalWidth || (logo as HTMLCanvasElement).width || 1) / Number((logo as HTMLImageElement).naturalHeight || (logo as HTMLCanvasElement).height || 1);
    const logoH = logoW / Math.max(.1, ratio); ctx.drawImage(logo, pad, pad, logoW, logoH);
  } else {
    ctx.fillStyle = '#ffffffaa'; ctx.font = '700 28px Inter, system-ui, sans-serif'; ctx.fillText('ROCKMUNDO', pad, pad + 28);
  }

  if (moment.eyebrow) {
    ctx.fillStyle = headlineVariant ? '#fde047' : '#c4b5fd'; ctx.font = headlineVariant ? '900 30px Inter, system-ui, sans-serif' : '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(moment.eyebrow.toUpperCase(), pad, height * .22);
  }

  const headlineStart = format === 'story' ? height * .18 : height * .31;
  const headlineSize = fitText(ctx, moment.headline, textWidth, format === 'landscape' ? 62 : 76, 34);
  ctx.font = `800 ${headlineSize}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff';
  const headlineHeight = drawWrappedText(ctx, moment.headline, pad, headlineStart, textWidth, headlineSize * 1.05, 2);

  let contentY = headlineStart + headlineHeight + 14;
  if (moment.subheadline) {
    ctx.font = '500 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#d6d3d1';
    contentY += drawWrappedText(ctx, moment.subheadline, pad, contentY, textWidth, 38, 2) + 22;
  }

  const metrics = moment.metrics?.slice(0, format === 'landscape' ? 3 : 4) ?? [];
  const metricStart = Math.max(format === 'story' ? height * .34 : height * .5, contentY);
  metrics.forEach((metric, index) => {
    const y = metricStart + index * 72;
    ctx.fillStyle = '#ffffff88'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.fillText(metric.label.toUpperCase(), pad, y);
    ctx.fillStyle = '#fff'; ctx.font = '800 34px Inter, system-ui, sans-serif';
    const valueX = format === 'story' ? pad : pad + Math.min(220, textWidth * .42);
    const valueWidth = format === 'story' ? textWidth : Math.max(120, textWidth - (valueX - pad));
    if (format === 'story') ctx.fillText(metric.value, valueX, y + 34);
    else drawWrappedText(ctx, metric.value, valueX, y, valueWidth, 38, 1);
  });

  ctx.fillStyle = '#ffffff88'; ctx.font = '500 21px Inter, system-ui, sans-serif';
  ctx.fillText('Build your music career at rockmundo.uk', pad, height - pad);
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to render share image')), 'image/png'));
}
