import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Megaphone,
  Sparkles,
  Tent,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  annualPlanDraftIsComplete,
  annualPlanToDraft,
  calculateAnnualPlanEndDate,
  getAnnualPlanCapacityProjection,
  type FestivalAnnualPlanDraft,
} from "./model";
import {
  festivalAnnualPlanQueryKey,
  getFestivalAnnualPlan,
  saveFestivalAnnualPlan,
} from "./repository";
import { festivalRoutes } from "@/features/festivals/routes";
import { getAnnualPlanReadinessLabel, getReadinessAction } from "./readinessActions";
import { FestivalPlanningOverlay } from "./FestivalPlanningOverlay";

import { FestivalSetupSteps } from "@/features/festival-company/ui/FestivalSetupSteps";
import { FestivalThemePicker, FestivalThemePreview } from "@/features/festival-company/ui/FestivalThemePicker";
import { FestivalTicketPlanner } from "@/features/festival-company/ui/FestivalTicketPlanner";
import { defaultFestivalBranding, festivalBrandingKey, type FestivalBranding } from "@/features/festival-company/domain/festivalBranding";

type PlanningSection = "when" | "festival" | "promotion" | "values";

const formatMoney = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(minor / 100);

const formatDate = (value: string) => {
  if (!value) return "Choose a date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
};

const daysUntil = (value: string) => {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
};

