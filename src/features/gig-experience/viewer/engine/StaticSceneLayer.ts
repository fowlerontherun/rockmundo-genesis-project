import type { Size } from "./Viewport";

/**
 * Phase 6 static layer cache. Background and architecture layers are pure
 * functions of the descriptor + size + dpr, so they are painted once into an
 * offscreen canvas and blitted each frame. The cache is keyed by fingerprint so
 * replaying the same gig reuses identical pixels, and it is cleared on destroy
 * so nothing leaks between replays.
 */
export class StaticSceneLayer {
  private canvas: HTMLCanvasElement | null = null;
  private key: string | null = null;

  constructor(private readonly name: string) {}

  get cacheKey() {
    return this.key;
  }

  /** Paints (or reuses) the layer and blits it into the target context. */
  paint(
    target: CanvasRenderingContext2D,
    options: { key: string; size: Size; dpr: number },
    draw: (ctx: CanvasRenderingContext2D, size: Size) => void,
  ) {
    if (typeof target.drawImage !== "function") {
      // Minimal/stubbed 2D contexts (tests, unsupported browsers) draw directly.
      draw(target, options.size);
      return false;
    }
    const key = `${this.name}|${options.key}|${Math.round(options.size.width)}x${Math.round(options.size.height)}@${options.dpr.toFixed(2)}`;
    if (this.key !== key || !this.canvas) {
      const canvas = this.canvas ?? createCanvas();
      if (!canvas) {
        draw(target, options.size);
        return false;
      }
      canvas.width = Math.max(1, Math.floor(options.size.width * options.dpr));
      canvas.height = Math.max(1, Math.floor(options.size.height * options.dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        draw(target, options.size);
        return false;
      }
      ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
      ctx.clearRect(0, 0, options.size.width, options.size.height);
      draw(ctx, options.size);
      this.canvas = canvas;
      this.key = key;
    }
    target.drawImage(this.canvas, 0, 0, options.size.width, options.size.height);
    return true;
  }

  destroy() {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
    this.canvas = null;
    this.key = null;
  }
}

function createCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    return document.createElement("canvas");
  } catch {
    return null;
  }
}
