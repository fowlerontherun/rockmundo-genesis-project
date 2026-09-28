import { useState } from "react";
import {
  useAddFestivalCanonicalBrandProspect,
  useFestivalCanonicalBrands,
} from "../application/useFestivalCanonicalBrands";

interface Props { festivalCompanyId: string }

export function FestivalCanonicalBrandPicker({ festivalCompanyId }: Props) {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const brands = useFestivalCanonicalBrands(festivalCompanyId, submittedSearch);
  const add = useAddFestivalCanonicalBrandProspect();

  return (
    <section aria-labelledby="festival-brand-picker-heading" className="space-y-4">
      <div>
        <h3 id="festival-brand-picker-heading" className="text-lg font-semibold">Find a festival sponsor</h3>
        <p className="text-sm text-muted-foreground">
          Choose from existing RockMundo brands. Adding a brand creates a prospect, not a contract or guaranteed sponsorship.
        </p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search); }} className="flex flex-wrap gap-2">
        <label htmlFor="festival-brand-search" className="sr-only">Search brand name or category</label>
        <input id="festival-brand-search" className="rounded border bg-background px-3 py-2"
          value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)}
          placeholder="Brand name or category" />
        <button type="submit" className="rounded border px-3 py-2">Search brands</button>
      </form>
      {brands.isPending && <p role="status">Loading brands…</p>}
      {brands.isError && <p role="alert">Unable to load brands: {brands.error.message}</p>}
      {add.isError && <p role="alert">Unable to add prospect: {add.error.message}</p>}
      {add.isSuccess && <p role="status">Brand added to festival prospects.</p>}
      {brands.isSuccess && brands.data.length === 0 && <p>No eligible brands match your search.</p>}
      {brands.isSuccess && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {brands.data.map((brand) => {
            const unavailable = brand.alreadyProspected || brand.alreadyContracted;
            const imageUrl = brand.logoUrl && (
              brand.logoUrl.startsWith("https://")
              || brand.logoUrl.startsWith("data:image/svg+xml;base64,")
              || brand.logoUrl.startsWith("/")
            ) ? brand.logoUrl : null;
            return (
              <li key={brand.brandId} className="flex items-center gap-3 rounded-lg border p-3">
                {imageUrl && <img src={imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{brand.brandName}</p>
                  <p className="text-sm text-muted-foreground">{brand.category}{brand.region ? ` · ${brand.region}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {brand.alreadyContracted ? "Already contracted" : brand.alreadyProspected ? "Already a prospect" : "Available to approach"}
                  </p>
                </div>
                <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                  disabled={unavailable || add.isPending}
                  onClick={() => add.mutate({ festivalCompanyId, brandId: brand.brandId })}>
                  {unavailable ? "Added" : add.isPending && add.variables?.brandId === brand.brandId ? "Adding…" : "Add prospect"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
