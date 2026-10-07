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

export function renderShareMoment(canvas: HTMLCanvasElement, moment: ShareMoment, format: ShareFormat, avatar?: CanvasImageSource | null, artwork?: CanvasImageSource | null): void {
  const { width, height } = SHARE_FORMATS[format];
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const themes: Record<string, [string,string,string,string]> = {
    chart: ['#050816','#102047','#312e81','#60a5fa'],
    release: ['#0d0710','#351020','#6b213d','#fb7185'],
    achievement: ['#120d03','#3b2607','#713f12','#fbbf24'],
    gig_result: ['#030b0a','#07352f','#14532d','#34d399'],
    band_profile: ['#09070f','#21123b','#4c1d95','#a78bfa'],
    character_profile: ['#070b12','#101b2b','#28143a','#8b5cf6'],
  };
  const [start,mid,end,accent]=themes[moment.type] ?? themes.character_profile;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0,start); bg.addColorStop(.55,mid); bg.addColorStop(1,end);
  ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*.72,height*.3,20,width*.72,height*.3,Math.max(width,height)*.65);
  glow.addColorStop(0,accent+'66'); glow.addColorStop(1,'#00000000'); ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.globalAlpha=.12; ctx.strokeStyle=accent; ctx.lineWidth=Math.max(2,width*.003);
  if(moment.type==='gig_result'){for(let x=-height;x<width;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+height,height);ctx.stroke();}}
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
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffffaa'; ctx.font = '700 28px Inter, system-ui, sans-serif';
  ctx.fillText('ROCKMUNDO', pad, pad + 28);

  if (moment.eyebrow) {
    ctx.fillStyle = '#c4b5fd'; ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(moment.eyebrow.toUpperCase(), pad, height * .22);
  }

  const headlineSize = fitText(ctx, moment.headline, width - pad * 2, format === 'landscape' ? 62 : 76);
  ctx.font = `800 ${headlineSize}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff';
  ctx.fillText(moment.headline, pad, height * .31);

  if (moment.subheadline) {
    ctx.font = '500 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#d6d3d1';
    ctx.fillText(moment.subheadline, pad, height * .31 + 54);
  }

  const metrics = moment.metrics?.slice(0, 4) ?? [];
  metrics.forEach((metric, index) => {
    const y = height * .55 + index * 72;
    ctx.fillStyle = '#ffffff88'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.fillText(metric.label.toUpperCase(), pad, y);
    ctx.fillStyle = '#fff'; ctx.font = '800 34px Inter, system-ui, sans-serif'; ctx.fillText(metric.value, pad + 220, y);
  });

  ctx.fillStyle = '#ffffff88'; ctx.font = '500 21px Inter, system-ui, sans-serif';
  ctx.fillText('Build your music career at rockmundo.uk', pad, height - pad);
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to render share image')), 'image/png'));
}
