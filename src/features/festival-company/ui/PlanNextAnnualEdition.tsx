import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { planNextFestivalEdition, type FestivalEditionCreationResult } from "../data/festivalCompanyRepository";

export function PlanNextAnnualEdition({ festivalCompanyId, active }: { festivalCompanyId: string; active: boolean }) {
  const [created, setCreated] = useState<FestivalEditionCreationResult | null>(null);
  const mutation = useMutation({ mutationFn: () => planNextFestivalEdition(festivalCompanyId, crypto.randomUUID()), onSuccess: setCreated });
  return <section className="space-y-3 rounded border p-4" aria-labelledby="next-edition-title">
    <h2 id="next-edition-title" className="text-xl font-semibold">Annual editions</h2>
    <p>Create the next permitted game-year draft from permanent company defaults. Runtime, ticket sales, artist contracts and settlement state are never copied.</p>
    {created && <Alert><AlertDescription>Edition {created.editionYear} is ready for private planning.</AlertDescription></Alert>}
    {mutation.isError && <Alert variant="destructive"><AlertDescription>The next annual edition could not be planned. An edition may already exist for that year.</AlertDescription></Alert>}
    <Button type="button" disabled={!active || mutation.isPending || Boolean(created)} onClick={() => mutation.mutate()}>{mutation.isPending ? "Planning…" : "Plan next annual edition"}</Button>
  </section>;
}
