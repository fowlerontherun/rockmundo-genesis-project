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
import { generateVenueScene, type VenueSceneLayout } from "./VenueSceneRegistry";
import { buildPyroPlan, drawPyrotechnics, type PyroPlan } from "./Pyrotechnics";
import { buildAudienceActivityPlan, drawAudienceActivity, type AudienceActivityPlan } from "./AudienceActivity";
import { buildVenueActivityPlan, deriveVenueActivity, type VenueActivityPlan } from "./VenueActivity";
import { representativeCrowdCount } from "./RepresentativeCrowd";
import { resolveEnvironment, type ResolvedEnvironment } from "./EnvironmentRegistry";
import { drawExteriorEnvironment, drawSceneDecorationsAndServices, drawVenueArchitecture } from "./VenueSceneRenderer";
import { drawVenueShell, drawBackground, drawFloor, drawStage, drawBarrier, drawAtmosphere, drawStageExtras, drawFOHAndSecurity, drawFollowSpots } from "./StageDecor";
import { derivePerformanceItemActivity, drawPerformanceItemActivity } from "./PerformanceItemActivity";
import { applyCameraTransform, deriveCameraFrame } from "./CameraDirector";

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
  private readonly venueActivityPlan: VenueActivityPlan;
  private readonly environment: ResolvedEnvironment;

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
    const venue = experience?.gig.venue as (GigExperienceDTO["gig"]["venue"] & { environment?: string | null; city?: string | null; country?: string | null }) | undefined;
    this.environment = resolveEnvironment({ gigId: experience?.gig.id ?? replay.gigId, environment: venue?.environment, eventType: venue?.type, venueArchetype: this.venueScene.archetype, city: venue?.city ?? venue?.location, country: venue?.country, scheduledDate: experience?.gig.scheduledDate });
    this.storyModel = buildStoryModel(replay, experience);
    const attendance = metricNumber(experience?.headline.attendance) || metricNumber(experience?.headline.capacity);
    const displayedCrowd = representativeCrowdCount({ attendance, capacity: experience?.gig.venue.capacity, archetype: this.venueScene.archetype });
    this.venueActivityPlan = buildVenueActivityPlan({ replay, story: this.storyModel, scene: this.venueScene, displayedCrowd });
    this.pyroPlan = this.options.pyrotechnics === false ? null : buildPyroPlan({
      story: this.storyModel,
      stageType: selectStageType({ venueName: experience?.gig?.venue?.name ?? null, venueType: experience?.gig?.venue?.type ?? null, capacity: experience?.gig?.venue?.capacity ?? null }),
      seed: replay.simulationSeed ?? replay.id,
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
    const selectedPreset = selectVenuePreset({
      capacity: this.experience?.gig?.venue?.capacity,
      venueName: this.experience?.gig?.venue?.name,
      venueType: this.experience?.gig?.venue?.type ?? null,
      variantSeed: this.venueScene.seed,
    });
    const crowdBounds = unionRects(this.venueScene.crowdZones);
    const scaledPreset = scaleVenuePreset({ ...selectedPreset, stage: this.venueScene.stage, audience: crowdBounds, crowdZones: this.venueScene.crowdZones, entrances: this.venueScene.entrances, performerSlots: this.venueScene.bandPositions, barriers: [{ x: this.venueScene.stage.x, y: this.venueScene.stage.y + this.venueScene.stage.height + .012, width: this.venueScene.stage.width, height: .018 }] }, this.size);
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
    this.audiencePlan = buildAudienceActivityPlan({ preset: scaledPreset, seed: this.replay.simulationSeed ?? this.replay.id, attendanceRatio: this.layout.capacity > 0 ? this.layout.attendance / this.layout.capacity : 0.6, reducedMotion: this.reducedMotion });
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
    const activePayload = state.activeEvent?.visualPayload;
    const itemPerformer = activePayload?.type === "performance_item"
      ? performers.find((performer) => performer.id === activePayload.performerId)
      : null;
    const performanceItemFrame = derivePerformanceItemActivity(
      state.activeEvent,
      state.positionMs,
      preset.stage,
      preset.audience,
      this.reducedMotion,
      itemPerformer?.stageSlot,
    );
    const cameraFrame = deriveCameraFrame({
      event: state.activeEvent,
      positionMs: state.positionMs,
      viewport: size,
      stage: preset.stage,
      audience: preset.audience,
      performers: performers.map((performer) => ({
        id: performer.id,
        profileId: performer.profileId,
        position: performer.currentPosition,
        visible: performer.visible,
      })),
      performanceItemFocus:
        performanceItemFrame?.performerPosition ?? performanceItemFrame?.focus,
      reducedMotion: this.reducedMotion,
    });

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.save();
    applyCameraTransform(ctx, cameraFrame.camera, size);
    drawBackground(ctx, preset, size);
    drawExteriorEnvironment(ctx, size, this.environment, this.reducedMotion);
    drawVenueArchitecture(ctx, size, this.venueScene);
    drawVenueShell(ctx, preset, size);
    drawFloor(ctx, preset);
    drawSceneDecorationsAndServices(ctx, size, this.venueScene);
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

    drawVenueActivity(ctx, size, this.venueActivityPlan, state.positionMs, this.reducedMotion);

    performers.forEach((p) => {
      if (!p.visible) return;
      if (performanceItemFrame?.hideStagePerformer && performanceItemFrame.performerId === p.id) return;
      const focus = state.performerFocusId === p.id || storySnapshot.performerFocusId === p.id || p.activeMoveEventId === state.activeEvent?.id;
      ctx.fillStyle = p.lifecycleState === "waiting_backstage" ? "#cbd5e1" : p.lifecycleState === "exiting" ? "#fca5a5" : "#f8fafc";
      ctx.strokeStyle = focus ? "#fde047" : "#111827";
      ctx.lineWidth = focus ? 4 : 2;
      ctx.beginPath(); ctx.arc(p.currentPosition.x, p.currentPosition.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#111827"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.initials, p.currentPosition.x, p.currentPosition.y - 3);
      ctx.font = "bold 8px sans-serif"; ctx.fillText(p.label, p.currentPosition.x, p.currentPosition.y + 8);
    });

    if (this.audiencePlan) drawAudienceActivity(ctx, this.audiencePlan, { positionMs: state.positionMs, energy: storySnapshot.crowdEnergy, reducedMotion: this.reducedMotion });
    drawPerformanceItemActivity(ctx, performanceItemFrame, preset.stage, preset.audience, this.reducedMotion, itemPerformer?.initials ?? "★");
    drawAtmosphere(ctx, preset, size, storySnapshot.crowdEnergy, state.positionMs, this.reducedMotion);
    drawPyrotechnics(ctx, preset, size, { plan: this.pyroPlan, positionMs: state.positionMs, reducedMotion: this.reducedMotion, crowdEnergy: storySnapshot.crowdEnergy });

    if (state.activeEvent?.visualPayload.type === "spotlight" || state.activeEvent?.visualPayload.type === "moment_effect") {
      ctx.strokeStyle = "rgba(250, 204, 21, .75)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(size.width / 2, preset.stage.y + preset.stage.height / 2, 48 + (this.reducedMotion ? 0 : Math.sin(state.positionMs / 180) * 8), 0, Math.PI * 2); ctx.stroke();
    }
    if (storySnapshot.finaleActive && !this.reducedMotion && storySnapshot.crowdEnergy >= 85) { ctx.globalAlpha = .75; ctx.fillStyle = "#facc15"; for (let i = 0; i < 20; i++) ctx.fillRect((i * 37 + state.positionMs / 20) % size.width, 30 + (i % 5) * 20, 3, 8); ctx.globalAlpha = 1; }
    ctx.restore();

    ctx.fillStyle = "rgba(15,23,42,.78)"; ctx.fillRect(preset.labelSafe.x, preset.labelSafe.y, preset.labelSafe.width, preset.labelSafe.height);
    ctx.fillStyle = "#f8fafc"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`${label(state.activePhase)}${state.currentSongTitle ? ` · ${state.currentSongTitle}` : ""}`, preset.labelSafe.x + 10, preset.labelSafe.y + 20);
    if (crowd) {
      ctx.font = "12px sans-serif"; ctx.fillText(`${crowd.phaseLabel} ${Math.round(crowd.fillProgress * 100)}%`, preset.labelSafe.x + 10, preset.labelSafe.y + 42);
      if (import.meta.env.DEV) { this.lastFrameMs = performance.now() - start; ctx.textAlign = "right"; ctx.fillText(`${crowd.diagnostics.entityCount} crowd · ${performers.filter((p) => p.visible).length} performers · ${this.lastFrameMs.toFixed(1)}ms`, preset.labelSafe.x + preset.labelSafe.width - 10, preset.labelSafe.y + 42); }
    }
    if (state.activeEvent?.visualPayload.type === "result_reveal") {
      ctx.fillStyle = "rgba(22, 163, 74,.86)"; ctx.fillRect(size.width * .25, size.height * .42, size.width * .5, 52); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 18px sans-serif"; ctx.fillText("Result ready", size.width / 2, size.height * .42 + 31);
    }
  }

  destroy() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}

