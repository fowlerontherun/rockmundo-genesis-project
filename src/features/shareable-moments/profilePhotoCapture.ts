import type { AvatarCapture } from "./avatarCapture";

export const PROFILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Converts an existing user's HTTPS profile photo into a canvas-safe PNG.
 * A real, opt-in fallback for devices unable to create an offscreen WebGL context.
 * Do not pass arbitrary remote image URLs to the share compositor: canvas
 * would become tainted and image export could fail with a SecurityError.
 */
export async function captureProfilePhotoForShare(url: string): Promise<AvatarCapture> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS profile photos can be shared");
  const response = await fetch(parsed.href, { mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error("Profile photo could not be fetched");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || !blob.size || blob.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error("Profile picture must be a valid image under 8 MB");
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D image canvas is unavailable");
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    ctx.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}
