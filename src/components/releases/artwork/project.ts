import { parseArtworkDesign, type ArtworkDesign, type ArtworkSurface } from './design';

export interface ArtworkProject { design: ArtworkDesign; surface: ArtworkSurface }

/** Keep the v1 design fields readable by older clients; add the selected surface. */
export function serializeArtworkProject(project: ArtworkProject): string {
  return JSON.stringify({ ...project.design, surface: project.surface });
}

export function parseArtworkProject(text: string): ArtworkProject {
  const design = parseArtworkDesign(text);
  const { surface } = JSON.parse(text);
  if (surface !== undefined && !['cover', 'cd', 'vinyl'].includes(surface)) throw new Error('Invalid artwork format.');
  // Existing files did not store a surface; the cover is their documented default.
  return { design, surface: surface ?? 'cover' };
}
