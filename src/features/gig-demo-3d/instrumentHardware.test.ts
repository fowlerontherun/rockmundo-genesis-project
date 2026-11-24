import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildGuitar } from './stage';
import { buildInstrument } from './instruments';
import { disposeModel } from '@/features/player-model/model';

describe('instrument hardware geometry', () => {
  it.each([false, true])('keeps all 22 frets inside the fretboard (bass=%s)', bass => {
    const root = buildGuitar(bass);
    const board = root.getObjectByName('fretboard');
    if (!board) throw new Error('Missing fretboard');
    const bounds = new T.Box3().setFromObject(board);
    for (let fret = 1; fret <= 22; fret++) {
      const wire = root.getObjectByName(`instrument-fret-${fret}`);
      if (!wire) throw new Error(`Missing fret ${fret}`);
      const y = wire.getWorldPosition(new T.Vector3()).y;
      expect(y).toBeGreaterThan(bounds.min.y);
      expect(y).toBeLessThan(bounds.max.y);
    }
    expect(root.children.filter(node => node.name.startsWith('instrument-hardware-saddle-'))).toHaveLength(bass ? 4 : 6);
    disposeModel(root);
  });
  it.each([['hw-brass', 'b58a3e'], ['hw-black-chrome', '111318']])('preserves %s hardware on every named fitting', (hardware, colour) => {
    const rig = buildInstrument('electric_guitar', undefined, null, {
      instrumentName: 'Test', instrumentKind: 'electric_guitar', shapeId: 'double-cut', shapeName: 'Double cut', colour: '#224466', finalQuality: 75,
      buildSpec: { parts: { hardware, fretboard: 'fret-ebony-clean', electronics: 'elec-noiseless' } },
    });
    const hardwareMeshes: T.Mesh[] = [];
    rig.root.traverse(node => {
      if (node instanceof T.Mesh && node.name.startsWith('instrument-hardware-')) hardwareMeshes.push(node);
      if (node.name === 'instrument-inlay') expect(node.visible).toBe(false);
    });
    expect(hardwareMeshes.length).toBeGreaterThan(10);
    for (const mesh of hardwareMeshes) expect((mesh.material as T.MeshStandardMaterial).color.getHexString()).toBe(colour);
    disposeModel(rig.root);
  });
});