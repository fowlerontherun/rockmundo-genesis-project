import { useState } from "react";
import {
  useAddFestivalCanonicalBrandProspect,
  useFestivalCanonicalBrands,
} from "../application/useFestivalCanonicalBrands";
import type { FestivalBrandSort } from "../data/festivalCanonicalBrands";

interface Props { festivalCompanyId: string }
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 40;

export function FestivalCanonicalBrandPicker({ festivalCompanyId }: Props) {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [initial, setInitial] = useState("");
  const [sort, setSort] = useState<FestivalBrandSort>("asc");
  const [page, setPage] = useState(0);
  const brands = useFestivalCanonicalBrands(festivalCompanyId, submittedSearch, initial, sort, page);
  const add = useAddFestivalCanonicalBrandProspect();
  const total = brands.data?.totalCount ?? 0;

  return (
    <section aria-labelledby="festival-brand-picker-heading" className="space-y-4">
      <div>
        <h3 id="festival-brand-picker-heading" className="text-lg font-semibold">Find a festival sponsor</h3>
        <p className="text-sm text-muted-foreground">
          Choose from existing RockMundo brands. Adding a brand creates a prospect, not a contract or guaranteed sponsorship.
        </p>
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        setSubmittedSearch(search);
        setPage(0);
      }} className="flex flex-wrap gap-2">
        <label htmlFor="festival-brand-search" className="sr-only">Search brand name or category</label>
        <input id="festival-brand-search" className="min-w-0 flex-1 rounded border bg-background px-3 py-2"
          value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)}
          placeholder="Brand name or category" />
        <button type="submit" className="rounded border px-3 py-2">Search brands</button>
      </form>
      <div className="space-y-2">
        <p className="text-sm font-medium">Filter by first letter</p>
        <div role="group" aria-label="Filter brands alphabetically"
          className="flex gap-1 overflow-x-auto pb-2" >
          {["", ...LETTERS].map((letter) => (
            <button type="button" key={letter || "all"}
              aria-pressed={initial === letter}
              className={`min-h-10 min-w-10 shrink-0 rounded border px-2 text-sm ${initial === letter
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"}`}
              onClick={() => { setInitial(letter); setPage(0); }}>
              {letter || "All"}
            </button>
          ))}
        </div>
        <label htmlFor="festival-brand-sort" className="flex items-center gap-2 text-sm">
          Sort
          <select id="festival-brand-sort" className="rounded border bg-background px-3 py-2"
            value={sort} onChange={(event) => {
              setSort(event.target.value as FestivalBrandSort);
              setPage(0);
            }}>
            <option value="asc">Name: A–Z</option>
            <option value="desc">Name: Z–A</option>
          </select>
        </label>
      </div>
      {brands.isPending && <p role="status">Loading brands…</p>}
      {brands.isError && <p role="alert">Unable to load brands: {brands.error.message}</p>}
      {add.isError && <p role="alert">Unable to add prospect: {add.error.message}</p>}
      {add.isSuccess && <p role="status">Brand added to festival prospects.</p>}
      {brands.isSuccess && brands.data.items.length === 0 && <p>No eligible brands match your filters.</p>}
      {brands.isSuccess && brands.data.items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + brands.data.items.length} of {total} brands
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {brands.data.items.map((brand) => {
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
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </>
      )}
    </section>
  );
}
