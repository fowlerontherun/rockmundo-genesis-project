import type { GigViewerReplay } from "../../events/types";
import type { GigExperienceDTO } from "../../types";
import type { DerivedPlaybackState } from "./PlaybackController";
import { buildCrowdPlan, reconstructCrowdState, type CrowdLayoutPlan } from "./CrowdLifecycle";
import { buildEntityLayout, type EntityLayout } from "./EntityLayout";
import { buildPerformerPlan, reconstructPerformerState, type PerformerPlan } from "./PerformerLifecycle";
import type { Size } from "./Viewport";
import { selectVenuePreset, scaleVenuePreset } from "./VenueLayout";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private size: Size = { width: 1, height: 1 };
  private dpr = 1;
  private layout: EntityLayout | null = null;
  private crowdPlan: CrowdLayoutPlan | null = null;
  private performerPlan: PerformerPlan | null = null;
  private lastFrameMs = 0;

  constructor(private canvas: HTMLCanvasElement, private replay: GigViewerReplay, private experience: GigExperienceDTO | null, private reducedMotion: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    this.ctx = ctx;
  }

  resize(size: Size) {
    this.size = { width: Math.max(280, size.width), height: Math.max(220, size.height) };
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(this.size.width * this.dpr);
    this.canvas.height = Math.floor(this.size.height * this.dpr);
    this.canvas.style.width = `${this.size.width}px`;
    this.canvas.style.height = `${this.size.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout = buildEntityLayout({ replay: this.replay, experience: this.experience, size: this.size, reducedMotion: this.reducedMotion });
    this.crowdPlan = buildCrowdPlan({ replay: this.replay, attendance: this.layout.attendance, capacity: this.layout.capacity, size: this.size, reducedMotion: this.reducedMotion, devicePixelRatio: this.dpr });
    this.performerPlan = buildPerformerPlan({ replay: this.replay, experience: this.experience, size: this.size });
  }

  render(state: DerivedPlaybackState) {
    const start = performance.now();
    const ctx = this.ctx;
    const size = this.size;
    if (!this.layout || !this.crowdPlan || !this.performerPlan) this.resize(size);
    const preset = scaleVenuePreset(selectVenuePreset({ capacity: this.experience?.gig.venue.capacity }), size);
    const crowd = this.crowdPlan ? reconstructCrowdState(this.crowdPlan, state.positionMs, this.reducedMotion) : null;
    const performers = this.performerPlan ? reconstructPerformerState(this.performerPlan, this.replay, state.positionMs, { reducedMotion: this.reducedMotion }) : [];

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(preset.audience.x, preset.audience.y, preset.audience.width, preset.audience.height);
    if (crowd && preset.crowdZones.length > 1) {
      ctx.globalAlpha = .18 + crowd.fillProgress * .18;
      ctx.fillStyle = "#38bdf8";
      preset.crowdZones.forEach((z, i) => { if (crowd.occupiedZones.some((id) => id.startsWith(i === 0 ? "front" : "middle"))) ctx.fillRect(z.x, z.y, z.width, z.height); });
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#374151";
    preset.entrances.forEach((p) => { ctx.beginPath(); ctx.rect(p.x - 12, p.y - 8, 24, 16); ctx.fill(); });
    ctx.fillStyle = "#3f2f20";
    ctx.fillRect(preset.stage.x, preset.stage.y, preset.stage.width, preset.stage.height);
    ctx.fillStyle = "#6b7280";
    preset.barriers.forEach((r) => ctx.fillRect(r.x, r.y, r.width, r.height));
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath(); ctx.arc(preset.backstage.x, preset.backstage.y, 10, 0, Math.PI * 2); ctx.fill();

    (crowd?.entities ?? []).forEach((c, i) => {
      if (!c.visible && c.state !== "queued") return;
      if (!c.visible && i % 7 !== 0) return;
      const alpha = c.state === "queued" ? .22 : c.state === "entering" ? .58 : c.state === "settling" ? .72 : .82;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.state === "queued" ? "#cbd5e1" : i % 3 === 0 ? "#60a5fa" : i % 3 === 1 ? "#a78bfa" : "#f472b6";
      ctx.beginPath();
      if (c.state === "entering" || c.state === "moving_to_zone") ctx.rect(c.x - c.radius, c.y - c.radius, c.radius * 2, c.radius * 2); else ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    performers.forEach((p) => {
      if (!p.visible) return;
      const focus = state.performerFocusId === p.id || p.activeMoveEventId === state.activeEvent?.id;
      ctx.fillStyle = p.lifecycleState === "waiting_backstage" ? "#cbd5e1" : p.lifecycleState === "exiting" ? "#fca5a5" : "#f8fafc";
      ctx.strokeStyle = focus ? "#fde047" : "#111827";
      ctx.lineWidth = focus ? 4 : 2;
      ctx.beginPath(); ctx.arc(p.currentPosition.x, p.currentPosition.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#111827"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.initials, p.currentPosition.x, p.currentPosition.y - 3);
      ctx.font = "bold 8px sans-serif"; ctx.fillText(p.label, p.currentPosition.x, p.currentPosition.y + 8);
    });

    if (state.activeEvent?.visualPayload.type === "spotlight" || state.activeEvent?.visualPayload.type === "moment_effect") {
      ctx.strokeStyle = "rgba(250, 204, 21, .75)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(size.width / 2, preset.stage.y + preset.stage.height / 2, 48 + (this.reducedMotion ? 0 : Math.sin(state.positionMs / 180) * 8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(15,23,42,.78)"; ctx.fillRect(preset.labelSafe.x, preset.labelSafe.y, preset.labelSafe.width, preset.labelSafe.height);
    ctx.fillStyle = "#f8fafc"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`${label(state.activePhase)}${state.currentSongTitle ? ` · ${state.currentSongTitle}` : ""}`, preset.labelSafe.x + 10, preset.labelSafe.y + 20);
    if (crowd) {
      ctx.font = "12px sans-serif"; ctx.fillText(`${crowd.phaseLabel} ${Math.round(crowd.fillProgress * 100)}%`, preset.labelSafe.x + 10, preset.labelSafe.y + 42);
      if (import.meta.env.DEV) { this.lastFrameMs = performance.now() - start; ctx.textAlign = "right"; ctx.fillText(`${crowd.diagnostics.entityCount} crowd · ${performers.filter((p) => p.visible).length} performers · ${this.lastFrameMs.toFixed(1)}ms`, preset.labelSafe.x + preset.labelSafe.width - 10, preset.labelSafe.y + 42); }
    }
    if (state.activeEvent?.visualPayload.type === "result_reveal") {
      ctx.fillStyle = "rgba(22, 163, 74, .86)"; ctx.fillRect(size.width * .25, size.height * .42, size.width * .5, 52); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 18px sans-serif"; ctx.fillText("Result ready", size.width / 2, size.height * .42 + 31);
    }
  }
  destroy() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}
function label(phase: string) { return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
