import * as T from 'three';

/** Clip triangles at a level hem, interpolating UVs and up to four normalized
 * bone influences at the new edge instead of dragging knee/ankle vertices. */
export function clipGarmentHem(source: T.BufferGeometry, height: number, garmentMaterials: Set<number>, above: boolean) {
  const position = source.getAttribute('position');
  const names = Object.keys(source.attributes);
  type Vertex = Record<string, number[]>;
  const read = (index: number): Vertex => Object.fromEntries(names.map(name => {
    const attr = source.getAttribute(name);
    return [name, Array.from({ length: attr.itemSize }, (_, c) => attr.getComponent(index, c))];
  }));
  const intersect = (a: Vertex, b: Vertex): Vertex => {
    const t = (height - a.position[1]) / (b.position[1] - a.position[1]);
    const vertex = Object.fromEntries(names.map(name => [name, a[name].map((v, c) => T.MathUtils.lerp(v, b[name][c], t))]));
    vertex.position[1] = height;
    if (a.skinIndex && a.skinWeight) {
      const weights = new Map<number, number>();
      for (const [point, blend] of [[a, 1 - t], [b, t]] as const) point.skinIndex.forEach((bone, c) => weights.set(bone, (weights.get(bone) ?? 0) + point.skinWeight[c] * blend));
      const influences = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = influences.reduce((sum, [, weight]) => sum + weight, 0) || 1;
      vertex.skinIndex = Array.from({ length: 4 }, (_, i) => influences[i]?.[0] ?? 0);
      vertex.skinWeight = Array.from({ length: 4 }, (_, i) => (influences[i]?.[1] ?? 0) / total);
    }
    return vertex;
  };
  const data: Record<string, number[]> = Object.fromEntries(names.map(name => [name, []]));
  const result = new T.BufferGeometry();
  let count = 0;
  const emit = (v: Vertex) => { names.forEach(name => data[name].push(...v[name])); count++; };
  const groups = source.groups.length ? source.groups : [{ start: 0, count: source.index?.count ?? position.count, materialIndex: 0 }];
  for (const group of groups) {
    const start = count;
    const garment = garmentMaterials.has(group.materialIndex ?? 0);
    if (!garment && !above) continue;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const triangle = [0, 1, 2].map(offset => read(source.index ? source.index.getX(i + offset) : i + offset));
      if (!garment) { triangle.forEach(emit); continue; }
      const polygon: Vertex[] = [];
      for (let v = 0; v < 3; v++) {
        const a = triangle[v], b = triangle[(v + 1) % 3];
        const insideA = above ? a.position[1] >= height : a.position[1] <= height;
        const insideB = above ? b.position[1] >= height : b.position[1] <= height;
        if (insideA) polygon.push(a);
        if (insideA !== insideB) polygon.push(intersect(a, b));
      }
      for (let v = 1; v + 1 < polygon.length; v++) [polygon[0], polygon[v], polygon[v + 1]].forEach(emit);
    }
    if (count > start) result.addGroup(start, count - start, above ? group.materialIndex ?? 0 : 0);
  }
  for (const name of names) result.setAttribute(name, name === 'skinIndex' ? new T.Uint16BufferAttribute(data[name], source.getAttribute(name).itemSize) : new T.Float32BufferAttribute(data[name], source.getAttribute(name).itemSize));
  result.setIndex(Array.from({ length: count }, (_, i) => i));
  result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
