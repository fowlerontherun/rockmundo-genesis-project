import { afterEach, describe, expect, it, vi } from "vitest";
import { captureProfilePhotoForShare, PROFILE_PHOTO_MAX_BYTES } from "./profilePhotoCapture";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("profile photo fallback without WebGL", () => {
  it("rejects non-HTTPS URLs without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(captureProfilePhotoForShare("http://example.test/photo.png")).rejects.toThrow("HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects corrupt, oversized, or non-raster image content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ type: "image/svg+xml", size: 120 }),
    }));
    await expect(captureProfilePhotoForShare("https://example.test/avatar.svg")).rejects.toThrow("valid image");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ type: "image/png", size: PROFILE_PHOTO_MAX_BYTES + 1 }),
    }));
    await expect(captureProfilePhotoForShare("https://example.test/huge.png")).rejects.toThrow("under 8 MB");
  });

  it("converts an uploaded raster portrait to a shareable local PNG", async () => {
    const close = vi.fn();
    const draw = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ type: "image/jpeg", size: 4096 }),
    }));
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 900, height: 900, close }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,photo");
    const result = await captureProfilePhotoForShare("https://example.test/avatar.jpg");
    expect(result).toEqual({ dataUrl: "data:image/png;base64,photo", width: 720, height: 1080 });
    expect(draw).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
