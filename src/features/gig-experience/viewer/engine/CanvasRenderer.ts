import type { GigViewerReplay } from "../../events/types";
import type { GigExperienceDTO } from "../../types";
import type { DerivedPlaybackState } from "./PlaybackController";
import { reconstructCrowdState, type CrowdLayoutPlan } from "./CrowdLifecycle";
import { buildTunedCrowdPlan, type CrowdTuningOptions } from "./CrowdTuning";
import { buildEntityLayout, type EntityLayout } from "./EntityLayout";
import { buildPerformerPlan, reconstructPerformerState, type PerformerPlan } from "./PerformerLifecycle";
import { buildStoryModel, deriveStorySnapshot, type StoryModel } from "./StoryEngine";
import type { Size } from "./Viewport";
import { selectVenuePreset, scaleVenuePreset, selectStageType } from "./VenueLayout";
import type { VenuePreset } from "./VenueLayout";
import { generateVenueScene, type DecorationSlot, type VenueSceneLayout } from "./VenueSceneRegistry";
import { buildPyroPlan, drawPyrotechnics, type PyroPlan } from "./Pyrotechnics";
import { buildAudienceActivityPlan, drawAudienceActivity, type AudienceActivityPlan } from "./AudienceActivity";
import { drawVenueShell, drawBackground, drawFloor, drawStage, drawBarrier, drawAtmosphere, drawStageExtras, drawFOHAndSecurity, drawFollowSpots } from "./StageDecor";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private size: Size = { width: 1, height: 1 };
  private dpr = 1;
  private layout: EntityLayout | null = null;
  private crowdPlan: CrowdLayoutPlan | null = null;
  private performerPlan: PerformerPlan | null = null;
  private storyModel: StoryModel;
  private lastFrameMs = 0;
  private pyroPlan: PyroPlan | null = null;
  private audiencePlan: AudienceActivityPlan | null = null;
  private preset: VenuePreset | null = null;
  private readonly venueScene: VenueSceneLayout;

  constructor(
    private canvas: HTMLCanvasElement,
    private replay: GigViewerReplay,
    private experience: GigExperienceDTO | null,
    private reducedMotion: boolean,
    private options: {
      pyrotechnics?: boolean;
      pyroIntensity?: number;
      crowdTuning?: Partial<CrowdTuningOptions> | null;
    } = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    this.ctx = ctx;
    this.venueScene = generateVenueScene({ gigId: experience?.gig.id ?? replay.id, venueId: experience?.gig.venue.id, venueName: experience?.gig.venue.name, venueType: experience?.gig.venue.type, capacity: experience?.gig.venue.capacity });
    this.storyModel = buildStoryModel(replay, experience);
    this.pyroPlan = this.options.pyrotechnics === false ? null : buildPyroPlan({
      story: this.storyModel,
      stageType: selectStageType({ venueName: experience?.gig?.venue?.name ?? null, venueType: (experience?.gig?.venue as any)?.type ?? null, capacity: experience?.gig?.venue?.capacity ?? null }),
      seed: (replay as any).simulationSeed ?? replay.id,
      intensity: this.options.pyroIntensity ?? 1,
    });
  }

  resize(size: Size) {
    this.size = { width: Math.max(280, size.width), height: Math.max(220, size.height) };
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(this.size.width * this.dpr);
    this.canvas.height = Math.floor(this.size.height * this.dpr);
    this.canvas.style.width = `${this.size.width}px`;
    this.canvas.style.height = `${this.size.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scaledPreset = scaleVenuePreset(selectVenuePreset({
      capacity: this.experience?.gig?.venue?.capacity,
      venueName: this.experience?.gig?.venue?.name,
      venueType: (this.experience?.gig?.venue as any)?.type ?? null,
      variantSeed: this.venueScene.seed,
    }), this.size);
    this.preset = scaledPreset;
    this.layout = buildEntityLayout({ replay: this.replay, experience: this.experience, size: this.size, reducedMotion: this.reducedMotion });
    this.crowdPlan = buildTunedCrowdPlan({
      replay: this.replay,
      attendance: this.layout.attendance,
      capacity: this.layout.capacity,
      size: this.size,
      preset: scaledPreset,
      reducedMotion: this.reducedMotion,
      devicePixelRatio: this.dpr,
      tuning: this.options.crowdTuning,
    });
    this.performerPlan = buildPerformerPlan({ replay: this.replay, experience: this.experience, size: this.size });
    this.audiencePlan = buildAudienceActivityPlan({ preset: scaledPreset, seed: (this.replay as any).simulationSeed ?? this.replay.id, attendanceRatio: this.layout.capacity > 0 ? this.layout.attendance / this.layout.capacity : 0.6, reducedMotion: this.reducedMotion });
  }

  render(state: DerivedPlaybackState) {
    const start = performance.now();
    const ctx = this.ctx;
    const size = this.size;
    if (!this.layout || !this.crowdPlan || !this.performerPlan) this.resize(size);
    const preset = this.preset ?? scaleVenuePreset(selectVenuePreset({ capacity: this.experience?.gig.venue.capacity }), size);
    const crowd = this.crowdPlan ? reconstructCrowdState(this.crowdPlan, state.positionMs, this.reducedMotion) : null;
    const performers = this.performerPlan ? reconstructPerformerState(this.performerPlan, this.replay, state.positionMs, { reducedMotion: this.reducedMotion }) : [];
    const storySnapshot = deriveStorySnapshot(this.storyModel, state.positionMs, this.reducedMotion);

    ctx.clearRect(0, 0, size.width, size.height);
    drawBackground(ctx, preset, size);
    drawVenueShell(ctx, preset, size);
    drawFloor(ctx, preset);
    // Future concessions and navigation live on their own layer, behind active entities.
    drawVenueSurroundings(ctx, size, this.venueScene);
    if (crowd && preset.crowdZones.length > 1) {
      ctx.globalAlpha = .14 + crowd.fillProgress * .14;
      ctx.fillStyle = preset.decorations.palette.accent;
      preset.crowdZones.forEach((z, i) => { if (crowd.occupiedZones.some((id) => id.startsWith(i === 0 ? "front" : "middle"))) ctx.fillRect(z.x, z.y, z.width, z.height); });
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#111827";
    preset.entrances.forEach((p) => { ctx.fillRect(p.x - 12, p.y - 8, 24, 16); });
    drawFOHAndSecurity(ctx, preset);
    drawStage(ctx, preset, state.positionMs, this.reducedMotion, storySnapshot.crowdEnergy);
    drawStageExtras(ctx, preset, state.positionMs, this.reducedMotion, storySnapshot.crowdEnergy);
    drawFollowSpots(ctx, preset, state.positionMs, this.reducedMotion, storySnapshot.crowdEnergy);
    drawBarrier(ctx, preset);
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath(); ctx.arc(preset.backstage.x, preset.backstage.y, 10, 0, Math.PI * 2); ctx.fill();

    (crowd?.entities ?? []).forEach((c, i) => {
      if (!c.visible && c.state !== "queued") return;
      if (!c.visible && i % 7 !== 0) return;
      const alpha = c.state === "queued" ? .22 : c.state === "entering" ? .58 : c.state === "settling" ? .72 : .82;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.state === "queued" ? "#cbd5e1" : i % 3 === 0 ? "#60a5fa" : i % 3 === 1 ? "#a78bfa" : "#f472b6";
      const zoneAmp = c.targetZoneId?.startsWith("front") ? 1.15 : c.targetZoneId?.startsWith("rear") ? .55 : .85;
      const activity = this.reducedMotion ? 0 : (storySnapshot.reaction === "still" ? 0 : storySnapshot.reaction === "sway" ? 1.2 : storySnapshot.reaction === "bounce" ? 2.2 : storySnapshot.reaction === "jump" ? 3.6 : storySnapshot.reaction === "wave" ? 2.8 : storySnapshot.reaction === "cheer_pulse" ? 4 : storySnapshot.reaction === "disappointed_settling" ? .7 : 0) * zoneAmp;
      const ry = c.y - Math.abs(Math.sin(state.positionMs / 180 + i)) * activity;
      const radius = c.radius + (storySnapshot.reaction === "cheer_pulse" && !this.reducedMotion ? Math.sin(state.positionMs / 120 + i) * .6 : 0);
      ctx.beginPath();
      if (c.state === "entering" || c.state === "moving_to_zone") ctx.rect(c.x - radius, ry - radius, radius * 2, radius * 2); else ctx.arc(c.x, ry, Math.max(1, radius), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    performers.forEach((p) => {
      if (!p.visible) return;
      const focus = state.performerFocusId === p.id || storySnapshot.performerFocusId === p.id || p.activeMoveEventId === state.activeEvent?.id;
      ctx.fillStyle = p.lifecycleState === "waiting_backstage" ? "#cbd5e1" : p.lifecycleState === "exiting" ? "#fca5a5" : "#f8fafc";
      ctx.strokeStyle = focus ? "#fde047" : "#111827";
      ctx.lineWidth = focus ? 4 : 2;
      ctx.beginPath(); ctx.arc(p.currentPosition.x, p.currentPosition.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#111827"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.initials, p.currentPosition.x, p.currentPosition.y - 3);
      ctx.font = "bold 8px sans-serif"; ctx.fillText(p.label, p.currentPosition.x, p.currentPosition.y + 8);
    });

    if (this.audiencePlan) drawAudienceActivity(ctx, this.audiencePlan, { positionMs: state.positionMs, energy: storySnapshot.crowdEnergy, reducedMotion: this.reducedMotion });
    drawAtmosphere(ctx, preset, size, storySnapshot.crowdEnergy, state.positionMs, this.reducedMotion);
    drawPyrotechnics(ctx, preset, size, { plan: this.pyroPlan, positionMs: state.positionMs, reducedMotion: this.reducedMotion, crowdEnergy: storySnapshot.crowdEnergy });

    if (state.activeEvent?.visualPayload.type === "spotlight" || state.activeEvent?.visualPayload.type === "moment_effect") {
      ctx.strokeStyle = "rgba(250, 204, 21, .75)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(size.width / 2, preset.stage.y + preset.stage.height / 2, 48 + (this.reducedMotion ? 0 : Math.sin(state.positionMs / 180) * 8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(15,23,42,.78)"; ctx.fillRect(preset.labelSafe.x, preset.labelSafe.y, preset.labelSafe.width, preset.labelSafe.height);
    ctx.fillStyle = "#f8fafc"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`${label(state.activePhase)}${state.currentSongTitle ? ` · ${state.currentSongTitle}` : ""}`, preset.labelSafe.x + 10, preset.labelSafe.y + 20);
    if (crowd) {
      ctx.font = "12px sans-serif"; ctx.fillText(`${crowd.phaseLabel} ${Math.round(crowd.fillProgress * 100)}%`, preset.labelSafe.x + 10, preset.labelSafe.y + 42);
      if (import.meta.env.DEV) { this.lastFrameMs = performance.now() - start; ctx.textAlign = "right"; ctx.fillText(`${crowd.diagnostics.entityCount} crowd · ${performers.filter((p) => p.visible).length} performers · ${this.lastFrameMs.toFixed(1)}ms`, preset.labelSafe.x + preset.labelSafe.width - 10, preset.labelSafe.y + 42); }
    }
    if (storySnapshot.finaleActive && !this.reducedMotion && storySnapshot.crowdEnergy >= 85) { ctx.globalAlpha = .75; ctx.fillStyle = "#facc15"; for (let i = 0; i < 20; i++) ctx.fillRect((i * 37 + state.positionMs / 20) % size.width, 30 + (i % 5) * 20, 3, 8); ctx.globalAlpha = 1; }
    if (state.activeEvent?.visualPayload.type === "result_reveal") {
      ctx.fillStyle = "rgba(22, 163, 74,.86)"; ctx.fillRect(size.width * .25, size.height * .42, size.width * .5, 52); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 18px sans-serif"; ctx.fillText("Result ready", size.width / 2, size.height * .42 + 31);
    }
  }

  destroy() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}

function label(phase: string) { return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function drawVenueSurroundings(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneLayout) {
  const rect = (zone: { x: number; y: number; width: number; height: number }) => ({ x: zone.x * size.width, y: zone.y * size.height, width: zone.width * size.width, height: zone.height * size.height });
  ctx.save();
  drawArchitecture(ctx, size, scene);
  for (const service of [{ name: "BAR", bounds: scene.bar, colour: "#78350f" }, { name: "MERCH", bounds: scene.merchandise, colour: "#312e81" }]) {
    const zone = rect(service.bounds); ctx.fillStyle = service.colour; ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "700 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(service.name, zone.x + zone.width / 2, zone.y + 19);
    ctx.fillStyle = "rgba(255,255,255,.18)"; for (let index = 0; index < 4; index += 1) ctx.fillRect(zone.x + 8 + index * Math.max(10, (zone.width - 20) / 4), zone.y + zone.height - 13, 7, 7);
  }
  scene.decorations.forEach((slot) => drawDecoration(ctx, rect(slot.bounds), slot));
  ctx.restore();
}

function drawArchitecture(ctx: CanvasRenderingContext2D, size: Size, scene: VenueSceneLayout) {
  ctx.globalAlpha = .7;
  if (scene.architecture === "brick-room") { ctx.fillStyle = "#451a03"; ctx.fillRect(0, size.height * .08, size.width, size.height * .38); ctx.strokeStyle = "#92400e"; for (let y = 80; y < size.height * .44; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.width, y); ctx.stroke(); } }
  if (scene.architecture === "nightclub") { ctx.fillStyle = "#17052b"; ctx.fillRect(0, 0, size.width, size.height * .48); ctx.strokeStyle = "#d946ef"; ctx.lineWidth = 3; ctx.strokeRect(size.width * .08, size.height * .1, size.width * .84, size.height * .28); }
  if (scene.architecture === "proscenium") { ctx.fillStyle = "#4c0519"; ctx.fillRect(0, 0, size.width, size.height * .48); ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 8; ctx.strokeRect(size.width * .14, size.height * .08, size.width * .72, size.height * .4); }
  if (scene.architecture === "arena-bowl" || scene.architecture === "stadium-stands") { ctx.strokeStyle = scene.architecture === "stadium-stands" ? "#64748b" : "#475569"; for (let tier = 0; tier < 3; tier += 1) { ctx.lineWidth = 12; ctx.strokeRect(8 + tier * 18, 8 + tier * 13, size.width - 16 - tier * 36, size.height * .76 - tier * 18); } }
  if (scene.architecture === "festival-field") { ctx.fillStyle = "#14532d"; ctx.fillRect(0, size.height * .42, size.width, size.height * .58); ctx.strokeStyle = "#cbd5e1"; ctx.setLineDash([10, 7]); ctx.strokeRect(size.width * .02, size.height * .08, size.width * .96, size.height * .84); ctx.setLineDash([]); }
  if (scene.architecture === "beachfront") { ctx.fillStyle = "#0369a1"; ctx.fillRect(0, size.height * .05, size.width, size.height * .15); ctx.fillStyle = "#fbbf24"; ctx.fillRect(0, size.height * .42, size.width, size.height * .58); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(0, size.height * .19, size.width, 5); }
  ctx.globalAlpha = 1;
}

function drawDecoration(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, slot: DecorationSlot) {
  const colours = ["#f59e0b", "#06b6d4", "#ec4899", "#84cc16"]; ctx.fillStyle = colours[slot.style % colours.length]; ctx.globalAlpha = .65;
  if (["table", "booth", "seat", "tier", "balcony", "screen", "tunnel"].includes(slot.kind)) ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  else if (slot.kind === "palm") { ctx.fillRect(bounds.x + bounds.width / 2, bounds.y, 3, bounds.height); ctx.beginPath(); ctx.arc(bounds.x + bounds.width / 2, bounds.y, bounds.width / 3, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 4; ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height); }
  ctx.globalAlpha = 1;
}
