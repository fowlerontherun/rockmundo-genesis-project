import type { ResolvedEnvironment } from "./EnvironmentRegistry";
import type { VenueDetailPlan, VenueServiceDetail } from "./VenueDetailPlan";
import type { DecorationSlot, VenueSceneDescriptor } from "./VenueSceneRegistry";
import type { Size } from "./Viewport";

export const SCENE_LAYER_ORDER = ["environment", "architecture", "background-decorations", "stage-band", "crowd", "venue-activity", "foreground-effects", "viewer-interface"] as const;
const rect = (r: { x: number; y: number; width: number; height: number }, s: Size) => ({ x: r.x * s.width, y: r.y * s.height, width: r.width * s.width, height: r.height * s.height });

export function drawExteriorEnvironment(ctx: CanvasRenderingContext2D, size: Size, environment: ResolvedEnvironment, reducedMotion: boolean) {
  const { profile, timeOfDay, atmosphere, variation } = environment;
  ctx.save();
  ctx.fillStyle = timeOfDay === "night" ? "#08111f" : timeOfDay === "sunset" ? "#9a3412" : profile.horizon; ctx.fillRect(0, 0, size.width, size.height * .42);
  ctx.fillStyle = profile.ground; ctx.fillRect(0, size.height * .31, size.width, size.height * .69);
  if (profile.features.includes("water")) { ctx.fillStyle = "rgba(14,165,233,.58)"; ctx.fillRect(0, size.height * .25, size.width, size.height * .13); }
  if (profile.features.includes("mountains")) { ctx.fillStyle = profile.silhouette; for (let i = 0; i < 7; i++) { const x = (i - 1) * size.width / 5; ctx.beginPath(); ctx.moveTo(x, size.height * .3); ctx.lineTo(x + size.width / 8, size.height * (.1 + ((i + variation) % 3) * .035)); ctx.lineTo(x + size.width / 4, size.height * .3); ctx.fill(); } }
  if (profile.features.includes("buildings") || profile.features.includes("brick") || profile.features.includes("roofs")) for (let i = 0; i < 12; i++) { const w = size.width / 14; const h = size.height * (.07 + ((i * 3 + variation) % 5) * .025); ctx.fillStyle = profile.features.includes("brick") ? (i % 2 ? "#451a03" : "#7c2d12") : profile.silhouette; ctx.fillRect(i * size.width / 11 - w / 2, size.height * .31 - h, w, h); if (timeOfDay === "night" && i % 2 === 0) { ctx.fillStyle = environment.accent; ctx.globalAlpha = .55; ctx.fillRect(i * size.width / 11, size.height * .27 - h / 2, 3, 3); ctx.globalAlpha = 1; } }
  if (profile.features.includes("trees") || profile.features.includes("palms")) for (let i = 0; i < 8; i++) { const x = (i + .5) * size.width / 8; ctx.strokeStyle = "#3f2a18"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, size.height * .33); ctx.lineTo(x, size.height * .24); ctx.stroke(); ctx.fillStyle = profile.silhouette; ctx.beginPath(); ctx.arc(x, size.height * .22, profile.features.includes("palms") ? 11 : 15, 0, Math.PI * 2); ctx.fill(); }
  if (profile.features.includes("rocks")) { ctx.fillStyle = profile.silhouette; for (let i = 0; i < 6; i++) ctx.fillRect(i * size.width / 5, size.height * (.23 + (i % 2) * .03), size.width * .12, size.height * .08); }
  if (atmosphere !== "clear") { ctx.fillStyle = atmosphere === "rainy" ? "rgba(30,41,59,.18)" : "rgba(226,232,240,.12)"; ctx.fillRect(0, 0, size.width, size.height); if (atmosphere === "rainy" && !reducedMotion) { ctx.strokeStyle = "rgba(186,230,253,.25)"; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(i * size.width / 17, 10); ctx.lineTo(i * size.width / 17 - 8, 28); ctx.stroke(); } } }
  ctx.restore();
}

export function drawVenueArchitecture(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneDescriptor) {
  ctx.save(); const indoor = !["festival-field", "beachfront"].includes(scene.architecture);
  if (indoor) { ctx.fillStyle = scene.architecture === "brick-room" ? "rgba(69,26,3,.82)" : scene.architecture === "nightclub" ? "rgba(24,8,38,.86)" : "rgba(15,23,42,.84)"; ctx.fillRect(0, size.height * .09, size.width, size.height * .86); }
  if (scene.architecture === "proscenium") { ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 18; const s = rect(scene.stage, size); ctx.strokeRect(s.x - 8, s.y - 8, s.width + 16, s.height + 16); }
  if (scene.architecture === "arena-bowl" || scene.architecture === "stadium-stands") { ctx.strokeStyle = scene.architecture === "stadium-stands" ? "#475569" : "#334155"; ctx.lineWidth = scene.architecture === "stadium-stands" ? 38 : 26; ctx.strokeRect(18, 25, size.width - 36, size.height - 50); }
  ctx.restore();
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
  drawServiceFixture(ctx, size, scene.bar, "BAR", detailPlan.services.bar);
  drawServiceFixture(ctx, size, scene.merchandise, "MERCH", detailPlan.services.merchandise);
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
      for (let index = 0; index < 4; index += 1) { ctx.fillStyle = index % 2 ? "#334155" : "#475569"; ctx.fillRect(r.x + index * r.width * .06, r.y + index * r.height * .2, r.width - index * r.width * .12, r.height * .18); }
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
