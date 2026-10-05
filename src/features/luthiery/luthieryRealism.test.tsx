import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { LuthieryInstrumentPreview } from '@/components/crafting/LuthieryInstrumentPreview';
import { DEFAULT_LUTHIERY_SELECTION, LUTHIERY_SHAPES, LUTHIERY_MATERIAL_OPTIONS, getShapeForSelection } from '@/data/luthieryWorkbench';
import { buildInstrument } from '@/features/gig-demo-3d/instruments';

describe('Luthiery realism and compatibility', () => {
  it('keeps 15 unique silhouettes and multiple variations in every category', () => {
    expect(LUTHIERY_SHAPES).toHaveLength(15);
    expect(new Set(LUTHIERY_SHAPES.map(shape => shape.bodyPath)).size).toBe(15);
    for (const slot of ['body', 'neck', 'fretboard', 'electronics', 'hardware', 'finish']) {
      expect(LUTHIERY_MATERIAL_OPTIONS.filter(option => option.slot === slot).length).toBeGreaterThanOrEqual(6);
    }
    expect(new Set(LUTHIERY_MATERIAL_OPTIONS.map(option => option.id)).size).toBe(LUTHIERY_MATERIAL_OPTIONS.length);
  });

  it.each(['electric_guitar', 'electric_bass'] as const)('%s has aligned bridge-to-nut strings and logarithmically spaced frets', instrumentKind => {
    const selection = { ...DEFAULT_LUTHIERY_SELECTION, instrumentKind, shapeId: instrumentKind === 'electric_bass' ? 'classic-bass' : 'double-cut' };
    const { container } = render(<LuthieryInstrumentPreview selection={selection} shape={getShapeForSelection(selection)} activePart="body" onSelectPart={() => undefined} />);
    expect(screen.getByTestId('instrument-strings').querySelectorAll('path')).toHaveLength(instrumentKind === 'electric_bass' ? 4 : 6);
    const frets = [...container.querySelectorAll('[data-fret]')].map(element => Number(element.getAttribute('x1')));
    expect(frets).toHaveLength(22);
    expect(frets[0] - frets[1]).toBeGreaterThan(frets[20] - frets[21]);
    for (const string of screen.getByTestId('instrument-strings').querySelectorAll('path')) expect(string.getAttribute('d')).toMatch(/^M72 /);
  });

  it('clips artwork to the body and gives separate previews unique paint definitions', () => {
    const selection = { ...DEFAULT_LUTHIERY_SELECTION, finishId: 'finish-artwork', decal: { ...DEFAULT_LUTHIERY_SELECTION.decal, id: 'lightning' as const } };
    const props = { selection, shape: getShapeForSelection(selection), activePart: 'body' as const, onSelectPart: () => undefined };
    const { container } = render(<><LuthieryInstrumentPreview {...props} /><LuthieryInstrumentPreview {...props} /></>);
    const clips = [...container.querySelectorAll('clipPath')].map(element => element.id);
    expect(new Set(clips).size).toBe(2);
    for (const decal of screen.getAllByTestId('instrument-decal')) expect(decal.parentElement?.getAttribute('clip-path')).toMatch(/^url\(#/);
  });

  it('renders every shared silhouette as finite distinct stage geometry', () => {
    const outlines: string[] = [];
    for (const shape of LUTHIERY_SHAPES) {
      const bass = shape.instrumentKinds[0] === 'electric_bass';
      const rig = buildInstrument(bass ? 'bass_guitar' : 'electric_guitar', undefined, null, {
        instrumentName: 'Test', instrumentKind: bass ? 'electric_bass' : 'electric_guitar', shapeId: shape.id,
        shapeName: shape.name, colour: '#245b43', finalQuality: 75,
      });
      const object = rig.root.getObjectByName('instrument-body');
      if (!(object instanceof T.Mesh)) throw new Error('Missing crafted body');
      const positions = Array.from(object.geometry.getAttribute('position').array as ArrayLike<number>);
      expect(positions.every(Number.isFinite)).toBe(true);
      outlines.push(JSON.stringify(positions));
      rig.root.traverse(child => {
        if (!(child instanceof T.Mesh)) return;
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
      });
    }
    expect(new Set(outlines).size).toBe(15);
  });
});