export type TotpPresenterKey = "alex_rayne" | "maya_stone" | "jack_mercer" | "nia_vale";
export type TotpShowVariant = "regular" | "guest_host" | "milestone" | "christmas" | "anniversary" | string;

export interface TotpPresenterProfile {
  key: TotpPresenterKey;
  displayName: string;
  role: string;
  visual: {
    suit: string;
    shirt: string;
    skin: string;
    hair: string;
    accent: string;
  };
}

export const TOTP_PRESENTERS: Record<TotpPresenterKey, TotpPresenterProfile> = {
  alex_rayne: {
    key: "alex_rayne",
    displayName: "Alex Rayne",
    role: "Top of the Pops presenter",
    visual: { suit: "#171c26", shirt: "#e8ecef", skin: "#b98968", hair: "#2d2119", accent: "#c72f52" },
  },
  maya_stone: {
    key: "maya_stone",
    displayName: "Maya Stone",
    role: "Guest presenter",
    visual: { suit: "#281d37", shirt: "#f0e8f7", skin: "#9f6d52", hair: "#171116", accent: "#d45c9d" },
  },
  jack_mercer: {
    key: "jack_mercer",
    displayName: "Jack Mercer",
    role: "Guest presenter",
    visual: { suit: "#1d2b32", shirt: "#dce9e7", skin: "#c38b69", hair: "#513728", accent: "#34a6a2" },
  },
  nia_vale: {
    key: "nia_vale",
    displayName: "Nia Vale",
    role: "Guest presenter",
    visual: { suit: "#271f21", shirt: "#f2e9dd", skin: "#6f4737", hair: "#12100f", accent: "#e59a46" },
  },
};

export function resolveTotpPresenter(key?: string | null): TotpPresenterProfile {
  return TOTP_PRESENTERS[(key ?? "alex_rayne") as TotpPresenterKey] ?? TOTP_PRESENTERS.alex_rayne;
}

export function totpVariantLabel(variant?: string | null): string | null {
  if (variant === "guest_host") return "Guest host edition";
  if (variant === "milestone") return "Milestone edition";
  if (variant === "christmas") return "Christmas special";
  if (variant === "anniversary") return "Anniversary special";
  return null;
}
