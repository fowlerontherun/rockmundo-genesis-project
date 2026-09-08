export type MerchProductShape =
  | "tee"
  | "long"
  | "hoodie"
  | "crewneck"
  | "football"
  | "jacket"
  | "tote"
  | "mug"
  | "glass"
  | "bottle"
  | "cap"
  | "beanie"
  | "poster"
  | "booklet"
  | "vinyl"
  | "sticker"
  | "patch"
  | "pin"
  | "pin-set"
  | "keyring"
  | "pick"
  | "lanyard"
  | "bundle"
  | "flat";

export const shapeForMerchProduct = (itemType: string): MerchProductShape => {
  const name = itemType.trim().toLowerCase();

  if (name.includes("keyring") || name.includes("key ring")) return "keyring";
  if (name.includes("guitar pick") || name.includes("pick pack")) return "pick";
  if (name.includes("collector") && name.includes("pin")) return "pin-set";
  if (name.includes("enamel pin") || name === "pin" || name.includes(" badge")) return "pin";
  if (name.includes("lanyard") || name.includes("laminate")) return "lanyard";
  if (name.includes("vinyl")) return "vinyl";
  if (name.includes("zine") || name.includes("programme") || name.includes("book")) return "booklet";
  if (name.includes("bundle") || name.includes("fan pack") || name.includes("essentials pack")) return "bundle";
  if (name.includes("sticker")) return "sticker";
  if (name.includes("patch")) return "patch";
  if (name.includes("poster") || name.includes("art print") || name.includes("setlist")) return "poster";
  if (name.includes("tote")) return "tote";
  if (name.includes("bottle")) return "bottle";
  if (name.includes("pint") || name.includes("glass")) return "glass";
  if (name.includes("mug")) return "mug";
  if (name.includes("beanie")) return "beanie";
  if (name.includes("cap")) return "cap";
  if (name.includes("football") || name.includes("jersey")) return "football";
  if (name.includes("jacket")) return "jacket";
  if (name.includes("hoodie")) return "hoodie";
  if (name.includes("crewneck") || name.includes("sweatshirt")) return "crewneck";
  if (name.includes("long sleeve")) return "long";
  if (name.includes("tee") || name.includes("shirt")) return "tee";

  return "flat";
};
