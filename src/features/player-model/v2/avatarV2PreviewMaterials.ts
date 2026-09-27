/** Recognise only body skin, not lip, brow, iris or other lookdev materials. */
export function isAvatarV2PreviewSkinMaterial(name: string): boolean {
  return /^(?:RMV2_Preview_Skin_(?:masculine|feminine)|skin(?:[ _.-]|$)|body[ _-]?skin(?:[ _.-]|$))/i.test(name);
}

/** Iris-only lookdev material from the genuine Blender export. */
export function isAvatarV2PreviewIrisMaterial(name: string): boolean {
  return /^RMV2_Preview_Iris_(?:masculine|feminine)_[LR]$/i.test(name);
}
