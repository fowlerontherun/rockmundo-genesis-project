import type { ResolvedEnvironment } from "./EnvironmentRegistry";
import type { EnvironmentScenePlan } from "./EnvironmentScenePlan";
import type { VenueDetailPlan, VenueServiceDetail } from "./VenueDetailPlan";
import type { DecorationSlot, VenueSceneDescriptor } from "./VenueSceneRegistry";
import type { Size } from "./Viewport";

export const SCENE_LAYER_ORDER = ["environment", "architecture", "background-decorations", "stage-band", "crowd", "venue-activity", "foreground-effects", "viewer-interface"] as const;
const rect = (r: { x: number; y: number; width: number; height: number }, s: Size) => ({ x: r.x * s.width, y: r.y * s.height, width: r.width * s.width, height: r.height * s.height });

const SKY_GRADIENTS: Readonly<Record<"day" | "sunset" | "night", readonly [string, string, string]>> = Object.freeze({
  day: ["#1e3a8a", "#3b82f6", "#bae6fd"],
  sunset: ["#1e1b4b", "#b45309", "#fbbf24"],
  night: ["#020617", "#0b1220", "#1e293b"],
});

const BUILDING_TONES: Readonly<Record<EnvironmentScenePlan["skyline"], readonly string[]>> = Object.freeze({
  tower: ["#0f172a", "#111c33", "#1b263b", "#0b1220"],
  brick: ["#451a03", "#5b2109", "#7c2d12", "#3b1606"],
  roofline: ["#292524", "#3f2a22", "#44403c", "#231f1d"],
  shed: ["#1f2937", "#334155", "#263041", "#111827"],
  resort: ["#e2e8f0", "#cbd5e1", "#f1f5f9", "#94a3b8"],
  none: ["#1e293b"],
});

/**
 * Layered stylized exterior. Static layers derive from the deterministic plan;
 * only movers, water and weather advance with playback and they are skipped
 * entirely under Reduced Motion.
 */
