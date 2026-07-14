import type { StageDecorations, StageType, VenuePreset } from "./VenueLayout";
import type { Size } from "./Viewport";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function drawBackground(ctx: CanvasRenderingContext2D, preset: VenuePreset, size: Size) {
  const p = preset.decorations.palette;
  const grad = ctx.createLinearGradient(0, 0, 0, size.height);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(1, p.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size.width, size.height);
}

export function drawFloor(ctx: CanvasRenderingContext2D, preset: VenuePreset) {
  const a = preset.audience;
  const p = preset.decorations.palette;
  const pat = preset.decorations.floorPattern;
  const grad = ctx.createLinearGradient(a.x, a.y, a.x, a.y + a.height);
  grad.addColorStop(0, withAlpha(p.audienceFloor, 1));
  grad.addColorStop(1, withAlpha(p.audienceFloor, 0.75));
  ctx.fillStyle = grad;
  ctx.fillRect(a.x, a.y, a.width, a.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.x, a.y, a.width, a.height);
  ctx.clip();
  if (pat === "checker") {
    const s = 22;
    for (let y = 0; y < a.height; y += s) for (let x = 0; x < a.width; x += s) {
      if (((Math.floor(x / s) + Math.floor(y / s)) & 1) === 0) continue;
      ctx.fillStyle = withAlpha(p.accent, 0.05);
      ctx.fillRect(a.x + x, a.y + y, s, s);
    }
  } else if (pat === "wood") {
    ctx.strokeStyle = withAlpha("#000000", 0.35);
    ctx.lineWidth = 1;
    for (let x = 0; x < a.width; x += 46) { ctx.beginPath(); ctx.moveTo(a.x + x, a.y); ctx.lineTo(a.x + x, a.y + a.height); ctx.stroke(); }
    for (let y = 0; y < a.height; y += 68) { ctx.strokeStyle = withAlpha("#000000", 0.2); ctx.beginPath(); ctx.moveTo(a.x, a.y + y); ctx.lineTo(a.x + a.width, a.y + y); ctx.stroke(); }
  } else if (pat === "concrete") {
    ctx.fillStyle = withAlpha("#ffffff", 0.02);
    for (let i = 0; i < 90; i++) ctx.fillRect(a.x + Math.random() * a.width, a.y + Math.random() * a.height, 1.2, 1.2);
    ctx.strokeStyle = withAlpha("#000000", 0.25);
    for (let x = 0; x < a.width; x += 120) { ctx.beginPath(); ctx.moveTo(a.x + x, a.y); ctx.lineTo(a.x + x, a.y + a.height); ctx.stroke(); }
  } else if (pat === "grass") {
    ctx.fillStyle = withAlpha("#052e0d", 0.55);
    ctx.fillRect(a.x, a.y, a.width, a.height);
    ctx.fillStyle = withAlpha("#22c55e", 0.06);
    for (let i = 0; i < 260; i++) ctx.fillRect(a.x + Math.random() * a.width, a.y + Math.random() * a.height, 2, 1);
  } else if (pat === "asphalt") {
    ctx.fillStyle = withAlpha("#000000", 0.4);
    ctx.fillRect(a.x, a.y, a.width, a.height);
  }
  ctx.restore();
}

