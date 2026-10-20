import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { captureAvatarCanvas } from './avatarCapture';

describe('avatar share capture', () => {
  it('captures the canonical renderer without owning avatar rendering', () => {
    const source = { width: 800, height: 1000, toDataURL: vi.fn(() => 'data:image/png;base64,abc') } as unknown as HTMLCanvasElement;
    expect(captureAvatarCanvas(source)).toEqual({ dataUrl: 'data:image/png;base64,abc', width: 800, height: 1000 });
    expect(source.toDataURL).toHaveBeenCalledWith('image/png');
  });
});


describe('share portrait outfit parity with live stage performers', () => {
  it('loads donor and curated wearable assets before assembling the musician', () => {
    const source = fs.readFileSync(path.resolve('src/features/shareable-moments/avatarCapture.ts'), 'utf8');
    // Model styles not worn by this player (especially the opposite
    // body frame) should never be a mandatory prerequisite for sharing.
    expect(source).toContain('requiredModelFiles([visual.appearance])');
    expect(source).toContain('const files=[...requiredModelFiles([visual.appearance]),...donorFiles]');
    expect(source).not.toContain('STYLES.map(style=>modelFile');
    expect(source).toContain('requiredCuratedDonorModelFiles(clothing,frame)');
    expect(source).toContain('requiredCuratedGarmentFiles(clothing,frame)');
    expect(source).toContain('await loadOptionalCuratedGarments(library,curatedFiles)');
    // When a published garment is unavailable, the editor must show Retry,
    // never silently export a character wearing different clothing.
    expect(source).toContain('if (curatedFiles.some(file=>!library!.has(file)))');
    expect(source).toContain('Equipped curated clothing could not load.');
    const garmentsReady = source.indexOf('await loadOptionalCuratedGarments(library,curatedFiles)');
    const actorConstructed = source.indexOf('actor=new Musician(');
    expect(garmentsReady).toBeGreaterThan(-1);
    expect(actorConstructed).toBeGreaterThan(garmentsReady);
    // The Musician constructor uses this library to attach standalone,
    // skinned GLB garments; undefined here silently skips curated clothes.
    expect(source).toContain('clothing,visual.instrumentSkin,library,visual.luthieryInstrument');
    expect(source).not.toContain('clothing,undefined,undefined,visual.luthieryInstrument');
  });

  it('keeps the copied WebGL frame before renderer disposal', () => {
    const source = fs.readFileSync(path.resolve('src/features/shareable-moments/avatarCapture.ts'), 'utf8');
    expect(source.indexOf('context.drawImage(canvas, 0, 0)')).toBeLessThan(source.indexOf('renderer.dispose()'));
    expect(source).toContain('if (visibleSamples <= 64) throw new Error("Avatar share render was blank")');
  });
});
