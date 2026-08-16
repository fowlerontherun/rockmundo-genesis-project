/** The only public contract for Festival URLs and their identifier semantics. */
export const festivalRoutePatterns = {
  publicDirectory: "/world/festivals",
  publicCompany: "/world/festivals/:festivalCompanyIdentifier",
  publicEdition: "/world/festivals/:festivalCompanyIdentifier/editions/:editionIdentifier",
  foundCompany: "/festival-company/new",
  company: "/festival-company/:festivalCompanyId",
  upgrades: "/festival-company/:festivalCompanyId/upgrades",
  editions: "/festival-company/:festivalCompanyId/editions",
  edition: "/festival-company/:festivalCompanyId/editions/:editionId",
  schedule: "/festival-company/:festivalCompanyId/editions/:editionId/schedule",
  site: "/festival-company/:festivalCompanyId/editions/:editionId/site",
  sponsorship: "/festival-company/:festivalCompanyId/editions/:editionId/sponsorship",
  applications: "/festival-company/:festivalCompanyId/editions/:editionId/applications",
  contracts: "/festival-company/:festivalCompanyId/editions/:editionId/contracts",
  operations: "/festival-company/:festivalCompanyId/editions/:editionId/operations",
  finance: "/festival-company/:festivalCompanyId/editions/:editionId/finance",
  live: "/festival-company/:festivalCompanyId/editions/:editionId/live",
  launch: "/festival-company/:festivalCompanyId/editions/:editionId/launch",
  settlement: "/festival-company/:festivalCompanyId/editions/:editionId/settlement",
  history: "/festival-company/:festivalCompanyId/editions/:editionId/history",
  genericCompany: "/company/:companyId",
  admin: "/admin/festivals",
  adminCompany: "/admin/festivals/:festivalCompanyId",
  adminEdition: "/admin/festivals/:festivalCompanyId/editions/:editionId",
} as const;

const encode = (value: string) => encodeURIComponent(value);
const edition = (companyId: string, editionId: string) => `/festival-company/${encode(companyId)}/editions/${encode(editionId)}`;

export const festivalRoutes = {
  publicDirectory: () => festivalRoutePatterns.publicDirectory,
  publicCompany: (identifier: string) => `/world/festivals/${encode(identifier)}`,
  publicEdition: (company: string, editionId: string) => `/world/festivals/${encode(company)}/editions/${encode(editionId)}`,
  foundCompany: () => festivalRoutePatterns.foundCompany,
  company: (id: string) => `/festival-company/${encode(id)}`,
  upgrades: (id: string) => `/festival-company/${encode(id)}/upgrades`,
  editions: (id: string) => `/festival-company/${encode(id)}/editions`,
  edition,
  schedule: (c: string, e: string) => `${edition(c, e)}/schedule`,
  site: (c: string, e: string) => `${edition(c, e)}/site`,
  sponsorship: (c: string, e: string) => `${edition(c, e)}/sponsorship`,
  applications: (c: string, e: string) => `${edition(c, e)}/applications`,
  contracts: (c: string, e: string) => `${edition(c, e)}/contracts`,
  operations: (c: string, e: string) => `${edition(c, e)}/operations`,
  finance: (c: string, e: string) => `${edition(c, e)}/finance`,
  live: (c: string, e: string) => `${edition(c, e)}/live`,
  launch: (c: string, e: string) => `${edition(c, e)}/launch`,
  settlement: (c: string, e: string) => `${edition(c, e)}/settlement`,
  history: (c: string, e: string) => `${edition(c, e)}/history`,
  genericCompany: (id: string) => `/company/${encode(id)}`,
  admin: () => festivalRoutePatterns.admin,
  adminCompany: (id: string) => `/admin/festivals/${encode(id)}`,
  adminEdition: (c: string, e: string) => `/admin/festivals/${encode(c)}/editions/${encode(e)}`,
} as const;

export const festivalRouteMetadata = Object.freeze([
  [festivalRoutePatterns.publicDirectory, "Festival directory", []],
  [festivalRoutePatterns.publicCompany, "Festival", ["festival_company_slug_or_uuid"]],
  [festivalRoutePatterns.publicEdition, "Annual edition", ["festival_company_slug_or_uuid", "annual_edition_uuid_or_year"]],
  [festivalRoutePatterns.company, "Festival company", ["festival_company_uuid"]],
  [festivalRoutePatterns.edition, "Annual edition", ["festival_company_uuid", "annual_edition_uuid"]],
] as const);

export const normaliseRoutePattern = (path: string) => path.replace(/\/+$/, "").replace(/:[^/]+/g, ":parameter") || "/";

export function assertUniqueFestivalRoutePatterns(paths: readonly string[]): void {
  const seen = new Map<string, string>();
  for (const path of paths) {
    const normalised = normaliseRoutePattern(path);
    const previous = seen.get(normalised);
    if (previous) throw new Error(`Duplicate Festival route patterns: ${previous} and ${path}`);
    seen.set(normalised, path);
  }
}

assertUniqueFestivalRoutePatterns(Object.values(festivalRoutePatterns));