export function drawStage(ctx: CanvasRenderingContext2D, preset: VenuePreset, positionMs: number, reducedMotion: boolean, stageEnergy: number) {
  const s = preset.stage;
  const p = preset.decorations.palette;
  const d = preset.decorations;

  // Backdrop
  if (d.backdrop) {
    const bd = d.backdrop;
    const grad = ctx.createLinearGradient(bd.x, bd.y, bd.x, bd.y + bd.height);
    if (preset.stageType === "theater") { grad.addColorStop(0, "#3d0a12"); grad.addColorStop(1, "#1a0508"); }
    else if (preset.stageType === "festival") { grad.addColorStop(0, "#7c2d12"); grad.addColorStop(1, "#111827"); }
    else if (preset.stageType === "club") { grad.addColorStop(0, "#3b0764"); grad.addColorStop(1, "#0f0518"); }
    else { grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#050914"); }
    ctx.fillStyle = grad;
    ctx.fillRect(bd.x, bd.y, bd.width, bd.height);
    // Theater curtain folds
    if (preset.stageType === "theater") {
      ctx.strokeStyle = withAlpha("#000000", 0.55);
      for (let i = 0; i < 14; i++) { const x = bd.x + (bd.width / 14) * i; ctx.beginPath(); ctx.moveTo(x, bd.y); ctx.lineTo(x, bd.y + bd.height); ctx.stroke(); }
    }
  }

  // Big screens (arena/stadium/festival)
  d.bigScreens.forEach((r) => {
    ctx.fillStyle = "#000000"; ctx.fillRect(r.x, r.y, r.width, r.height);
    const flicker = 0.55 + (reducedMotion ? 0 : Math.sin(positionMs / 260 + r.x) * 0.15);
    ctx.fillStyle = withAlpha(p.accent, flicker);
    ctx.fillRect(r.x + 2, r.y + 2, r.width - 4, r.height - 4);
    ctx.fillStyle = withAlpha("#ffffff", 0.15);
    for (let y = 0; y < r.height; y += 3) ctx.fillRect(r.x, r.y + y, r.width, 1);
  });

  // Stage deck with wood/metal texture
  const stageGrad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.height);
  stageGrad.addColorStop(0, p.stageDeck);
  stageGrad.addColorStop(1, p.stageEdge);
  ctx.fillStyle = stageGrad;
  ctx.fillRect(s.x, s.y, s.width, s.height);
  // Plank / panel lines
  ctx.strokeStyle = withAlpha("#000000", 0.35);
  ctx.lineWidth = 1;
  const plankGap = preset.stageType === "theater" ? 24 : 36;
  for (let x = plankGap; x < s.width; x += plankGap) { ctx.beginPath(); ctx.moveTo(s.x + x, s.y); ctx.lineTo(s.x + x, s.y + s.height); ctx.stroke(); }
  // Front stage lip highlight
  ctx.fillStyle = withAlpha("#ffffff", 0.06);
  ctx.fillRect(s.x, s.y + s.height - 3, s.width, 3);

  // Drum riser
  if (d.drumRiser) {
    const dr = d.drumRiser;
    const rg = ctx.createLinearGradient(dr.x, dr.y, dr.x, dr.y + dr.height);
    rg.addColorStop(0, "#1f1f24"); rg.addColorStop(1, "#0b0b0f");
    ctx.fillStyle = rg;
    ctx.fillRect(dr.x, dr.y, dr.width, dr.height);
    ctx.strokeStyle = withAlpha("#ffffff", 0.08); ctx.strokeRect(dr.x + 0.5, dr.y + 0.5, dr.width - 1, dr.height - 1);
  }

  // Amps
  const drawAmp = (r: { x: number; y: number; width: number; height: number }) => {
    ctx.fillStyle = p.ampBody; ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = withAlpha("#ffffff", 0.05); ctx.fillRect(r.x + 2, r.y + 2, r.width - 4, r.height - 6);
    // Grille lines
    ctx.strokeStyle = withAlpha("#ffffff", 0.09);
    for (let y = r.y + 4; y < r.y + r.height - 3; y += 2) { ctx.beginPath(); ctx.moveTo(r.x + 3, y); ctx.lineTo(r.x + r.width - 3, y); ctx.stroke(); }
    // Power LED
    ctx.fillStyle = withAlpha(p.accent, 0.9);
    ctx.fillRect(r.x + r.width - 5, r.y + r.height - 4, 2, 2);
  };
  d.ampsLeft.forEach(drawAmp);
  d.ampsRight.forEach(drawAmp);

  // Monitor wedges
  ctx.fillStyle = "#0a0a0a";
  d.monitors.forEach((r) => {
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.height);
    ctx.lineTo(r.x + r.width, r.y + r.height);
    ctx.lineTo(r.x + r.width - r.height * 0.4, r.y);
    ctx.lineTo(r.x + r.height * 0.4, r.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha("#ffffff", 0.08);
    ctx.fillRect(r.x + r.width * 0.25, r.y + r.height * 0.25, r.width * 0.5, r.height * 0.4);
    ctx.fillStyle = "#0a0a0a";
  });

  // Speaker stacks (line arrays / PA cabs)
  d.speakerStacks.forEach((r) => {
    const cabs = Math.max(3, Math.round(r.height / 12));
    const cabH = r.height / cabs;
    for (let i = 0; i < cabs; i++) {
      const y = r.y + i * cabH;
      ctx.fillStyle = p.speakerBody; ctx.fillRect(r.x, y, r.width, cabH - 1);
      ctx.strokeStyle = withAlpha("#ffffff", 0.08); ctx.strokeRect(r.x + 0.5, y + 0.5, r.width - 1, cabH - 2);
      // Cone circles
      const cx = r.x + r.width / 2;
      ctx.fillStyle = withAlpha("#000000", 0.9);
      ctx.beginPath(); ctx.arc(cx, y + cabH / 2, Math.min(r.width, cabH) * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = withAlpha("#ffffff", 0.05);
      ctx.beginPath(); ctx.arc(cx - 1, y + cabH / 2 - 1, Math.min(r.width, cabH) * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    // Rigging cable to truss
    if (d.lightingTruss) {
      ctx.strokeStyle = withAlpha("#555555", 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(r.x + r.width / 2, r.y); ctx.lineTo(r.x + r.width / 2, d.lightingTruss.y + d.lightingTruss.height); ctx.stroke();
    }
  });

  // Lighting truss
  if (d.lightingTruss) {
    const t = d.lightingTruss;
    const tg = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.height);
    tg.addColorStop(0, "#2a2a30"); tg.addColorStop(1, "#0d0d10");
    ctx.fillStyle = tg; ctx.fillRect(t.x, t.y, t.width, t.height);
    // Truss lattice
    ctx.strokeStyle = withAlpha("#ffffff", 0.14); ctx.lineWidth = 1;
    for (let x = 0; x < t.width; x += 8) {
      ctx.beginPath(); ctx.moveTo(t.x + x, t.y); ctx.lineTo(t.x + x + 8, t.y + t.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(t.x + x + 8, t.y); ctx.lineTo(t.x + x, t.y + t.height); ctx.stroke();
    }
  }

  // Light fixtures + beams
  const energy = Math.max(0, Math.min(100, stageEnergy)) / 100;
  d.lightFixtures.forEach((pt, i) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(pt.x - 3, pt.y - 2, 6, 5);
    const swing = reducedMotion ? 0 : Math.sin(positionMs / 320 + i * 1.3) * (0.15 + energy * 0.35);
    const beamLen = s.height * (0.55 + energy * 0.55);
    const beamWidth = 22 + energy * 22;
    const beamGrad = ctx.createLinearGradient(pt.x, pt.y, pt.x + swing * 60, pt.y + beamLen);
    beamGrad.addColorStop(0, withAlpha(p.accent, 0.55 * (0.35 + energy * 0.65)));
    beamGrad.addColorStop(1, withAlpha(p.accent, 0));
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(pt.x - 2, pt.y + 2);
    ctx.lineTo(pt.x + 2, pt.y + 2);
    ctx.lineTo(pt.x + swing * 60 + beamWidth / 2, pt.y + beamLen);
    ctx.lineTo(pt.x + swing * 60 - beamWidth / 2, pt.y + beamLen);
    ctx.closePath();
    ctx.fill();
  });
}

export function drawBarrier(ctx: CanvasRenderingContext2D, preset: VenuePreset) {
  const p = preset.decorations.palette;
  preset.barriers.forEach((r) => {
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.height);
    grad.addColorStop(0, "#9ca3af"); grad.addColorStop(0.5, p.barrier); grad.addColorStop(1, "#374151");
    ctx.fillStyle = grad;
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = withAlpha("#000000", 0.4);
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
  });
  ctx.fillStyle = "#1f2937";
  preset.decorations.barrierPosts.forEach((pt) => {
    ctx.fillRect(pt.x - 1, pt.y - 4, 2, 8);
  });
}

export function drawStageExtras(ctx: CanvasRenderingContext2D, preset: VenuePreset, positionMs: number, reducedMotion: boolean, stageEnergy: number) {
  const d = preset.decorations;
  const p = d.palette;
  const s = preset.stage;
  const energy = Math.max(0, Math.min(100, stageEnergy)) / 100;

  // Subwoofer cabinets on floor
  d.subwoofers.forEach((r) => {
    ctx.fillStyle = "#050505";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = withAlpha("#ffffff", 0.08);
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const rad = Math.min(r.width, r.height) * 0.32;
    ctx.fillStyle = "#111111";
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = withAlpha("#ffffff", 0.06);
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, rad * 0.4, 0, Math.PI * 2); ctx.fill();
  });

  // Cable runs
  ctx.strokeStyle = withAlpha("#000000", 0.6);
  ctx.lineWidth = 1.5;
  d.cableRuns.forEach((r) => {
    ctx.beginPath();
    const steps = Math.max(6, Math.floor(r.width / 6));
    for (let i = 0; i <= steps; i++) {
      const x = r.x + (r.width * i) / steps;
      const y = r.y + Math.sin(i * 0.7) * (r.height * 0.6);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.lineWidth = 1;

  // Guitar rack (leaning necks)
  if (d.guitarRack) {
    const g = d.guitarRack;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(g.x, g.y + g.height * 0.7, g.width, g.height * 0.1);
    for (let i = 0; i < 3; i++) {
      const gx = g.x + g.width * (0.2 + i * 0.3);
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, g.y + g.height * 0.75);
      ctx.lineTo(gx + 4, g.y);
      ctx.stroke();
      ctx.fillStyle = i === 0 ? "#dc2626" : i === 1 ? "#f59e0b" : "#0ea5e9";
      ctx.beginPath();
      ctx.ellipse(gx + 1, g.y + g.height * 0.55, 3, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1;
  }

  // Mic stands
  d.micStands.forEach((pt) => {
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x, pt.y - 22);
    ctx.stroke();
    // base
    ctx.fillStyle = "#4b5563";
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 5, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    // mic head
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(pt.x + 1, pt.y - 23, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = withAlpha("#ffffff", 0.15);
    ctx.beginPath(); ctx.arc(pt.x + 1, pt.y - 23, 2.4, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
  });

  // LED lip strip (pulses with energy)
  if (d.ledLipStrip) {
    const l = d.ledLipStrip;
    const pulse = reducedMotion ? 0.6 : 0.4 + Math.sin(positionMs / 220) * 0.3 + energy * 0.3;
    const segs = Math.max(20, Math.floor(l.width / 8));
    for (let i = 0; i < segs; i++) {
      const x = l.x + (l.width * i) / segs;
      const w = l.width / segs - 1;
      const hue = (i * 12 + positionMs / 20) % 360;
      ctx.fillStyle = reducedMotion
        ? withAlpha(p.accent, 0.6)
        : `hsla(${hue}, 90%, 60%, ${Math.max(0.2, Math.min(0.9, pulse))})`;
      ctx.fillRect(x, l.y, w, l.height);
    }
  }

  // Banner across backdrop
  if (d.bannerRect) {
    const b = d.bannerRect;
    ctx.fillStyle = withAlpha("#000000", 0.55);
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.strokeStyle = withAlpha(p.accent, 0.6);
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.width - 1, b.height - 1);
    ctx.fillStyle = withAlpha(p.accent, 0.9);
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(b.x + b.width * 0.08, b.y + b.height * (0.25 + i * 0.22), b.width * 0.84, 1);
    }
  }
}

export function drawFOHAndSecurity(ctx: CanvasRenderingContext2D, preset: VenuePreset) {
  const d = preset.decorations;
  // FOH tower
  if (d.fohTower) {
    const t = d.fohTower;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(t.x, t.y, t.width, t.height);
    ctx.strokeStyle = withAlpha("#000000", 0.6);
    ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.width - 1, t.height - 1);
    // Screens on desk
    ctx.fillStyle = withAlpha(d.palette.accent, 0.7);
    ctx.fillRect(t.x + 3, t.y + 3, t.width * 0.4 - 4, t.height * 0.35);
    ctx.fillRect(t.x + t.width * 0.5, t.y + 3, t.width * 0.5 - 4, t.height * 0.35);
    // Faders
    ctx.fillStyle = "#374151";
    for (let i = 0; i < 10; i++) {
      const fx = t.x + 4 + i * ((t.width - 8) / 10);
      ctx.fillRect(fx, t.y + t.height * 0.5, 2, t.height * 0.35);
    }
    // Label
    ctx.fillStyle = withAlpha("#ffffff", 0.5);
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FOH", t.x + t.width / 2, t.y + t.height - 2);
  }
  // Security personnel
  d.securityPosts.forEach((pt) => {
    // yellow vest
    ctx.fillStyle = "#facc15";
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = "#1c1917";
    ctx.beginPath(); ctx.arc(pt.x, pt.y - 3, 2, 0, Math.PI * 2); ctx.fill();
    // outline
    ctx.strokeStyle = withAlpha("#000000", 0.5);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.stroke();
  });
  // Floor tape marks (aisle guides)
  ctx.strokeStyle = withAlpha("#facc15", 0.35);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  d.floorTapeMarks.forEach((pt) => {
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - 6);
    ctx.lineTo(pt.x, pt.y + 6);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

export function drawFollowSpots(ctx: CanvasRenderingContext2D, preset: VenuePreset, positionMs: number, reducedMotion: boolean, stageEnergy: number) {
  const d = preset.decorations;
  if (!d.followSpots.length) return;
  const p = d.palette;
  const energy = Math.max(0, Math.min(100, stageEnergy)) / 100;
  const targetX = preset.stage.x + preset.stage.width / 2;
  const targetY = preset.stage.y + preset.stage.height * 0.55;
  d.followSpots.forEach((src, i) => {
    const sway = reducedMotion ? 0 : Math.sin(positionMs / 500 + i) * 30;
    const grad = ctx.createLinearGradient(src.x, src.y, targetX + sway, targetY);
    grad.addColorStop(0, withAlpha("#ffffff", 0.28 * (0.5 + energy * 0.5)));
    grad.addColorStop(1, withAlpha(p.accent, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(src.x - 6, src.y);
    ctx.lineTo(src.x + 6, src.y);
    ctx.lineTo(targetX + sway + 34, targetY);
    ctx.lineTo(targetX + sway - 34, targetY);
    ctx.closePath();
    ctx.fill();
    // Operator marker
    ctx.fillStyle = "#111827";
    ctx.fillRect(src.x - 4, src.y - 3, 8, 5);
  });
}

export function drawAtmosphere(ctx: CanvasRenderingContext2D, preset: VenuePreset, size: Size, stageEnergy: number, positionMs: number, reducedMotion: boolean) {
  const p = preset.decorations.palette;
  if (preset.stageType === "arena" || preset.stageType === "stadium" || preset.stageType === "festival") {
    const gr = ctx.createRadialGradient(size.width / 2, preset.stage.y + preset.stage.height, 40, size.width / 2, preset.stage.y + preset.stage.height, size.width * 0.6);
    gr.addColorStop(0, withAlpha(p.accent, 0.12));
    gr.addColorStop(1, withAlpha(p.accent, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  if (!reducedMotion && stageEnergy >= 82) {
    const strobe = (Math.sin(positionMs / 90) + 1) / 2;
    ctx.fillStyle = withAlpha("#ffffff", strobe * 0.06);
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

export const StageTypeLabels: Record<StageType, string> = { club: "Club", theater: "Theater", arena: "Arena", stadium: "Stadium", festival: "Festival" };
