/** Only materials exported by the pinned Blender lookdev pass are safe to recolour.
 * The unshaded SOURCE-ONLY GLB has no exported materials and is unsupported. */
export function isAvatarV2PreviewSkinMaterial(name: string): boolean {
  return /^RMV2_Preview_Skin_(?:masculine|feminine)$/i.test(name);
}

/** Iris-only lookdev material from the genuine Blender export. */
export function isAvatarV2PreviewIrisMaterial(name: string): boolean {
  return /^RMV2_Preview_Iris_(?:masculine|feminine)_[LR]$/i.test(name);
}

/** Require one left and one right iris, not merely two matching materials. */
export function hasAvatarV2PreviewIrisPair(names: readonly string[]): boolean {
  const sides = new Set<string>();
  for (const name of names) {
    if (!isAvatarV2PreviewIrisMaterial(name)) continue;
    sides.add(name.slice(-1).toUpperCase());
  }
  return sides.has('L') && sides.has('R');
}
