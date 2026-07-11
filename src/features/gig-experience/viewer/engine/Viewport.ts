export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }

export function scaleRect(rect: Rect, size: Size): Rect {
  return { x: rect.x * size.width, y: rect.y * size.height, width: rect.width * size.width, height: rect.height * size.height };
}

export function scalePoint(point: Point, size: Size): Point {
  return { x: point.x * size.width, y: point.y * size.height };
}

export function clamp01(value: number) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
export function pointInRect(point: Point, rect: Rect) { return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height; }
