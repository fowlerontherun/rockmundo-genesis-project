import { useEffect, useMemo, useRef, useState } from "react";
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
  const [section, setSection] = useState<PlanningSection | null>(null);
  const retry = useRef<{ hash: string; key: string } | null>(null);

  useEffect(() => {
    if (query.data) setDraft(annualPlanToDraft(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (input: {
      expectedVersion: number;
      plan: FestivalAnnualPlanDraft;
      idempotencyKey: string;
    }) =>
      saveFestivalAnnualPlan({
        festivalCompanyId,
        festivalEditionId: editionId,
        ...input,
      }),
    onSuccess: async (result) => {
      setDraft(annualPlanToDraft(result));
      retry.current = null;
      queryClient.setQueryData(
        festivalAnnualPlanQueryKey(festivalCompanyId, editionId),
        result,
      );
      await queryClient.invalidateQueries({
        queryKey: ["festival-company-editions", festivalCompanyId],
      });
      toast.success("Festival plan saved");
    },
    onError: () => toast.error("Festival plan could not be saved"),
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(annualPlanToDraft(data));
  const countdown = daysUntil(draft.startsOn);
  const demandShift = selectedMarketing
    ? Math.round((selectedMarketing.demandBasisPoints - 10000) / 100)
    : 0;

  const readinessLabel =
    data.readinessScore >= 80
      ? "Ready to launch"
      : data.readinessScore >= 50
        ? "Taking shape"
        : "Early planning";

  const patch = (values: Partial<FestivalAnnualPlanDraft>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  const persist = () => {
    if (!complete || !dirty || save.isPending || !data.canWrite) return;
    const hash = JSON.stringify({ version: data.version, draft });
    if (retry.current?.hash !== hash) {
      retry.current = { hash, key: crypto.randomUUID() };
    }
    save.mutate({
      expectedVersion: data.version,
      plan: draft,
      idempotencyKey: retry.current.key,
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
            <Badge variant={data.readinessScore >= 80 ? "default" : "secondary"}>
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

      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="When & where"
          summary={`${selectedCity?.name ?? "Choose city"} · ${formatDate(draft.startsOn)}${endDate && endDate !== draft.startsOn ? ` – ${formatDate(endDate)}` : ""}`}
          open={section === "when"}
          onClick={() => setSection(section === "when" ? null : "when")}
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
          icon={<Tent className="h-5 w-5" />}
          title="Festival"
          summary={`${selectedScale?.displayName ?? "Choose size"} · ${draft.durationDays} day${draft.durationDays === 1 ? "" : "s"} · ${selectedVibe?.displayName ?? "Choose vibe"}`}
          open={section === "festival"}
          onClick={() => setSection(section === "festival" ? null : "festival")}
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
          icon={<Megaphone className="h-5 w-5" />}
          title="Promotion"
          summary={`${selectedMarketing?.displayName ?? "Choose campaign"}${demandShift === 0 ? "" : ` · ${demandShift > 0 ? "+" : ""}${demandShift}% demand effect`}`}
          open={section === "promotion"}
          onClick={() => setSection(section === "promotion" ? null : "promotion")}
        >
          <SelectField label="Marketing emphasis" value={draft.marketingEmphasis} disabled={!data.editable} options={data.marketingEmphases} onChange={(marketingEmphasis) => patch({ marketingEmphasis })} />
          {selectedMarketing ? (
            <p className="mt-3 text-sm text-muted-foreground">{selectedMarketing.description}</p>
          ) : null}
        </ChoiceCard>

        <ChoiceCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Values"
          summary={selectedEnvironment?.displayName ?? "Choose approach"}
          open={section === "values"}
          onClick={() => setSection(section === "values" ? null : "values")}
        >
          <SelectField label="Environmental approach" value={draft.environmentalPolicy} disabled={!data.editable} options={data.environmentalPolicies} onChange={(environmentalPolicy) => patch({ environmentalPolicy })} />
          {selectedEnvironment ? (
            <p className="mt-3 text-sm text-muted-foreground">{selectedEnvironment.description}</p>
          ) : null}
        </ChoiceCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What these choices mean</CardTitle>
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

      {countdown !== null && countdown >= 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Festival countdown</CardTitle>
            <CardDescription>
              This is the event pulse players can return to as Festival day approaches.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Pulse title="Planning" body={`${data.readinessScore}% ready. ${data.blockers.length ? `${data.blockers.length} blocker${data.blockers.length === 1 ? "" : "s"} still need attention.` : "No planning blockers."}`} />
            <Pulse title="Buzz" body={selectedMarketing ? `${selectedMarketing.displayName} promotion is shaping demand for the event.` : "Choose a marketing emphasis to start building buzz."} />
            <Pulse title="Next move" body={data.readinessScore < 50 ? "Lock the core Festival choices, then move on to the line-up and tickets." : data.readinessScore < 80 ? "Build the line-up and ticket plan to move towards launch readiness." : "The Festival is close to launch readiness. Review the line-up, tickets and Run Festival screen."} />
          </CardContent>
        </Card>
      ) : null}

      {data.blockers.length ? (
        <Alert>
          <AlertDescription>
            <strong>Still needed:</strong> {data.blockers.map((blocker) => blocker.message).join(" · ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Staffing, suppliers, stage requirements, security and operating detail are generated automatically.
        </p>
        <Button disabled={!complete || !dirty || save.isPending || !data.canWrite} onClick={persist}>
          {save.isPending ? "Saving…" : dirty ? "Save Festival choices" : "Festival choices saved"}
        </Button>
      </div>
    </section>
  );
}

function ChoiceCard({
  icon,
  title,
  summary,
  open,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={open ? "border-primary/40" : ""}>
      <button type="button" className="flex w-full items-center gap-3 p-5 text-left" onClick={onClick}>
        <span className="rounded-md bg-muted p-2">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronRight className={`h-5 w-5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <CardContent className="border-t pt-5">{children}</CardContent> : null}
    </Card>
  );
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
  options: Array<{ key: string; displayName: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>{option.displayName}</SelectItem>
          ))}
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
