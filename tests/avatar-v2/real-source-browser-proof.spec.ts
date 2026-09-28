import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifactRoot = resolve(process.env.ARTIFACT_ROOT ?? 'work/avatar-v2-authoring-artifacts');
const proofRoot = resolve('work/avatar-v2-browser-proofs');

for (const device of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, touch: true },
] as const) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport, hasTouch: device.touch });

    for (const frame of ['masculine', 'feminine'] as const) {
      test(`renders real ${frame} Blender experiment in ${device.name} Chromium`, async ({ page }) => {
        const source = resolve(artifactRoot, frame, `${frame}-HEAD-RIG-EXPERIMENT-not-validated.glb`);
        expect(existsSync(source), `Real Blender GLB missing for ${frame}; run source workflow first`).toBe(true);
        expect(readFileSync(source).subarray(0, 4).toString('ascii')).toBe('glTF');

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.route('**/avatar-v2-real-source-fixture.glb', route =>
          route.fulfill({ path: source, contentType: 'model/gltf-binary' })
        );
        await page.goto(`/avatar-v2-browser-smoke.html?frame=${frame}`);
        await expect(page.getByRole('status')).toHaveText(
          'Real GLB loaded and browser-rendered; experimental source only.'
        );
        const diagnostics = await page.evaluate(() => (
          (window as Window & {
            __avatarV2BrowserProof?: {
              state: string; sourceFrame: string; sourceOnly: boolean;
              meshes: number; skinnedMeshes: number; uvMappedMeshes: number;
              materialSlots: number; embeddedTextureSlots: number;
              triangles: number; webglVersion: string; visiblePixels: number; cameraPosition?: number[]; error?: string;
            }
          }).__avatarV2BrowserProof
        ));
        expect(diagnostics?.state).toBe('loaded');
        expect(diagnostics?.sourceFrame).toBe(frame);
        expect(diagnostics?.sourceOnly).toBe(true);
        expect(diagnostics?.meshes).toBeGreaterThan(0);
        expect(diagnostics?.skinnedMeshes).toBeGreaterThan(0);
        expect(diagnostics?.materialSlots).toBeGreaterThan(0);
        expect(diagnostics?.triangles).toBeGreaterThan(1000);
        expect(diagnostics?.webglVersion).toMatch(/webgl/i);
        expect(diagnostics?.visiblePixels, 'Real source model must contribute non-background pixels').toBeGreaterThan(300);
        expect(diagnostics?.cameraPosition?.length).toBe(3);
        expect(diagnostics?.cameraPosition?.every(Number.isFinite), 'Camera must have finite coordinates').toBe(true);
        expect(diagnostics?.error).toBeUndefined();

        const canvas = page.locator('#proof-viewer canvas');
        await expect(canvas).toBeVisible();
        const bounds = await canvas.boundingBox();
        expect(bounds?.width).toBeGreaterThan(device.name === 'mobile' ? 300 : 800);
        expect(bounds?.height).toBeGreaterThan(260);
        mkdirSync(proofRoot, { recursive: true });
        const screenshot = await canvas.screenshot({
          path: resolve(proofRoot, `${frame}-${device.name}-real-browser.png`),
          animations: 'disabled',
        });
        expect(screenshot.byteLength).toBeGreaterThan(2000);
        writeFileSync(
          resolve(proofRoot, `${frame}-${device.name}-render-diagnostics.json`),
          JSON.stringify({
            ...diagnostics,
            viewport: device.viewport,
            note: 'Real source-only browser render. Not authenticated admin review or art certification.',
          }, null, 2),
        );
        expect(pageErrors).toEqual([]);
      });
    }
  });
}