export function drawExteriorEnvironment(
  ctx: CanvasRenderingContext2D,
  size: Size,
  environment: ResolvedEnvironment,
  plan: EnvironmentScenePlan,
  positionMs = 0,
  reducedMotion = false,
) {
  const { profile, timeOfDay, atmosphere } = environment;
  const horizonY = size.height * .31;
  const time = reducedMotion ? 0 : positionMs / 1000;
  ctx.save();

  // Sky.
  const [top, mid, low] = SKY_GRADIENTS[timeOfDay];
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, top); sky.addColorStop(.62, mid); sky.addColorStop(1, low);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, size.width, horizonY);

  if (plan.starField.length) {
    ctx.fillStyle = "rgba(248,250,252,.75)";
    plan.starField.forEach((star) => { ctx.beginPath(); ctx.arc(star.x * size.width, star.y * horizonY, star.radius, 0, Math.PI * 2); ctx.fill(); });
  }
  if (timeOfDay !== "night") {
    const glowX = size.width * (timeOfDay === "sunset" ? .78 : .22);
    const glowY = horizonY * (timeOfDay === "sunset" ? .82 : .34);
    const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, size.height * .3);
    glow.addColorStop(0, timeOfDay === "sunset" ? "rgba(254,215,170,.95)" : "rgba(255,255,255,.85)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, size.width, horizonY);
  }

  // Distant relief.
  plan.ridges.forEach((ridge, index) => {
    const x = ridge.x * size.width; const w = ridge.width * size.width; const peak = horizonY - ridge.height * size.height;
    ctx.fillStyle = index % 2 ? profile.silhouette : shade(profile.silhouette, .82);
    ctx.beginPath(); ctx.moveTo(x, horizonY); ctx.lineTo(x + w / 2, peak); ctx.lineTo(x + w, horizonY); ctx.closePath(); ctx.fill();
    if (ridge.snow) { ctx.fillStyle = "rgba(248,250,252,.9)"; ctx.beginPath(); ctx.moveTo(x + w * .38, peak + ridge.height * size.height * .22); ctx.lineTo(x + w / 2, peak); ctx.lineTo(x + w * .62, peak + ridge.height * size.height * .22); ctx.closePath(); ctx.fill(); }
  });

  // Skyline, back layer first for depth.
  const tones = BUILDING_TONES[plan.skyline];
  [0, 1].forEach((depth) => {
    plan.buildings.filter((building) => building.depth === depth).forEach((building) => {
      const w = building.width * size.width;
      const h = building.height * size.height;
      const x = building.x * size.width;
      const y = horizonY - h;
      ctx.fillStyle = tones[building.tone % tones.length];
      ctx.globalAlpha = depth === 0 ? .72 : 1;
      ctx.fillRect(x, y, w, h);
      if (building.roof === "pitched") { ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x + w / 2, y - h * .16); ctx.lineTo(x + w + 1, y); ctx.closePath(); ctx.fill(); }
      if (building.roof === "spire") { ctx.beginPath(); ctx.moveTo(x + w * .42, y); ctx.lineTo(x + w / 2, y - h * .34); ctx.lineTo(x + w * .58, y); ctx.closePath(); ctx.fill(); }
      if (building.roof === "dome") { ctx.beginPath(); ctx.arc(x + w / 2, y, w * .42, Math.PI, 0); ctx.fill(); }
      if (building.roof === "saw") for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * (i + .5) / 3, y - h * .1); ctx.lineTo(x + w * (i + 1) / 3, y); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (depth === 1) {
        const lit = timeOfDay === "night" || timeOfDay === "sunset";
        for (let row = 0; row < building.windowRows; row += 1) {
          for (let column = 0; column < building.windowColumns; column += 1) {
            const on = lit && ((row * 3 + column * 7 + building.tone) % 4 !== 0);
            ctx.fillStyle = on ? "rgba(253,224,71,.85)" : "rgba(148,163,184,.22)";
            const ww = w / (building.windowColumns * 2.4);
            const wh = h / (building.windowRows * 3.1);
            ctx.fillRect(x + w * (column + .6) / (building.windowColumns + .2), y + h * (row + .55) / (building.windowRows + .2), Math.max(1, ww), Math.max(1, wh));
          }
        }
      }
    });
  });

  // Ground.
  const ground = ctx.createLinearGradient(0, horizonY, 0, size.height);
  ground.addColorStop(0, shade(profile.ground, 1.18)); ground.addColorStop(1, shade(profile.ground, .78));
  ctx.fillStyle = ground; ctx.fillRect(0, horizonY, size.width, size.height - horizonY);

  // Water band with animated waves.
  if (plan.hasWater) {
    const waterTop = size.height * .24;
    const waterHeight = size.height * .14;
    const water = ctx.createLinearGradient(0, waterTop, 0, waterTop + waterHeight);
    water.addColorStop(0, "rgba(8,145,178,.85)"); water.addColorStop(1, "rgba(12,74,110,.92)");
    ctx.fillStyle = water; ctx.fillRect(0, waterTop, size.width, waterHeight);
    ctx.strokeStyle = "rgba(224,242,254,.5)"; ctx.lineWidth = 1;
    plan.waterWaves.forEach((wave) => {
      ctx.beginPath();
      for (let px = 0; px <= size.width; px += 8) {
        const y = size.height * wave.y + Math.sin(px / (wave.wavelength * size.width) * Math.PI * 2 + wave.phase + time * .8) * wave.amplitude;
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    });
  }

  // Vegetation.
  plan.vegetation.forEach((mark) => {
    const x = mark.x * size.width;
    const baseY = horizonY + size.height * .012;
    const height = size.height * .1 * mark.scale;
    if (mark.kind === "palm") {
      ctx.strokeStyle = "#854d0e"; ctx.lineWidth = Math.max(2, height * .07);
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x - height * .16, baseY - height * .6, x, baseY - height); ctx.stroke();
      ctx.strokeStyle = "#15803d"; ctx.lineWidth = Math.max(1.5, height * .05);
      for (let i = 0; i < 6; i += 1) { const a = Math.PI + (i / 5) * Math.PI; ctx.beginPath(); ctx.moveTo(x, baseY - height); ctx.quadraticCurveTo(x + Math.cos(a) * height * .28, baseY - height - Math.sin(a) * height * .2, x + Math.cos(a) * height * .5, baseY - height * .82); ctx.stroke(); }
    } else if (mark.kind === "conifer") {
      ctx.fillStyle = mark.variant % 2 ? "#14532d" : "#166534";
      for (let tier = 0; tier < 3; tier += 1) { const ty = baseY - height * (.25 + tier * .28); const tw = height * (.36 - tier * .08); ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - height * .34); ctx.lineTo(x + tw, ty); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = "#3f2a18"; ctx.fillRect(x - height * .04, baseY - height * .28, height * .08, height * .28);
    } else if (mark.kind === "scrub") {
      ctx.fillStyle = mark.variant % 2 ? "#4d7c0f" : "#65a30d"; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.ellipse(x, baseY, height * .22, height * .12, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    } else if (mark.kind === "broadleaf") {
      ctx.fillStyle = "#3f2a18"; ctx.fillRect(x - height * .04, baseY - height * .42, height * .08, height * .42);
      ctx.fillStyle = mark.variant % 2 ? "#166534" : "#15803d";
      [[0, .62, .3], [-.18, .5, .22], [.18, .5, .22]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + height * dx, baseY - height * dy, height * r, 0, Math.PI * 2); ctx.fill(); });
    }
  });

  // Road furniture along the kerb.
  plan.streetFurniture.forEach((item) => {
    const x = item.x * size.width;
    const baseY = horizonY + size.height * .035;
    ctx.strokeStyle = "#94a3b8"; ctx.fillStyle = "#475569"; ctx.lineWidth = 1.6;
    if (item.kind === "lamp") {
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - size.height * .075); ctx.lineTo(x + size.width * .012, baseY - size.height * .08); ctx.stroke();
      ctx.fillStyle = timeOfDay === "day" ? "#cbd5e1" : "rgba(253,224,71,.9)"; ctx.beginPath(); ctx.arc(x + size.width * .014, baseY - size.height * .079, 2.4, 0, Math.PI * 2); ctx.fill();
      if (timeOfDay !== "day") { ctx.globalAlpha = .16; ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(x + size.width * .014, baseY - size.height * .075, size.height * .045, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    } else if (item.kind === "sign") {
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - size.height * .05); ctx.stroke();
      ctx.fillStyle = environment.accent; ctx.fillRect(x - size.width * .009, baseY - size.height * .062, size.width * .018, size.height * .014);
    } else if (item.kind === "hydrant") {
      ctx.fillStyle = "#b91c1c"; ctx.fillRect(x - 2, baseY - 8, 4, 8); ctx.fillRect(x - 4, baseY - 6, 8, 2);
    } else if (item.kind === "bin") {
      ctx.fillStyle = "#334155"; ctx.fillRect(x - 3, baseY - 9, 6, 9); ctx.fillStyle = "#64748b"; ctx.fillRect(x - 4, baseY - 10, 8, 2);
    } else {
      ctx.fillStyle = "#facc15"; ctx.fillRect(x - 1.5, baseY - 7, 3, 7);
    }
  });

  // Background movers.
  if (!reducedMotion) {
    plan.movers.forEach((mover) => {
      const travel = (mover.phase + time * mover.speed) % 1;
      const x = (mover.direction === 1 ? travel : 1 - travel) * (size.width + 60) - 30;
      const y = mover.lane * size.height;
      ctx.save();
      if (mover.kind === "car") {
        ctx.fillStyle = ["#e11d48", "#0ea5e9", "#f8fafc", "#facc15"][mover.tone % 4];
        ctx.fillRect(x, y, 16, 5); ctx.fillRect(x + 4, y - 3, 8, 3);
        ctx.fillStyle = "#0f172a"; ctx.fillRect(x + 2, y + 5, 3, 2); ctx.fillRect(x + 11, y + 5, 3, 2);
      } else if (mover.kind === "boat") {
        ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y); ctx.lineTo(x + 17, y + 6); ctx.lineTo(x + 4, y + 6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#e2e8f0"; ctx.beginPath(); ctx.moveTo(x + 11, y); ctx.lineTo(x + 11, y - 12); ctx.stroke();
        ctx.fillStyle = "rgba(248,250,252,.8)"; ctx.beginPath(); ctx.moveTo(x + 11, y - 12); ctx.lineTo(x + 11, y - 1); ctx.lineTo(x + 20, y - 1); ctx.closePath(); ctx.fill();
      } else if (mover.kind === "plane") {
        ctx.fillStyle = "rgba(226,232,240,.85)"; ctx.fillRect(x, y, 14, 2); ctx.fillRect(x + 5, y - 3, 3, 8);
        ctx.strokeStyle = "rgba(226,232,240,.28)"; ctx.beginPath(); ctx.moveTo(x - 40 * mover.direction, y + 1); ctx.lineTo(x, y + 1); ctx.stroke();
      } else if (mover.kind === "train") {
        ctx.fillStyle = "#1f2937"; for (let car = 0; car < 4; car += 1) ctx.fillRect(x + car * 20, y - 6, 18, 7);
        ctx.fillStyle = "rgba(253,224,71,.7)"; for (let car = 0; car < 4; car += 1) ctx.fillRect(x + car * 20 + 3, y - 4, 12, 2);
      }
      ctx.restore();
    });
  }

  // Weather.
  if (atmosphere === "hazy" || atmosphere === "foggy") {
    const haze = ctx.createLinearGradient(0, 0, 0, size.height * .5);
    haze.addColorStop(0, atmosphere === "foggy" ? "rgba(226,232,240,.34)" : "rgba(251,191,36,.18)");
    haze.addColorStop(1, "rgba(226,232,240,.05)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, size.width, size.height * .5);
  }
  if (atmosphere === "cloudy") { ctx.fillStyle = "rgba(148,163,184,.16)"; ctx.fillRect(0, 0, size.width, size.height * .34); }
  if (atmosphere === "rainy") {
    ctx.fillStyle = "rgba(15,23,42,.22)"; ctx.fillRect(0, 0, size.width, size.height);
    if (!reducedMotion) {
      ctx.strokeStyle = "rgba(186,230,253,.35)"; ctx.lineWidth = 1;
      plan.particles.forEach((drop) => {
        const y = ((drop.y + time * drop.speed * .35) % 1) * size.height * .6;
        const x = ((drop.x + drop.drift * time * .05) % 1) * size.width;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - drop.length * size.width * .3, y + drop.length * size.height); ctx.stroke();
      });
    }
  }
  ctx.restore();
}

