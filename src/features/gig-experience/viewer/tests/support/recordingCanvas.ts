/**
 * Draw-call recorder used by the viewer visual-regression gate.
 *
 * Instead of pixel screenshots (which are device and font dependent), the gate hashes
 * the ordered sequence of canvas operations a scene emits. Any unintended change to
 * geometry, layer order, palette or text produces a different fingerprint.
 */
export interface RecordingCanvas {
  ctx: CanvasRenderingContext2D;
  ops: string[];
  fingerprint(): string;
}

const METHODS = [
  "save", "restore", "beginPath", "closePath", "moveTo", "lineTo", "rect", "fillRect", "strokeRect", "clearRect",
  "arc", "arcTo", "ellipse", "bezierCurveTo", "quadraticCurveTo", "fill", "stroke", "clip", "translate", "rotate",
  "scale", "setTransform", "resetTransform", "transform", "fillText", "strokeText", "drawImage", "setLineDash",
  "createLinearGradient", "createRadialGradient", "measureText", "roundRect",
] as const;

const PROPERTIES = [
  "fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "font", "textAlign", "textBaseline", "lineCap", "lineJoin",
  "shadowBlur", "shadowColor", "globalCompositeOperation", "filter", "miterLimit", "lineDashOffset",
] as const;

function round(value: unknown): unknown {
  return typeof value === "number" ? Math.round(value * 100) / 100 : value;
}

export function createRecordingCanvas(): RecordingCanvas {
  const ops: string[] = [];
  const target: Record<string, unknown> = {};

  for (const method of METHODS) {
    target[method] = (...args: unknown[]) => {
      ops.push(`${method}(${args.map((arg) => JSON.stringify(round(arg))).join(",")})`);
      if (method === "measureText") return { width: 42 } as TextMetrics;
      if (method === "createLinearGradient" || method === "createRadialGradient") {
        return {
          addColorStop: (offset: number, color: string) => ops.push(`gradient.stop(${round(offset)},${color})`),
        } as unknown as CanvasGradient;
      }
      return undefined;
    };
  }

  for (const property of PROPERTIES) {
    let value: unknown = null;
    Object.defineProperty(target, property, {
      get: () => value,
      set: (next: unknown) => {
        value = next;
        ops.push(`${property}=${JSON.stringify(round(next))}`);
      },
      enumerable: true,
      configurable: true,
    });
  }

  target.canvas = { width: 1280, height: 720 };

  return {
    ctx: target as unknown as CanvasRenderingContext2D,
    ops,
    fingerprint: () => hash(ops.join(";")),
  };
}

export function hash(input: string): string {
  let h1 = 2166136261;
  let h2 = 2463534242;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code + index, 2654435761) ^ (h2 >>> 13);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
