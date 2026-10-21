import { describe, expect, it } from 'vitest';
import { newArtworkDesign } from './design';
import { parseArtworkProject, serializeArtworkProject } from './project';

describe('editable artwork projects', () => {
  it.each(['cover', 'cd', 'vinyl'] as const)('restores %s as the selected format', surface => {
    const project = { design: newArtworkDesign('Night Shift', 'War Dogs'), surface };
    expect(parseArtworkProject(serializeArtworkProject(project))).toEqual(project);
  });
  it('opens legacy designs as covers without losing their edits', () => {
    const design = { ...newArtworkDesign('Legacy'), vinylStyle: 'splatter' as const };
    expect(parseArtworkProject(JSON.stringify(design))).toEqual({ design, surface: 'cover' });
  });
  it('retains embedded images and crops alongside the format', () => {
    const project = { surface: 'cd' as const, design: { ...newArtworkDesign(), image: { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHosAAAAASUVORK5CYII=', zoom: 2, x: .4, y: -.5 } } };
    expect(parseArtworkProject(serializeArtworkProject(project))).toEqual(project);
  });
  it.each([null, 42, 'unknown'])('rejects invalid formats %j', surface => {
    expect(() => parseArtworkProject(JSON.stringify({ ...newArtworkDesign(), surface }))).toThrow('format');
  });
});