/** Multiplies a #rrggbb tone; keeps palettes coherent without extra assets. */
function shade(hex: string, factor: number): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => {
    const channel = Math.round(Math.min(255, parseInt(value.slice(offset, offset + 2), 16) * factor));
    return channel.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}


export function drawVenueArchitecture(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneDescriptor) {
  ctx.save(); const indoor = !["festival-field", "beachfront"].includes(scene.architecture);
  if (indoor) { ctx.fillStyle = scene.architecture === "brick-room" ? "rgba(69,26,3,.82)" : scene.architecture === "nightclub" ? "rgba(24,8,38,.86)" : "rgba(15,23,42,.84)"; ctx.fillRect(0, size.height * .09, size.width, size.height * .86); }
  if (scene.architecture === "proscenium") { ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 18; const s = rect(scene.stage, size); ctx.strokeRect(s.x - 8, s.y - 8, s.width + 16, s.height + 16); }
  if (scene.architecture === "arena-bowl" || scene.architecture === "stadium-stands") drawBowlShell(ctx, size, scene.architecture === "stadium-stands");
  ctx.restore();
}

/** Bowl shell: outer structure, stepped stand rings and a pitch-side barrier so the floor reads as a small island in a big room. */
function drawBowlShell(ctx: CanvasRenderingContext2D, size: Size, stadium: boolean) {
  const rings = stadium ? 5 : 4;
  const outer = { x: size.width * .008, y: size.height * .05, width: size.width * .984, height: size.height * .92 };
  ctx.fillStyle = stadium ? "#0b1220" : "#0d1526";
  ctx.fillRect(outer.x, outer.y, outer.width, outer.height);
  for (let index = 0; index < rings; index += 1) {
    const inset = (index + 1) / (rings + 1);
    const ringRect = {
      x: outer.x + outer.width * .045 * inset * rings * .5,
      y: outer.y + outer.height * .05 * inset * rings * .5,
      width: outer.width * (1 - .045 * inset * rings),
      height: outer.height * (1 - .05 * inset * rings),
    };
    ctx.strokeStyle = index % 2 ? "rgba(71,85,105,.85)" : "rgba(51,65,85,.85)";
    ctx.lineWidth = stadium ? 9 : 7;
    ctx.strokeRect(ringRect.x, ringRect.y, ringRect.width, ringRect.height);
  }
  if (stadium) {
    ctx.strokeStyle = "rgba(148,163,184,.35)"; ctx.lineWidth = 3;
    ctx.strokeRect(outer.x, outer.y, outer.width, outer.height);
    ctx.fillStyle = "rgba(2,6,23,.55)";
    ctx.fillRect(outer.x, outer.y, outer.width, size.height * .035);
  }
}