export function FestivalAnnualPlan({
  festivalCompanyId,
  editionId,
}: {
  festivalCompanyId: string;
  editionId: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: festivalAnnualPlanQueryKey(festivalCompanyId, editionId),
    queryFn: () => getFestivalAnnualPlan(festivalCompanyId, editionId),
  });
  const [draft, setDraft] = useState<FestivalAnnualPlanDraft | null>(null);
  const [step, setStep] = useState(0);
  const [branding, setBranding] = useState<FestivalBranding>(defaultFestivalBranding);
  const retry = useRef<{ hash: string; key: string } | null>(null);

  useEffect(() => {
    if (query.data) { setDraft(annualPlanToDraft(query.data)); setBranding(query.data.branding ?? defaultFestivalBranding); }
  }, [query.data]);

  const save = useMutation({
    mutationFn: (input: {
      expectedVersion: number;
      plan: FestivalAnnualPlanDraft;
      idempotencyKey: string;
      branding: FestivalBranding;
    }) =>
      saveFestivalAnnualPlan({
        festivalCompanyId,
        festivalEditionId: editionId,
        ...input,
      }),
    onSuccess: async (result) => {
      setDraft(annualPlanToDraft(result));
      setBranding(result.branding ?? branding);
      queryClient.setQueryData(festivalBrandingKey(editionId), result.branding ?? branding);
      retry.current = null;
      queryClient.setQueryData(
        festivalAnnualPlanQueryKey(festivalCompanyId, editionId),
        result,
      );
      await queryClient.invalidateQueries({
        queryKey: ["festival-company-editions", festivalCompanyId],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["festival-run-readiness", festivalCompanyId, editionId] }),
        queryClient.invalidateQueries({ queryKey: ["festival-live-day-availability", festivalCompanyId, editionId] }),
      ]);
      toast.success("Festival plan saved");
    },
    onError: (error) => toast.error(/stale|conflict/.test(error.message) ? "This edition changed elsewhere. Your draft is kept; reload before saving." : "Festival plan could not be saved. Your draft is kept."),
  });

  if (query.isLoading) return <p role="status">Loading Festival plan…</p>;
  if (query.isError || !query.data || !draft) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          The annual Festival plan could not be loaded. Check company access and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const data = query.data;
  const selectedCity = data.cities.find((city) => city.id === draft.cityId);
  const selectedScale = data.scales.find((scale) => scale.key === draft.festivalScale);
  const selectedSite = data.siteTypes.find((item) => item.key === draft.siteType);
  const selectedVibe = data.vibes.find((item) => item.key === draft.vibe);
  const selectedMarketing = data.marketingEmphases.find(
    (item) => item.key === draft.marketingEmphasis,
  );
  const selectedEnvironment = data.environmentalPolicies.find(
    (item) => item.key === draft.environmentalPolicy,
  );
  const endDate = calculateAnnualPlanEndDate(draft.startsOn, draft.durationDays);
  const projection = getAnnualPlanCapacityProjection(data);
  const complete = annualPlanDraftIsComplete(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(annualPlanToDraft(data)) || JSON.stringify(branding) !== JSON.stringify(data.branding ?? defaultFestivalBranding);
  const canEdit = data.editable && data.canWrite && !save.isPending;
  const countdown = daysUntil(draft.startsOn);
  const demandShift = selectedMarketing
    ? Math.round((selectedMarketing.demandBasisPoints - 10000) / 100)
    : 0;

  const readinessLabel = getAnnualPlanReadinessLabel(data);
  const planReady = readinessLabel === "Plan ready";

  const openPlanningSection = (target: PlanningSection) => {
    setStep(target === "when" ? 1 : target === "promotion" ? 3 : 2);
    requestAnimationFrame(() => document.getElementById(`annual-plan-${target}`)?.scrollIntoView({ block: "start" }));
  };

  const patch = (values: Partial<FestivalAnnualPlanDraft>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  const persist = () => {
    if (!complete || !dirty || save.isPending || !data.canWrite || !data.editable) return;
    const hash = JSON.stringify({ version: data.version, draft, branding });
    if (retry.current?.hash !== hash) {
      retry.current = { hash, key: crypto.randomUUID() };
    }
    save.mutate({
      expectedVersion: data.version,
      plan: draft,
      idempotencyKey: retry.current.key,
      branding,
    });
  };

  const currentDate = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-5" aria-labelledby="annual-plan-heading">
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="annual-plan-heading" className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> {data.name}
              </CardTitle>
              <CardDescription>
                Make the big decisions. The Festival company handles the operational detail.
              </CardDescription>
            </div>
            <Badge variant={planReady ? "default" : "secondary"}>
              {data.readinessScore}% · {readinessLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Date" value={formatDate(draft.startsOn)} />
          <Summary
            label="Capacity"
            value={(projection.licensedCapacity ?? data.expectedCapacity ?? 0).toLocaleString("en-GB")}
          />
          <Summary
            label="Operating cost"
            value={formatMoney(data.estimatedOperatingCostMinor, data.currencyCode)}
          />
          <Summary
            label="Countdown"
            value={countdown === null ? "Not scheduled" : countdown < 0 ? "Festival date passed" : `${countdown} day${countdown === 1 ? "" : "s"}`}
          />
        </CardContent>
      </Card>

      <Card aria-label="Festival readiness checklist" className={data.blockers.length ? "border-amber-500/40" : ""}>
        <CardHeader>
          <CardTitle>Readiness checklist</CardTitle>
          <CardDescription>
            {data.blockers.length
              ? `${data.blockers.length} decision${data.blockers.length === 1 ? "" : "s"} need attention before this Festival plan is ready. Use the quick actions below.`
              : planReady
                ? "The annual plan has no outstanding planning blockers. Check the line-up, tickets and Festival Day separately before opening gates."
                : "No individual planning blockers are reported, but the edition is not yet marked ready. Review the plan before launch."}
          </CardDescription>
        </CardHeader>
        {data.blockers.length ? (
          <CardContent>
            <ul className="space-y-3">
              {data.blockers.map((blocker) => {
                const action = getReadinessAction(blocker.code);
                return (
                  <li key={blocker.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div role="alert" className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                      <span aria-hidden="true" className="mt-0.5 text-amber-700">●</span>
                      <span>{blocker.message}</span>
                    </div>
                    {action.kind === "section" ? (
                      <Button type="button" size="sm" variant="outline" disabled={!data.editable || !data.canWrite} onClick={() => openPlanningSection(action.section)}>
                        {action.label}
                      </Button>
                    ) : action.kind === "licence" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={festivalRoutes.upgrades(festivalCompanyId)}>{action.label}</Link>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => openPlanningSection("festival")}>{action.label}</Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {!data.editable ? <p className="mt-3 text-sm text-muted-foreground">This edition's planning choices are locked; review your Festival company options before making changes.</p> : null}
          </CardContent>
        ) : null}
      </Card>

      <FestivalPlanningOverlay plan={data} unsavedChanges={dirty} onOpenSection={openPlanningSection} />

      <FestivalSetupSteps step={step} onChange={setStep} busy={save.isPending}
        canContinue={step !== 1 || Boolean(draft.startsOn && draft.cityId && draft.festivalScale)}>
      {step === 0 && <FestivalThemePicker value={branding} onChange={setBranding} disabled={!canEdit}
        name={data.name} place={selectedCity?.name ?? ""} dates={formatDate(draft.startsOn)} />}
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <ChoiceCard
          id="annual-plan-when"
          icon={<CalendarDays className="h-5 w-5" />}
          title="When & where"
          summary={`${selectedCity?.name ?? "Choose city"} · ${formatDate(draft.startsOn)}${endDate && endDate !== draft.startsOn ? ` – ${formatDate(endDate)}` : ""}`}
          open={step === 1}
          onClick={() => setStep(1)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="festival-date">Start date</Label>
              <Input
                id="festival-date"
                type="date"
                min={currentDate}
                value={draft.startsOn}
                disabled={!data.editable}
                onChange={(event) => {
                  const startsOn = event.target.value;
                  const preferredMonth = startsOn
                    ? new Date(`${startsOn}T12:00:00.000Z`).getUTCMonth() + 1
                    : draft.preferredMonth;
                  patch({ startsOn, preferredMonth });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Select value={draft.cityId} disabled={!data.editable} onValueChange={(cityId) => patch({ cityId })}>
                <SelectTrigger><SelectValue placeholder="Choose city" /></SelectTrigger>
                <SelectContent>
                  {data.cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>{city.name}, {city.country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ChoiceCard>

        <ChoiceCard
          id="annual-plan-festival"
          icon={<Tent className="h-5 w-5" />}
          title="Festival"
          summary={`${selectedScale?.displayName ?? "Choose size"} · ${draft.durationDays} day${draft.durationDays === 1 ? "" : "s"} · ${selectedVibe?.displayName ?? "Choose vibe"}`}
          open={step === 2}
          onClick={() => setStep(2)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Size" value={draft.festivalScale} disabled={!data.editable} options={data.scales} onChange={(festivalScale) => {
              const next = data.scales.find((item) => item.key === festivalScale);
              patch({ festivalScale, durationDays: Math.min(draft.durationDays, next?.maximumDurationDays ?? 1) });
            }} />
            <SelectField label="Site" value={draft.siteType} disabled={!data.editable} options={data.siteTypes} onChange={(siteType) => patch({ siteType })} />
            <SelectField label="Vibe" value={draft.vibe} disabled={!data.editable} options={data.vibes} onChange={(vibe) => patch({ vibe })} />
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={String(draft.durationDays)} disabled={!data.editable} onValueChange={(value) => patch({ durationDays: Number(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: selectedScale?.maximumDurationDays ?? 1 }, (_, index) => index + 1).map((days) => (
                    <SelectItem key={days} value={String(days)}>{days} day{days === 1 ? "" : "s"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ChoiceCard>

        <ChoiceCard
          id="annual-plan-promotion"
          icon={<Megaphone className="h-5 w-5" />}
          title="Promotion"
          summary={`${selectedMarketing?.displayName ?? "Choose campaign"}${demandShift === 0 ? "" : ` · ${demandShift > 0 ? "+" : ""}${demandShift}% demand effect`}`}
          open={step === 3}
          onClick={() => setStep(3)}
        >
          <SelectField label="Marketing emphasis" value={draft.marketingEmphasis} disabled={!data.editable} options={data.marketingEmphases} onChange={(marketingEmphasis) => patch({ marketingEmphasis })} />
          {selectedMarketing ? (
            <p className="mt-3 text-sm text-muted-foreground">{selectedMarketing.description}</p>
          ) : null}
        </ChoiceCard>

        <ChoiceCard
          id="annual-plan-values"
          icon={<Sparkles className="h-5 w-5" />}
          title="Values"
          summary={selectedEnvironment?.displayName ?? "Choose approach"}
          open={step === 2}
          onClick={() => setStep(2)}
        >
          <SelectField label="Environmental approach" value={draft.environmentalPolicy} disabled={!data.editable} options={data.environmentalPolicies} onChange={(environmentalPolicy) => patch({ environmentalPolicy })} />
          {selectedEnvironment ? (
            <p className="mt-3 text-sm text-muted-foreground">{selectedEnvironment.description}</p>
          ) : null}
        </ChoiceCard>
      </fieldset>
      {step === 3 && <div className="space-y-3 border-t pt-4">
        <Summary label="Last saved operating estimate" value={formatMoney(data.estimatedOperatingCostMinor, data.currencyCode)} />
        {dirty ? <Button disabled={!complete || !canEdit} onClick={persist}>{save.isPending ? "Saving…" : "Save plan & refresh ticket budget"}</Button> : <>
          <FestivalTicketPlanner festivalCompanyId={festivalCompanyId} festivalEditionId={editionId} />
          <Button asChild variant="outline"><Link to={festivalRoutes.sponsorship(festivalCompanyId, editionId)}>Full ticket budget & sponsorship</Link></Button>
        </>}
      </div>}
      {step === 4 && <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
      <h4 className="font-semibold">Edition summary</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <Summary label="Location & dates" value={`${selectedCity?.name ?? "Choose city"} · ${formatDate(draft.startsOn)} – ${formatDate(endDate ?? draft.startsOn)}`} />
        <Summary label="Size & duration" value={`${selectedScale?.displayName ?? "Choose size"} · ${draft.durationDays} days`} />
        <Summary label="Atmosphere" value={`${selectedVibe?.displayName ?? "—"} · ${selectedEnvironment?.displayName ?? "—"}`} />
        <Summary label="Promotion" value={selectedMarketing?.displayName ?? "—"} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Last saved projections</CardTitle>
          <CardDescription>
            The useful consequences stay visible without making you manage suppliers, staff or infrastructure manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Impact icon={<Users className="h-4 w-4" />} label="Usable capacity" value={(projection.licensedCapacity ?? data.expectedCapacity ?? 0).toLocaleString("en-GB")} />
          <Impact icon={<WalletCards className="h-4 w-4" />} label="Estimated operating cost" value={formatMoney(data.estimatedOperatingCostMinor, data.currencyCode)} />
          <Impact icon={<Megaphone className="h-4 w-4" />} label="Demand effect" value={`${demandShift > 0 ? "+" : ""}${demandShift}%`} />
          <Impact icon={<MapPin className="h-4 w-4" />} label="Site style" value={selectedSite?.displayName ?? "—"} />
        </CardContent>
      </Card>

      </div>
      <FestivalThemePreview branding={branding} name={data.name} place={selectedCity?.name ?? ""} dates={formatDate(draft.startsOn)} />
      </div>}

      {step === 4 && <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{dirty ? "Estimates and readiness refresh after saving." : "Edition choices saved."}</p>
        <Button disabled={!complete || !dirty || !canEdit} onClick={persist}>
          {save.isPending ? "Saving…" : dirty ? "Save Festival choices" : "Festival choices saved"}
        </Button>
      </div>}
      {save.isError && <Alert variant="destructive"><AlertDescription>Your changes have not been saved. The draft is still available.</AlertDescription></Alert>}
      </FestivalSetupSteps>
    </section>
  );
}

function ChoiceCard({
  id,
  icon,
  title,
  summary,
  open,
  onClick,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return <section id={id} className="min-w-0 space-y-4">
    <h4 className="flex items-center gap-2 font-semibold">{icon}{title}</h4>
    <p className="text-xs text-muted-foreground">{summary}</p>
    {children}
  </section>;
}

function SelectField({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: Array<{ key?: string; displayName?: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.flatMap((option) =>
            option.key && option.displayName
              ? [
                  <SelectItem key={option.key} value={option.key}>
                    {option.displayName}
                  </SelectItem>,
                ]
              : [],
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

const Summary = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

const Impact = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-md border p-3">
    <p className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
    <p className="mt-1 font-semibold">{value}</p>
  </div>
);

const Pulse = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-md border bg-card p-4">
    <p className="font-semibold">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);
