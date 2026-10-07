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
  let [start,mid,end,accent]=themes[moment.type] ?? themes.character_profile;
  if(moment.visualTheme==='spotlight'){start='#09090b';mid='#18181b';end='#27272a';accent='#facc15';}
  else if(moment.visualTheme==='neon'){start='#020617';mid='#172554';end='#4c1d95';accent='#22d3ee';}
  else if(moment.visualTheme==='mono'){start='#050505';mid='#171717';end='#262626';accent='#d4d4d4';}
  const headlineVariant = moment.type === 'festival' && moment.variant === 'headline';
  const recordAward = moment.type === 'release' && /(?:1M|10M|100M)\s+(?:streams|in gross sales)/i.test(moment.subheadline || '');
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0,start); bg.addColorStop(.55,mid); bg.addColorStop(1,end);
  ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
  if(recordAward){const award=ctx.createRadialGradient(width*.82,height*.26,10,width*.82,height*.26,width*.25);award.addColorStop(0,'#fef3c7aa');award.addColorStop(.5,'#d4af3766');award.addColorStop(1,'#00000000');ctx.fillStyle=award;ctx.fillRect(0,0,width,height);}
  const glow=ctx.createRadialGradient(width*.72,height*.3,20,width*.72,height*.3,Math.max(width,height)*.65);
  glow.addColorStop(0,accent+'66'); glow.addColorStop(1,'#00000000'); ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
  if (headlineVariant) { const halo=ctx.createRadialGradient(width*.5,height*.22,10,width*.5,height*.22,width*.55);halo.addColorStop(0,'#fef08a55');halo.addColorStop(1,'#00000000');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height); }
  ctx.save(); ctx.globalAlpha=headlineVariant ? .22 : .12; ctx.strokeStyle=headlineVariant?'#fde047':accent; ctx.lineWidth=Math.max(2,width*.003);
  if(moment.type==='band_profile'){
    ctx.save();
    ctx.globalAlpha=.14;
    ctx.strokeStyle=accent;
    ctx.lineWidth=Math.max(2,width*.004);
    const centerY=height*.28;
    for(let row=0;row<4;row++){
      ctx.beginPath();
      for(let x=0;x<=width;x+=Math.max(12,width/70)){
        const y=centerY+row*height*.055+Math.sin((x/width)*Math.PI*8+row)*height*.018;
        if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha=.08;
    ctx.fillStyle=accent;
    ctx.beginPath(); ctx.arc(width*.82,height*.2,width*.18,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if(moment.type==='festival'){
    ctx.save();
    ctx.globalAlpha=.16;
    ctx.fillStyle=accent;
    const beamY=height*.18;
    for(let i=0;i<5;i++){
      ctx.beginPath();
      ctx.moveTo(width*(.08+i*.21),beamY);
      ctx.lineTo(width*(.02+i*.24),height*.62);
      ctx.lineTo(width*(.16+i*.19),height*.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha=.35;
    for(let i=0;i<7;i++){
      ctx.beginPath();
      ctx.arc(width*(.08+i*.145),height*(.15+(i%2)*.035),width*.012,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  if(moment.type==='tour'){ctx.beginPath();ctx.moveTo(width*.58,height*.18);ctx.bezierCurveTo(width*.72,height*.12,width*.75,height*.34,width*.9,height*.27);ctx.stroke();for(const [x,y] of [[.58,.18],[.73,.2],[.9,.27]]){ctx.beginPath();ctx.arc(width*x,height*y,width*.012,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();}}
  else if(moment.type==='festival'){for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(width*(.68+i*.07),height*(.18+i*.025),width*(.04+i*.018),0,Math.PI*2);ctx.stroke();}}
  else if(moment.type==='gig_result'){for(let x=-height;x<width;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+height,height);ctx.stroke();}}
  else if(moment.type==='chart'){for(let i=0;i<6;i++){const barW=width*.035,barH=height*(.08+i*.035);ctx.fillStyle=accent;ctx.fillRect(width*.76+i*barW*1.25,height*.78-barH,barW,barH);}}
  else if(moment.type==='achievement'){ctx.beginPath();ctx.arc(width*.82,height*.24,width*.14,0,Math.PI*2);ctx.stroke();}
  else if(moment.type==='release'){ctx.save();if(recordAward){ctx.strokeStyle='#f6d365';ctx.lineWidth=Math.max(5,width*.006);ctx.globalAlpha=.75;}ctx.beginPath();ctx.arc(width*.82,height*.26,width*.18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(width*.82,height*.26,width*.055,0,Math.PI*2);ctx.stroke();if(recordAward){ctx.font=`900 ${Math.round(width*.035)}px Inter, system-ui, sans-serif`;ctx.fillStyle='#fde68a';ctx.textAlign='center';ctx.fillText('MILLION CLUB',width*.82,height*.51);}ctx.restore();}
  ctx.restore();

  const layout=moment.visualLayout ?? 'right';
  if (artwork) {
    const size=format==='landscape'?height*(layout==='hero'?.58:.48):width*(layout==='hero'?.44:.34);
    const x=layout==='left'?width*.055:layout==='hero'?(width-size)/2:width-size-width*.065;
    const y=layout==='hero'?(format==='story'?height*.48:height*.09):height*.08;
    ctx.save(); ctx.globalAlpha=.88; ctx.beginPath(); ctx.roundRect(x,y,size,size,Math.max(18,size*.06)); ctx.clip(); ctx.drawImage(artwork,x,y,size,size); ctx.restore();
  }

  if (avatar) {
    const avatarW = format === 'landscape' ? width * (layout==='hero'?.42:.34) : width * (layout==='hero'?.62:.5);
    const avatarH = format === 'landscape' ? height * (layout==='hero'?.9:.82) : height * (layout==='hero'?.6:.52);
    const avatarX = layout==='left' ? Math.round(width*.025) : layout==='hero' ? Math.round((width-avatarW)/2) : width - avatarW - Math.round(width * .035);
    const avatarY = layout==='hero' ? (format==='story'?height*.38:height*.12) : format === 'story' ? height * .42 : height * .16;
    const avatarGlow = ctx.createRadialGradient(avatarX + avatarW * .55, avatarY + avatarH * .48, 10, avatarX + avatarW * .55, avatarY + avatarH * .48, avatarW * .62);
    avatarGlow.addColorStop(0, accent + '44'); avatarGlow.addColorStop(1, '#00000000');
    ctx.save(); ctx.fillStyle = avatarGlow; ctx.fillRect(avatarX - avatarW * .12, avatarY - avatarH * .08, avatarW * 1.24, avatarH * 1.16); ctx.restore();
    ctx.save(); ctx.globalAlpha = .96; ctx.drawImage(avatar, avatarX, avatarY, avatarW, avatarH); ctx.restore();
  }

  const pad = Math.round(width * .06);
  const hasVisual = Boolean(avatar || artwork);
  const sideVisual = hasVisual && layout !== 'hero';
  const textWidth = sideVisual
    ? (format === 'landscape' ? width * .54 : format === 'square' ? width * .52 : width - pad * 2)
    : width - pad * 2;
  const textX = sideVisual && layout === 'left' ? width - pad - textWidth : pad;
  ctx.textAlign = 'left';
  if (logo) {
    const logoW = Math.min(width * .22, 250); const ratio = Number((logo as HTMLImageElement).naturalWidth || (logo as HTMLCanvasElement).width || 1) / Number((logo as HTMLImageElement).naturalHeight || (logo as HTMLCanvasElement).height || 1);
    const logoH = logoW / Math.max(.1, ratio); ctx.drawImage(logo, textX, pad, logoW, logoH);
  } else {
    ctx.fillStyle = '#ffffffaa'; ctx.font = '700 28px Inter, system-ui, sans-serif'; ctx.fillText('ROCKMUNDO', textX, pad + 28);
  }

  if (moment.eyebrow) {
    ctx.fillStyle = headlineVariant ? '#fde047' : '#c4b5fd'; ctx.font = headlineVariant ? '900 30px Inter, system-ui, sans-serif' : '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(moment.eyebrow.toUpperCase(), textX, height * .22);
  }

  const headlineStart = format === 'story' ? height * .18 : height * .31;
  const headlineSize = fitText(ctx, moment.headline, textWidth, format === 'landscape' ? 62 : 76, 34);
  ctx.font = `800 ${headlineSize}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff';
  const headlineHeight = drawWrappedText(ctx, moment.headline, textX, headlineStart, textWidth, headlineSize * 1.05, 2);

  let contentY = headlineStart + headlineHeight + 14;
  if (moment.subheadline) {
    ctx.font = '500 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#d6d3d1';
    contentY += drawWrappedText(ctx, moment.subheadline, textX, contentY, textWidth, 38, 2) + 22;
  }

  const metrics = moment.metrics?.slice(0, format === 'landscape' ? 3 : 4) ?? [];
  const metricStart = Math.max(format === 'story' ? height * .34 : height * .5, contentY);
  metrics.forEach((metric, index) => {
    const y = metricStart + index * 72;
    ctx.fillStyle = '#ffffff88'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.fillText(metric.label.toUpperCase(), textX, y);
    ctx.fillStyle = '#fff'; ctx.font = '800 34px Inter, system-ui, sans-serif';
    const valueX = format === 'story' ? textX : textX + Math.min(220, textWidth * .42);
    const valueWidth = format === 'story' ? textWidth : Math.max(120, textWidth - (valueX - textX));
    if (format === 'story') ctx.fillText(metric.value, valueX, y + 34);
    else drawWrappedText(ctx, metric.value, valueX, y, valueWidth, 38, 1);
  });

  ctx.fillStyle = '#ffffff88'; ctx.font = '500 21px Inter, system-ui, sans-serif';
  ctx.fillText('Build your music career at rockmundo.uk', textX, height - pad);
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to render share image')), 'image/png'));
}