export function drawSceneDecorationsAndServices(
  ctx: CanvasRenderingContext2D,
  size: Size,
  scene: VenueSceneDescriptor,
  detailPlan: VenueDetailPlan,
) {
  ctx.save();
  scene.exteriorSlots.forEach((slot) => drawDecoration(ctx, size, slot));
  scene.decorations.forEach((slot) => drawDecoration(ctx, size, slot));
  const bars = scene.bars.length ? scene.bars.map((point) => point.bounds) : [scene.bar];
  const stands = scene.merchandiseStands.length ? scene.merchandiseStands.map((point) => point.bounds) : [scene.merchandise];
  bars.forEach((bounds) => drawServiceFixture(ctx, size, bounds, "BAR", detailPlan.services.bar));
  stands.forEach((bounds) => drawServiceFixture(ctx, size, bounds, "MERCH", detailPlan.services.merchandise));
  ctx.restore();
}

const PROP_ACCENTS = ["#f59e0b", "#22d3ee", "#f472b6", "#a3e635"] as const;
const SERVICE_PALETTES: Readonly<Record<VenueServiceDetail["theme"], { shell: string; trim: string; counter: string }>> = Object.freeze({
  wood: { shell: "#4a2a18", trim: "#d6a86a", counter: "#2b160d" },
  neon: { shell: "#21102e", trim: "#c026d3", counter: "#09090b" },
  heritage: { shell: "#3f1d24", trim: "#d4af37", counter: "#231217" },
  concourse: { shell: "#334155", trim: "#cbd5e1", counter: "#111827" },
  outdoor: { shell: "#713f12", trim: "#fef3c7", counter: "#422006" },
});

