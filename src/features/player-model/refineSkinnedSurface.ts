import * as T from 'three';

/** Add deformation vertices without moving the authored surface or changing
 * material groups. Shared edge midpoints prevent cracks between triangles. */
export function refineSkinnedSurface(source: T.BufferGeometry, passes = 2): T.BufferGeometry {
  let geometry = source.clone();
  for (let pass = 0; pass < passes; pass++) {
    const names = Object.keys(geometry.attributes);
    const data: Record<string, number[]> = Object.fromEntries(names.map(name => {
      const attribute = geometry.getAttribute(name);
      return [name, Array.from({ length: attribute.count * attribute.itemSize }, (_, i) => attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize))];
    }));
    let count = geometry.getAttribute('position').count;
    const edges = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const cached = edges.get(key); if (cached !== undefined) return cached;
      const index = count++;
      for (const name of names) {
        const size = geometry.getAttribute(name).itemSize;
        for (let c = 0; c < size; c++) data[name].push((data[name][a * size + c] + data[name][b * size + c]) * .5);
      }
      if (data.skinIndex && data.skinWeight) {
        const weights = new Map<number, number>();
        for (const vertex of [a, b]) for (let c = 0; c < 4; c++) {
          const bone = data.skinIndex[vertex * 4 + c];
          weights.set(bone, (weights.get(bone) ?? 0) + data.skinWeight[vertex * 4 + c] * .5);
        }
        const strongest = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = strongest.reduce((total, [, weight]) => total + weight, 0) || 1;
        for (let c = 0; c < 4; c++) {
          data.skinIndex[index * 4 + c] = strongest[c]?.[0] ?? 0;
          data.skinWeight[index * 4 + c] = (strongest[c]?.[1] ?? 0) / sum;
        }
      }
      edges.set(key, index); return index;
    };
    const indices: number[] = [];
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? geometry.getAttribute('position').count, materialIndex: 0 }];
    const next = new T.BufferGeometry();
    for (const group of groups) {
      const start = indices.length;
      for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
        const a = geometry.index?.getX(i) ?? i, b = geometry.index?.getX(i + 1) ?? i + 1, c = geometry.index?.getX(i + 2) ?? i + 2;
        const ab = midpoint(a,b), bc = midpoint(b,c), ca = midpoint(c,a);
        indices.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);
      }
      next.addGroup(start, indices.length - start, group.materialIndex ?? 0);
    }
    for (const name of names) next.setAttribute(name, name === 'skinIndex' ? new T.Uint16BufferAttribute(data[name], geometry.getAttribute(name).itemSize) : new T.Float32BufferAttribute(data[name], geometry.getAttribute(name).itemSize));
    next.setIndex(indices); geometry.dispose(); geometry = next;
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
