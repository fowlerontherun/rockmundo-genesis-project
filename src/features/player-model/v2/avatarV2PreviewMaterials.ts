/** Only materials exported by the pinned Blender lookdev pass are safe to recolour.
 * The unshaded SOURCE-ONLY GLB has no exported materials and is unsupported. */
export function isAvatarV2PreviewSkinMaterial(name: string): boolean {
  return /^RMV2_Preview_Skin_(?:masculine|feminine)$/i.test(name);
}

/** Iris-only lookdev material from the genuine Blender export. */
export function isAvatarV2PreviewIrisMaterial(name: string): boolean {
  return /^RMV2_Preview_Iris_(?:masculine|feminine)_[LR]$/i.test(name);
}

/** Reject partial, mixed-frame or ambiguous exports instead of tinting the wrong eyes. */
export function hasAvatarV2PreviewIrisPair(names: readonly string[]): boolean {
  if (names.length !== 2) return false;
  const matches = names.map(name => /^RMV2_Preview_Iris_(masculine|feminine)_([LR])$/i.exec(name));
  return matches.every((match): match is RegExpExecArray => match !== null) &&
    matches[0][1].toLowerCase() === matches[1][1].toLowerCase() &&
    matches[0][2].toUpperCase() !== matches[1][2].toUpperCase();
}

/** Apply an optional creator swatch without losing the exported lookdev colour. */
export function applyAvatarV2PreviewSwatch(
  material: { color: { set(value: string): unknown; copy(value: any): unknown } },
  original: Parameters<typeof material.color.copy>[0],
  swatch: string | undefined,
): void {
  if (swatch) material.color.set(swatch);
  else material.color.copy(original);
}