function drawDecoration(ctx: CanvasRenderingContext2D, size: Size, slot: DecorationSlot) {
  const r = rect(slot.bounds, size);
  const accent = PROP_ACCENTS[slot.style % PROP_ACCENTS.length];
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  ctx.save();
  ctx.lineWidth = Math.max(1, Math.min(2, r.width / 28));

  switch (slot.kind) {
    case "window": { ctx.fillStyle = "#bae6fd"; ctx.globalAlpha = .7; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.globalAlpha = 1; ctx.strokeStyle = "#e2e8f0"; ctx.strokeRect(r.x, r.y, r.width, r.height); ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx, r.y + r.height); ctx.moveTo(r.x, cy); ctx.lineTo(r.x + r.width, cy); ctx.stroke(); break; }
    case "toilet": { ctx.fillStyle = "#334155"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.max(7,r.width*.2)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("WC", cx, cy); break; }
    case "security": { ctx.fillStyle = "#eab308"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#111827"; ctx.fillRect(r.x+r.width*.15,r.y+r.height*.2,r.width*.7,r.height*.2); break; }
    case "curtain": { ctx.fillStyle = "#7f1d1d"; ctx.fillRect(r.x,r.y,r.width,r.height); ctx.strokeStyle="#f59e0b"; for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(r.x+r.width*i/8,r.y);ctx.lineTo(r.x+r.width*i/8,r.y+r.height);ctx.stroke();} break; }
    case "aisle": { ctx.fillStyle = "rgba(245,158,11,.32)"; ctx.fillRect(r.x,r.y,r.width,r.height); ctx.strokeStyle="#fbbf24"; ctx.setLineDash([4,4]); ctx.strokeRect(r.x,r.y,r.width,r.height); break; }
    case "table": {
      ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.ellipse(cx, r.y + r.height * .38, r.width * .34, r.height * .2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#451a03"; ctx.beginPath(); ctx.moveTo(cx, r.y + r.height * .48); ctx.lineTo(cx, r.y + r.height * .93); ctx.stroke();
      ctx.fillStyle = "#374151"; [r.x + r.width * .12, r.x + r.width * .88].forEach((x) => { ctx.beginPath(); ctx.arc(x, r.y + r.height * .68, Math.max(2, r.height * .14), 0, Math.PI * 2); ctx.fill(); });
      break;
    }
    case "poster": {
      ctx.fillStyle = "#111827"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeStyle = accent; ctx.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      ctx.fillStyle = accent; ctx.fillRect(r.x + r.width * .14, r.y + r.height * .14, r.width * .72, r.height * .18);
      ctx.strokeStyle = "#f8fafc"; ctx.beginPath(); ctx.moveTo(r.x + r.width * .18, r.y + r.height * .75); ctx.lineTo(r.x + r.width * .48, r.y + r.height * .42); ctx.lineTo(r.x + r.width * .82, r.y + r.height * .75); ctx.stroke();
      break;
    }
    case "booth": {
      ctx.fillStyle = slot.style % 2 ? "#4c1d95" : "#7f1d1d"; ctx.fillRect(r.x, r.y, r.width, r.height * .55); ctx.fillRect(r.x, r.y + r.height * .62, r.width, r.height * .28);
      ctx.strokeStyle = "rgba(255,255,255,.2)"; for (let x = 1; x < 4; x += 1) { const px = r.x + r.width * x / 4; ctx.beginPath(); ctx.moveTo(px, r.y); ctx.lineTo(px, r.y + r.height * .9); ctx.stroke(); }
      ctx.fillStyle = "#78350f"; ctx.fillRect(cx - r.width * .14, r.y + r.height * .48, r.width * .28, r.height * .42);
      break;
    }
    case "seat": {
      for (let index = 0; index < 4; index += 1) { const x = r.x + r.width * (.08 + index * .23); ctx.fillStyle = index % 2 ? "#991b1b" : "#7f1d1d"; ctx.fillRect(x, r.y + r.height * .18, r.width * .18, r.height * .45); ctx.fillRect(x - r.width * .02, r.y + r.height * .62, r.width * .22, r.height * .18); }
      break;
    }
    case "balcony": {
      ctx.fillStyle = "#1e293b"; ctx.fillRect(r.x, r.y + r.height * .58, r.width, r.height * .35); ctx.strokeStyle = "#cbd5e1"; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.height * .42); ctx.lineTo(r.x + r.width, r.y + r.height * .42); ctx.stroke();
      for (let index = 0; index <= 8; index += 1) { const x = r.x + r.width * index / 8; ctx.beginPath(); ctx.moveTo(x, r.y + r.height * .42); ctx.lineTo(x, r.y + r.height * .78); ctx.stroke(); }
      break;
    }
    case "screen": {
      ctx.fillStyle = "#020617"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeStyle = "#64748b"; ctx.strokeRect(r.x, r.y, r.width, r.height); ctx.fillStyle = accent; ctx.globalAlpha = .72; ctx.fillRect(r.x + 3, r.y + 3, r.width - 6, r.height - 6); ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,.16)"; for (let y = 5; y < r.height - 4; y += 4) ctx.fillRect(r.x + 3, r.y + y, r.width - 6, 1);
      break;
    }
    case "tier": {
      // Raked seating stand: stepped rows rise away from the pitch, with vomitory gaps.
      const vertical = r.height >= r.width;
      const steps = Math.max(4, Math.min(9, Math.round((vertical ? r.width : r.height) / 6) + 4));
      ctx.fillStyle = "rgba(15,23,42,.86)"; ctx.fillRect(r.x, r.y, r.width, r.height);
      for (let index = 0; index < steps; index += 1) {
        const t = index / steps;
        const next = (index + 1) / steps;
        ctx.fillStyle = index % 2 ? "#334155" : "#3f4b5f";
        if (vertical) {
          const x = r.x + r.width * t;
          ctx.fillRect(x, r.y + r.height * .02 * index, r.width * (next - t) * .92, r.height * (1 - .04 * index));
        } else {
          const y = r.y + r.height * t;
          ctx.fillRect(r.x + r.width * .02 * index, y, r.width * (1 - .04 * index), r.height * (next - t) * .92);
        }
      }
      ctx.fillStyle = "rgba(2,6,23,.85)";
      [.34, .68].forEach((gap) => {
        if (vertical) ctx.fillRect(r.x, r.y + r.height * gap, r.width, Math.max(1.5, r.height * .022));
        else ctx.fillRect(r.x + r.width * gap, r.y, Math.max(1.5, r.width * .022), r.height);
      });
      ctx.strokeStyle = "rgba(203,213,225,.35)"; ctx.strokeRect(r.x, r.y, r.width, r.height);
      break;
    }
    case "concourse": {
      // Walkway ring with kiosk shutters and stair markings.
      ctx.fillStyle = "#1f2937"; ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.fillStyle = "rgba(148,163,184,.28)"; ctx.fillRect(r.x, r.y, r.width, Math.max(1, r.height * .16));
      const along = Math.max(r.width, r.height);
      const kiosks = Math.max(3, Math.round(along / 46));
      for (let index = 0; index < kiosks; index += 1) {
        const t = (index + .5) / kiosks;
        ctx.fillStyle = index % 3 === 0 ? "#475569" : "#334155";
        if (r.width >= r.height) ctx.fillRect(r.x + r.width * t - r.width / (kiosks * 3), r.y + r.height * .3, r.width / (kiosks * 1.6), r.height * .6);
        else ctx.fillRect(r.x + r.width * .3, r.y + r.height * t - r.height / (kiosks * 3), r.width * .6, r.height / (kiosks * 1.6));
      }
      ctx.strokeStyle = "rgba(226,232,240,.22)"; ctx.setLineDash([5, 5]);
      if (r.width >= r.height) { ctx.beginPath(); ctx.moveTo(r.x, cy); ctx.lineTo(r.x + r.width, cy); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx, r.y + r.height); ctx.stroke(); }
      ctx.setLineDash([]);
      break;
    }
    case "tunnel": {
      ctx.fillStyle = "#0f172a"; ctx.fillRect(r.x, r.y + r.height * .25, r.width, r.height * .75); ctx.beginPath(); ctx.arc(cx, r.y + r.height * .28, r.width / 2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#020617"; ctx.fillRect(r.x + r.width * .2, r.y + r.height * .35, r.width * .6, r.height * .65); ctx.fillStyle = "#22c55e"; ctx.fillRect(cx - r.width * .18, r.y + r.height * .08, r.width * .36, Math.max(3, r.height * .1));
      break;
    }
    case "tent": {
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.height * .48); ctx.lineTo(cx, r.y); ctx.lineTo(r.x + r.width, r.y + r.height * .48); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(15,23,42,.82)"; ctx.fillRect(r.x + r.width * .08, r.y + r.height * .48, r.width * .84, r.height * .5); ctx.strokeStyle = "#e2e8f0"; [r.x + r.width * .08, cx, r.x + r.width * .92].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, r.y + r.height * .4); ctx.lineTo(x, r.y + r.height); ctx.stroke(); });
      break;
    }
    case "fence": {
      ctx.strokeStyle = "#d6b36a"; for (let index = 0; index < 6; index += 1) { const x = r.x + r.width * index / 5; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.height); ctx.stroke(); } [ .3, .7 ].forEach((y) => { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.height * y); ctx.lineTo(r.x + r.width, r.y + r.height * y); ctx.stroke(); });
      break;
    }
    case "generator": {
      ctx.fillStyle = "#ca8a04"; ctx.fillRect(r.x, r.y + r.height * .12, r.width, r.height * .7); ctx.strokeStyle = "#111827"; ctx.strokeRect(r.x, r.y + r.height * .12, r.width, r.height * .7);
      for (let index = 0; index < 4; index += 1) { ctx.beginPath(); ctx.moveTo(r.x + r.width * .12, r.y + r.height * (.25 + index * .1)); ctx.lineTo(r.x + r.width * .55, r.y + r.height * (.25 + index * .1)); ctx.stroke(); } [r.x + r.width * .18, r.x + r.width * .82].forEach((x) => { ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(x, r.y + r.height * .88, Math.max(2, r.height * .1), 0, Math.PI * 2); ctx.fill(); });
      break;
    }
    case "palm": {
      ctx.strokeStyle = "#854d0e"; ctx.lineWidth = Math.max(2, r.width * .08); ctx.beginPath(); ctx.moveTo(cx, r.y + r.height); ctx.quadraticCurveTo(cx - r.width * .08, cy, cx, r.y + r.height * .22); ctx.stroke();
      ctx.strokeStyle = "#166534"; ctx.lineWidth = Math.max(2, r.width * .05); for (let index = 0; index < 7; index += 1) { const angle = Math.PI * 2 * index / 7; ctx.beginPath(); ctx.moveTo(cx, r.y + r.height * .22); ctx.lineTo(cx + Math.cos(angle) * r.width * .45, r.y + r.height * .22 + Math.sin(angle) * r.height * .2); ctx.stroke(); }
      break;
    }
    case "promenade": {
      ctx.fillStyle = "#9a6a3a"; ctx.fillRect(r.x, r.y + r.height * .25, r.width, r.height * .7); ctx.strokeStyle = "#4a2a18"; for (let index = 0; index < 7; index += 1) { const x = r.x + r.width * index / 6; ctx.beginPath(); ctx.moveTo(x, r.y + r.height * .25); ctx.lineTo(x, r.y + r.height * .95); ctx.stroke(); }
      ctx.strokeStyle = "#e2e8f0"; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.height * .2); ctx.lineTo(r.x + r.width, r.y + r.height * .2); ctx.stroke();
      break;
    }
    case "water": {
      ctx.fillStyle = "rgba(14,165,233,.5)"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeStyle = "rgba(224,242,254,.7)"; for (let row = 1; row <= 3; row += 1) { ctx.beginPath(); for (let index = 0; index <= 6; index += 1) { const x = r.x + r.width * index / 6; const y = r.y + r.height * row / 4 + Math.sin(index + slot.style) * 2; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
      break;
    }
    case "speaker": {
      ctx.fillStyle = "#09090b"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeStyle = "#475569"; ctx.strokeRect(r.x, r.y, r.width, r.height); [ .3, .7 ].forEach((y) => { ctx.fillStyle = "#020617"; ctx.beginPath(); ctx.arc(cx, r.y + r.height * y, Math.max(2, Math.min(r.width * .3, r.height * .18)), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#334155"; ctx.stroke(); });
      break;
    }
    case "light": {
      ctx.globalAlpha = .2; ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, Math.max(r.width, r.height) * .55, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.fillRect(cx - r.width * .18, r.y + r.height * .12, r.width * .36, r.height * .32); ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, r.y + r.height * .5, Math.max(2, r.width * .12), 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawServiceFixture(
  ctx: CanvasRenderingContext2D,
  size: Size,
  bounds: VenueSceneDescriptor["bar"],
  label: "BAR" | "MERCH",
  detail: VenueServiceDetail,
) {
  const r = rect(bounds, size);
  const palette = SERVICE_PALETTES[detail.theme];
  const signHeight = Math.max(12, r.height * .17);
  ctx.save();
  ctx.fillStyle = palette.shell; ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.strokeStyle = palette.trim; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.width, r.height);

  if (detail.canopy) {
    ctx.fillStyle = detail.accent; ctx.beginPath(); ctx.moveTo(r.x, r.y + signHeight); ctx.lineTo(r.x + r.width * .5, r.y); ctx.lineTo(r.x + r.width, r.y + signHeight); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = detail.accent; ctx.globalAlpha = detail.signStyle === 0 ? .85 : .62; ctx.fillRect(r.x + 3, r.y + 3, r.width - 6, signHeight); ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = palette.trim; ctx.globalAlpha = .55;
  [ .36, .58 ].forEach((y) => { ctx.beginPath(); ctx.moveTo(r.x + r.width * .08, r.y + r.height * y); ctx.lineTo(r.x + r.width * .92, r.y + r.height * y); ctx.stroke(); });
  ctx.globalAlpha = 1;

  if (label === "BAR") drawBarStock(ctx, r, detail);
  else drawMerchandiseStock(ctx, r, detail);

  ctx.fillStyle = palette.counter; ctx.fillRect(r.x, r.y + r.height * .72, r.width, r.height * .28);
  ctx.fillStyle = palette.trim; ctx.fillRect(r.x, r.y + r.height * .7, r.width, Math.max(2, r.height * .035));
  ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.max(8, Math.min(11, signHeight * .62))}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, r.x + r.width / 2, r.y + signHeight * .62);
  ctx.restore();
}

function drawBarStock(ctx: CanvasRenderingContext2D, r: ReturnType<typeof rect>, detail: VenueServiceDetail) {
  const bottleTones = ["#38bdf8", "#f59e0b", "#22c55e", "#f472b6"] as const;
  detail.stock.forEach((stock) => {
    const x = r.x + stock.x * r.width; const y = r.y + stock.y * r.height;
    ctx.fillStyle = bottleTones[stock.variant % bottleTones.length]; ctx.fillRect(x - 1.5, y - 4, 3, 7); ctx.fillRect(x - .7, y - 6, 1.4, 2);
  });
  ctx.strokeStyle = "#cbd5e1"; for (let index = 0; index < 3; index += 1) { const x = r.x + r.width * (.4 + index * .1); ctx.beginPath(); ctx.moveTo(x, r.y + r.height * .63); ctx.lineTo(x, r.y + r.height * .7); ctx.lineTo(x + 3, r.y + r.height * .7); ctx.stroke(); }
}

function drawMerchandiseStock(ctx: CanvasRenderingContext2D, r: ReturnType<typeof rect>, detail: VenueServiceDetail) {
  const merchTones = ["#f8fafc", "#f472b6", "#60a5fa", "#facc15"] as const;
  detail.stock.forEach((stock, index) => {
    const x = r.x + stock.x * r.width; const y = r.y + stock.y * r.height;
    ctx.fillStyle = merchTones[stock.variant % merchTones.length];
    if (index % 3 === 0) { ctx.fillRect(x - 3, y - 4, 6, 8); ctx.fillStyle = "rgba(15,23,42,.55)"; ctx.fillRect(x - 1, y - 1, 2, 3); }
    else { ctx.fillRect(x - 3, y - 2, 6, 5); ctx.fillRect(x - 5, y - 1, 2, 3); ctx.fillRect(x + 3, y - 1, 2, 3); }
  });
}
