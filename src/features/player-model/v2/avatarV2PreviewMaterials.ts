/** Recognise only body skin, not lip, brow, iris or other lookdev materials. */
export function isAvatarV2PreviewSkinMaterial(name: string): boolean {
  return /^(?:RMV2_Preview_Skin_(?:masculine|feminine)|skin(?:[ _.-]|$)|body[ _-]?skin(?:[ _.-]|$))/i.test(name);
}
