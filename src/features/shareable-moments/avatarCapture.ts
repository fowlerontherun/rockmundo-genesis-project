export interface AvatarCapture {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Captures the already-rendered canonical Avatar V1 canvas.
 * The player-model renderer remains the sole owner of avatar geometry/materials.
 */
export function captureAvatarCanvas(source: HTMLCanvasElement): AvatarCapture {
  return {
    dataUrl: source.toDataURL('image/png'),
    width: source.width,
    height: source.height,
  };
}

export function loadCaptureImage(capture: AvatarCapture): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load avatar capture'));
    image.src = capture.dataUrl;
  });
}
