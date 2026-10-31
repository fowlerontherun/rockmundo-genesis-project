import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useFestivalEditionVisitorGuide,
  useFestivalVisitorGuideEditions,
  useSaveFestivalEditionVisitorGuide,
} from "../application/useFestivalLaunch";
import type { FestivalEditionVisitorGuideSections } from "../data/festivalCompanyRepository";

const fields: { key: keyof FestivalEditionVisitorGuideSections; title: string; hint: string }[] = [
  { key: "site", title: "Festival site", hint: "Site name or layout only when confirmed" },
  { key: "transport", title: "Getting here", hint: "Organiser-confirmed transport information" },
  { key: "parking", title: "Parking", hint: "Only published parking availability and conditions" },
  { key: "camping", title: "Camping", hint: "Only if camping is offered for this edition" },
  { key: "accessibility", title: "Accessibility", hint: "Confirmed accessible access and assistance" },
  { key: "foodAndDrink", title: "Food & drink", hint: "Approved facilities and dietary options" },
  { key: "gates", title: "Gate opening", hint: "Confirmed gate times; specify festival local time" },
  { key: "curfew", title: "Curfew", hint: "Confirmed finish/curfew arrangements" },
  { key: "ticketHelp", title: "Ticket guidance", hint: "Supplement published admission product conditions" },
  { key: "ageGuidance", title: "Age guidance", hint: "Only confirmed age and ID requirements" },
  { key: "terms", title: "Entry terms", hint: "Actual approved entry rules, not invented legal promises" },
  { key: "refundPolicy", title: "Refunds", hint: "Only approved policy; do not guarantee eligibility" },
  { key: "faq", title: "Additional FAQs", hint: "Organiser answers for this particular edition" },
  { key: "contact", title: "Contact", hint: "Email, secure HTTPS link or clear organiser contact details" },
];

export function FestivalEditionVisitorGuideEditor({ festivalCompanyId }: { festivalCompanyId: string }) {
  const editions = useFestivalVisitorGuideEditions(festivalCompanyId);
  const [editionId, setEditionId] = useState("");
  const [draft, setDraft] = useState<FestivalEditionVisitorGuideSections>({});
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const guide = useFestivalEditionVisitorGuide(festivalCompanyId, editionId);
  const save = useSaveFestivalEditionVisitorGuide();

  useEffect(() => {
    setEditionId("");
    setDraft({});
    setDirty(false);
    setConflict(false);
  }, [festivalCompanyId]);

  useEffect(() => {
    if (!editionId && editions.data?.length) {
      setEditionId(editions.data[0].festivalEditionId);
    }
  }, [editionId, editions.data]);

  useEffect(() => {
    if (guide.data && !dirty && !conflict) setDraft(guide.data.sections);
  }, [guide.data, dirty, conflict]);

  const selected = editions.data?.find((edition) => edition.festivalEditionId === editionId);
  const canEdit = Boolean(selected?.editable && guide.data?.editable && !save.isPending);

  const changeEdition = (value: string) => {
    if (dirty && !window.confirm("Discard your unsaved visitor guide changes and switch edition?")) return;
    setDirty(false);
    setConflict(false);
    setDraft({});
    setEditionId(value);
  };

  const submit = () => {
    if (!canEdit || !guide.data || !editionId || conflict) return;
    save.mutate({
      festivalCompanyId, editionId,
      expectedVersion: guide.data.version,
      sections: Object.fromEntries(fields.map(({ key }) => [key, draft[key]?.trim() ?? ""])) as FestivalEditionVisitorGuideSections,
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: (updated) => {
        setDirty(false);
        setConflict(false);
        setDraft(updated.sections);
        toast.success("Edition visitor information saved.");
      },
      onError: (error) => {
        if (/stale|locked|historical/i.test(error.message)) {
          setConflict(true);
          toast.error("This edition changed or is locked. Your draft has been preserved.");
        } else {
          toast.error("The edition visitor guide could not be saved: " + error.message);
        }
      },
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Visitor guide by annual edition</CardTitle>
        <CardDescription>
          These notes belong only to the selected festival edition. Previously published
          company-wide guidance remains visible until replaced with specific notes.
          Do not claim parking, medical cover, accessibility facilities, gate times or
          refund rights until they have been confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editions.isLoading && <p role="status">Loading annual editions…</p>}
        {editions.isError && <div role="alert">
          <p>Annual editions could not be loaded.</p>
          <Button type="button" variant="outline" onClick={() => void editions.refetch()}>Retry</Button>
        </div>}
        {editions.data?.length === 0 && <p>No annual editions are available yet.</p>}
        {Boolean(editions.data?.length) && (
          <>
            <div className="space-y-1">
              <Label htmlFor="festival-visitor-guide-edition">Annual edition</Label>
              <select id="festival-visitor-guide-edition" value={editionId}
                onChange={(event) => changeEdition(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:max-w-md">
                {editions.data?.map((edition) => (
                  <option value={edition.festivalEditionId} key={edition.festivalEditionId}>
                    {edition.name} ({edition.editionYear}) — {edition.status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {selected && <p className="text-sm text-muted-foreground">
              {selected.startsOn ? "Starts " + selected.startsOn + ". " : ""}
              {selected.editable ? "This edition can be edited." : "This edition is locked or historical; its visitor guide is read-only."}
            </p>}
            {guide.isLoading && <p role="status">Loading selected edition notes…</p>}
            {guide.isError && <div role="alert">
              <p>Visitor information could not be loaded for this edition.</p>
              <Button type="button" variant="outline" onClick={() => void guide.refetch()}>Retry</Button>
            </div>}
            {guide.data && (
              <fieldset disabled={!canEdit || conflict} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {fields.map(({ key, title, hint }) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={"visitor-guide-" + key}>{title}</Label>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                      <Textarea id={"visitor-guide-" + key} rows={3} maxLength={1200}
                        value={draft[key] ?? ""}
                        onChange={(event) => {
                          setDirty(true);
                          setDraft((current) => ({ ...current, [key]: event.target.value }));
                        }} />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
            {conflict && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
              The published guide changed or editing was locked. Your unsaved notes are still here.
              <Button variant="outline" type="button" className="ml-2"
                onClick={() => {
                  if (!window.confirm("Discard these notes and reload the authoritative edition guide?")) return;
                  void guide.refetch().then((result) => {
                    if (result.isSuccess) { setDirty(false); setConflict(false); setDraft(result.data.sections); }
                    else toast.error("Could not reload the edition guide.");
                  });
                }}>Discard draft and reload</Button>
            </div>}
            {guide.data && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={submit} disabled={!canEdit || !dirty || conflict}>
                  {save.isPending ? "Saving…" : "Save edition visitor guide"}
                </Button>
                <span className="text-xs text-muted-foreground">Edition guide version {guide.data.version}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
