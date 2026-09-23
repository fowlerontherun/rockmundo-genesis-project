import * as T from "three";
import type { ClothingDetailLayer } from "@/hooks/useSkinStore";

export type CompositeGarmentSurface = "front" | "back" | "left-sleeve" | "right-sleeve";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const flatTypes = new Set(["text", "graphic", "decal", "badge", "patch", "embroidery"]);

export function isCompositeSurfaceLayer(detail: ClothingDetailLayer) {
  return flatTypes.has(String(detail.type || "").toLowerCase());
}

function drawStar(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? radius : radius * .42;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawLightning(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(width * .1, -height * .48);
  ctx.lineTo(-width * .14, -height * .05);
  ctx.lineTo(width * .04, -height * .05);
  ctx.lineTo(-width * .12, height * .48);
  ctx.lineTo(width * .28, -height * .12);
  ctx.lineTo(width * .07, -height * .12);
  ctx.closePath();
  ctx.fill();
}

function drawRockMundoMark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.font = `900 ${Math.max(30, Math.round(height * .45))}px Arial Black, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ROCK", 0, -height * .13, width);
  ctx.fillText("MUNDO", 0, height * .22, width);
  ctx.restore();
}

function drawGraphic(ctx: CanvasRenderingContext2D, detail: ClothingDetailLayer, width: number, height: number) {
  const asset = String(detail.asset || detail.name || "graphic").toLowerCase();
  if (/rockmundo|rock mundo/.test(asset)) {
    drawRockMundoMark(ctx, width, height);
    return;
  }
  if (/star/.test(asset)) {
    drawStar(ctx, Math.min(width, height) * .44);
    return;
  }
  if (/lightning|bolt/.test(asset)) {
    drawLightning(ctx, width, height);
    return;
  }
  if (/stripe/.test(asset)) {
    ctx.fillRect(-width / 2, -height * .15, width, height * .3);
    return;
  }
  if (/circle|vinyl|record/.test(asset)) {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(width, height) * .42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(width, height) * .09, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  ctx.save();
  ctx.font = `800 ${Math.max(22, Math.round(height * .36))}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(detail.asset || detail.name || "GRAPHIC").slice(0, 24), 0, 0, width);
  ctx.restore();
}

function drawLayer(ctx: CanvasRenderingContext2D, detail: ClothingDetailLayer, size: number) {
  const rawScale = Number(detail.scale ?? 100);
  const scale = clamp(Math.abs(rawScale) > 10 ? rawScale / 100 : rawScale, .15, 3);
  const widthScale = clamp(Number(detail.widthScale ?? 100) / 100, .2, 2.5);
  const heightScale = clamp(Number(detail.heightScale ?? 100) / 100, .2, 2.5);
  const x = size * (.5 + clamp(Number(detail.offsetX ?? 0), -90, 90) / 200);
  const y = size * (.5 - clamp(Number(detail.offsetY ?? 0), -90, 90) / 200);
  const width = size * .28 * scale * widthScale;
  const height = size * .17 * scale * heightScale;
  const opacityRaw = Number(detail.opacity ?? 100);
  const opacity = clamp(opacityRaw > 1 ? opacityRaw / 100 : opacityRaw, .02, 1);
  const rotation = Number(detail.rotation || 0) * Math.PI / 180;
  const color = /^#[0-9a-fA-F]{6}$/.test(String(detail.color || "")) ? String(detail.color) : "#ffffff";

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  const type = String(detail.type || "graphic").toLowerCase();
  if (type === "text") {
    const text = String(detail.text || detail.name || "ROCKMUNDO").slice(0, 40);
    ctx.font = `900 ${Math.max(18, Math.round(height * .62))}px Arial Black, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0, width);
  } else {
    drawGraphic(ctx, detail, width, height);
  }

  ctx.restore();
}

export function buildCompositeGarmentSurfaceTexture(
  details: ClothingDetailLayer[],
  surface: CompositeGarmentSurface,
  size = 1024,
) {
  if (typeof document === "undefined") return null;
  const layers = details.filter(detail => isCompositeSurfaceLayer(detail) && String(detail.surface || "front") === surface);
  if (!layers.length) return null;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);

  layers.forEach(detail => drawLayer(ctx, detail, size));

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
