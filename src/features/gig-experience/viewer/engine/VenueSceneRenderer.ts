import type { ResolvedEnvironment } from "./EnvironmentRegistry";
import type { VenueSceneLayout } from "./VenueSceneRegistry";
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

export function drawVenueArchitecture(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneLayout) {
  ctx.save(); const indoor = !["festival-field", "beachfront"].includes(scene.architecture);
  if (indoor) { ctx.fillStyle = scene.architecture === "brick-room" ? "rgba(69,26,3,.82)" : scene.architecture === "nightclub" ? "rgba(24,8,38,.86)" : "rgba(15,23,42,.84)"; ctx.fillRect(0, size.height * .09, size.width, size.height * .86); }
  if (scene.architecture === "proscenium") { ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 18; const s = rect(scene.stage, size); ctx.strokeRect(s.x - 8, s.y - 8, s.width + 16, s.height + 16); }
  if (scene.architecture === "arena-bowl" || scene.architecture === "stadium-stands") { ctx.strokeStyle = scene.architecture === "stadium-stands" ? "#475569" : "#334155"; ctx.lineWidth = scene.architecture === "stadium-stands" ? 38 : 26; ctx.strokeRect(18, 25, size.width - 36, size.height - 50); }
  ctx.restore();
}

export function drawSceneDecorationsAndServices(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneLayout) {
  ctx.save();
  scene.decorations.forEach((slot) => { const r = rect(slot.bounds, size); ctx.fillStyle = slot.kind === "poster" ? "#f59e0b" : slot.kind === "palm" ? "#166534" : "#334155"; ctx.fillRect(r.x, r.y, Math.max(4, r.width), Math.max(4, r.height)); });
  for (const [name, bounds] of [["BAR", scene.bar], ["MERCH", scene.merchandise]] as const) { const r = rect(bounds, size); ctx.fillStyle = name === "BAR" ? "#164e63" : "#7c2d12"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeStyle = "#cbd5e1"; ctx.strokeRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "white"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(name, r.x + r.width / 2, r.y + 14); }
  ctx.restore();
}
