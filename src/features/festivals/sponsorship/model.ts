/** Canonical fictional sponsor identities for one annual edition.
 * This is not a commercial contract or an additional source of festival income.
 */
export interface EditionSponsorIdentity {
  brandId: string;
  name: string;
  logoUrl: string;
  category: string;
  source: "npc_fallback";
}
export interface EditionSponsorIdentities {
  editionId: string;
  main: EditionSponsorIdentity | null;
  supporting: EditionSponsorIdentity[];
  financialAuthority: "simplified_automatic_budget";
  postsRevenue: false;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v);
const parseIdentity = (v: unknown): EditionSponsorIdentity => {
  if (!isObject(v) || !uuid(v.brandId) ||
      typeof v.name !== "string" || !v.name.trim() ||
      typeof v.logoUrl !== "string" || !v.logoUrl.trim() ||
      typeof v.category !== "string" || v.source !== "npc_fallback") {
    throw new Error("Festival sponsor identity is unavailable");
  }
  return v as unknown as EditionSponsorIdentity;
};

export function parseEditionSponsorIdentities(raw: unknown, editionId: string): EditionSponsorIdentities {
  if (!isObject(raw) || !uuid(raw.editionId) || raw.editionId !== editionId ||
      !Array.isArray(raw.supporting) || raw.supporting.length > 4 ||
      raw.financialAuthority !== "simplified_automatic_budget" || raw.postsRevenue !== false) {
    throw new Error("Festival sponsor identity response is invalid");
  }
  const main = raw.main === null ? null : parseIdentity(raw.main);
  const supporting = raw.supporting.map(parseIdentity);
  const ids = [main, ...supporting].filter((item): item is EditionSponsorIdentity => !!item)
    .map(item => item.brandId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Festival sponsor identity response contains duplicate brands");
  }
  return {
    editionId: raw.editionId,
    main, supporting,
    financialAuthority: "simplified_automatic_budget",
    postsRevenue: false,
  };
}