function drawVenueActivity(ctx: CanvasRenderingContext2D, size: Size, plan: VenueActivityPlan, positionMs: number, reducedMotion: boolean) {
  const scale = (point: { x: number; y: number }) => ({ x: point.x * size.width, y: point.y * size.height });
  const actors = deriveVenueActivity(plan, positionMs, reducedMotion);
  ctx.save();
  plan.staff.forEach((staff) => {
    const p = scale(staff.position); const serving = actors.some((actor) => actor.service === staff.service && actor.state.startsWith("being_served"));
    ctx.fillStyle = staff.service === "bar" ? "#22d3ee" : "#fb923c"; ctx.strokeStyle = serving ? "#fef08a" : "#0f172a"; ctx.lineWidth = serving ? 3 : 2;
    ctx.beginPath(); ctx.arc(p.x + staff.appearance * 10, p.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.fillText(staff.service === "bar" ? "B" : "M", p.x + staff.appearance * 10, p.y + 2);
  });
  actors.filter((actor) => actor.state !== "watching_stage").forEach((actor) => {
    const p = scale(actor.position); ctx.fillStyle = ["#60a5fa", "#a78bfa", "#f472b6", "#34d399"][actor.appearance];
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(15,23,42,.8)"; ctx.lineWidth = 1; ctx.stroke();
    const handover = actor.state.startsWith("being_served") && actor.progress > .72;
    if (handover || actor.carriedItem) { ctx.fillStyle = actor.service === "bar" ? "#e0f2fe" : "#fef3c7"; const bob = reducedMotion ? 0 : Math.sin(positionMs / 100) * 1.5; ctx.fillRect(p.x + 5, p.y - 6 + bob, actor.carriedItem === "poster" ? 5 : 4, actor.carriedItem === "shirt" ? 6 : 4); }
  });
  ctx.restore();
}

function label(phase: string) { return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function metricNumber(metric: unknown) { return typeof metric === "object" && metric !== null && "status" in metric && (metric as { status: string }).status === "available" && "value" in metric && typeof (metric as { value: unknown }).value === "number" ? (metric as { value: number }).value : 0; }
function unionRects(rects: Array<{ x: number; y: number; width: number; height: number }>) { const minX = Math.min(...rects.map((r) => r.x)); const minY = Math.min(...rects.map((r) => r.y)); const maxX = Math.max(...rects.map((r) => r.x + r.width)); const maxY = Math.max(...rects.map((r) => r.y + r.height)); return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }; }
