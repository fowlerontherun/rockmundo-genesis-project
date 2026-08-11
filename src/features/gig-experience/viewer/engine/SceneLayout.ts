import type { Rect, Size } from "./Viewport";

/** Stable authoring space for every venue, independent from the browser viewport. */
export const VENUE_SCENE_SIZE: Readonly<Size> = Object.freeze({ width: 1280, height: 720 });

export type SceneZoneName = "exterior" | "stage" | "crowd" | "bar" | "merchandise" | "entrances" | "walkingPaths";
export type SceneLayerName = "exterior" | "architecture" | "backgroundDecorations" | "stageAndBand" | "crowdFloor" | "futureConcessions" | "foregroundEffects" | "viewerUi";

/** Normalised anchors intentionally remain usable across all venue presets. */
export const VENUE_SCENE_ZONES: Readonly<Record<SceneZoneName, Rect | readonly Rect[]>> = Object.freeze({
  exterior: { x: 0, y: 0, width: 1, height: 0.18 },
  stage: { x: 0.2, y: 0.12, width: 0.6, height: 0.34 },
  crowd: { x: 0.2, y: 0.49, width: 0.6, height: 0.43 },
  bar: { x: 0.025, y: 0.48, width: 0.15, height: 0.27 },
  merchandise: { x: 0.825, y: 0.48, width: 0.15, height: 0.27 },
  entrances: [{ x: 0.04, y: 0.8, width: 0.13, height: 0.15 }, { x: 0.83, y: 0.8, width: 0.13, height: 0.15 }],
  walkingPaths: [{ x: 0.17, y: 0.48, width: 0.07, height: 0.47 }, { x: 0.76, y: 0.48, width: 0.07, height: 0.47 }, { x: 0.17, y: 0.82, width: 0.66, height: 0.1 }],
});

export interface SceneFit { width: number; height: number; offsetX: number; offsetY: number; scale: number }

/** CSS-contain geometry: the complete logical scene always stays inside the measured box. */
export function containScene(container: Size, scene: Size = VENUE_SCENE_SIZE): SceneFit {
  const width = Math.max(0, container.width);
  const height = Math.max(0, container.height);
  if (!width || !height || !scene.width || !scene.height) return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 0 };
  const scale = Math.min(width / scene.width, height / scene.height);
  const fittedWidth = scene.width * scale;
  const fittedHeight = scene.height * scale;
  return { width: fittedWidth, height: fittedHeight, offsetX: (width - fittedWidth) / 2, offsetY: (height - fittedHeight) / 2, scale };
}

export interface SceneCamera { x: number; y: number; zoom: number }
export const WIDE_VENUE_CAMERA: Readonly<SceneCamera> = Object.freeze({ x: VENUE_SCENE_SIZE.width / 2, y: VENUE_SCENE_SIZE.height / 2, zoom: 1 });

export function clampCamera(camera: SceneCamera, scene: Size = VENUE_SCENE_SIZE): SceneCamera {
  const zoom = Math.max(1, Math.min(1.2, Number.isFinite(camera.zoom) ? camera.zoom : 1));
  const visibleWidth = scene.width / zoom;
  const visibleHeight = scene.height / zoom;
  return {
    zoom,
    x: Math.max(visibleWidth / 2, Math.min(scene.width - visibleWidth / 2, camera.x)),
    y: Math.max(visibleHeight / 2, Math.min(scene.height - visibleHeight / 2, camera.y)),
  };
}

export function cameraForPlayback(options: { reducedMotion: boolean; songBoundary: boolean; requested?: SceneCamera }): SceneCamera {
  if (options.reducedMotion || options.songBoundary || !options.requested) return { ...WIDE_VENUE_CAMERA };
  return clampCamera(options.requested);
}
