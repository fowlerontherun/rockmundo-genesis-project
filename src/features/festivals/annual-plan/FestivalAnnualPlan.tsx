import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Megaphone,
  Sparkles,
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
import { Progress } from "@/components/ui/progress";
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
  type FestivalAnnualPlanDraft,
} from "./model";
import {
  festivalAnnualPlanQueryKey,
  getFestivalAnnualPlan,
  saveFestivalAnnualPlan,
} from "./repository";

const months = new Intl.DateTimeFormat("en-GB", { month: "long" });
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: months.format(new Date(Date.UTC(2026, index, 1))),
}));

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

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
      toast.success("Annual Festival plan saved");
    },
  });

  if (query.isLoading) {
    return <p role="status">Loading annual Festival choices…</p>;
  }

  if (query.error || !query.data || !draft) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          The annual Festival plan could not be loaded. Check company access and
          try again.
        </AlertDescription>
      </Alert>
    );
  }

  const data = query.data;
  const selectedScale = data.scales.find(
    (option) => option.key === draft.festivalScale,
  );
  const selectedMarketing = data.marketingEmphases.find(
    (option) => option.key === draft.marketingEmphasis,
  );
  const endDate = calculateAnnualPlanEndDate(
    draft.startsOn,
    draft.durationDays,
  );
  const complete = annualPlanDraftIsComplete(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(annualPlanToDraft(data));
  const currentDate = new Date().toISOString().slice(0, 10);
  const monthMismatch = Boolean(
    draft.startsOn &&
      new Date(`${draft.startsOn}T12:00:00.000Z`).getUTCMonth() + 1 !==
        draft.preferredMonth,
  );

  const localPreview = useMemo(() => {
    if (!selectedScale) return null;
    return {
      capacityRange: `${selectedScale.minimumCapacity.toLocaleString("en-GB")}–${selectedScale.maximumCapacity.toLocaleString("en-GB")}`,
      maximumDuration: selectedScale.maximumDurationDays,
      demandEffect: selectedMarketing
        ? Math.round((selectedMarketing.demandBasisPoints - 10000) / 100)
        : 0,
      costEffect: selectedMarketing
        ? Math.round((selectedMarketing.costBasisPoints - 10000) / 100)
        : 0,
    };
  }, [selectedMarketing, selectedScale]);

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

  return (
    <section className="space-y-5" aria-labelledby="annual-plan-heading">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="annual-plan-heading" className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> Annual Festival choices
              </CardTitle>
              <CardDescription>
                Choose the place, dates, size, vibe and promotion. Company
                upgrades automatically determine capacity, efficiency and event
                quality.
              </CardDescription>
            </div>
            <Badge
              variant={data.planningStatus === "ready" ? "default" : "secondary"}
              className="capitalize"
            >
              {data.planningStatus.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Plan {data.name}</CardTitle>
            <CardDescription>
              These choices belong only to game year {data.editionYear}. The
              Festival company and its eleven upgrades carry forward every year.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="festival-month">Festival month</Label>
              <Select
                value={String(draft.preferredMonth)}
                disabled={!data.editable}
                onValueChange={(value) =>
                  setDraft((current) =>
                    current
                      ? { ...current, preferredMonth: Number(value) }
                      : current,
                  )
                }
              >
                <SelectTrigger id="festival-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-start-date">Start date</Label>
              <Input
                id="festival-start-date"
                type="date"
                min={currentDate}
                disabled={!data.editable}
                value={draft.startsOn}
                onChange={(event) => {
                  const value = event.target.value;
                  const selected = value
                    ? new Date(`${value}T12:00:00.000Z`).getUTCMonth() + 1
                    : draft.preferredMonth;
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          startsOn: value,
                          preferredMonth: selected,
                        }
                      : current,
                  );
                }}
              />
              <p className="text-xs text-muted-foreground">
                Ends {endDate ?? "after the selected duration"}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-city">City</Label>
              <Select
                value={draft.cityId}
                disabled={!data.editable}
                onValueChange={(cityId) =>
                  setDraft((current) =>
                    current ? { ...current, cityId } : current,
                  )
                }
              >
                <SelectTrigger id="festival-city">
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {data.cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}, {city.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-site-style">Site style</Label>
              <Select
                value={draft.siteType}
                disabled={!data.editable}
                onValueChange={(siteType) =>
                  setDraft((current) =>
                    current ? { ...current, siteType } : current,
                  )
                }
              >
                <SelectTrigger id="festival-site-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.siteTypes.map((site) => (
                    <SelectItem key={site.key} value={site.key}>
                      {site.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-scale">Festival size</Label>
              <Select
                value={draft.festivalScale}
                disabled={!data.editable}
                onValueChange={(festivalScale) => {
                  const nextScale = data.scales.find(
                    (option) => option.key === festivalScale,
                  );
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          festivalScale,
                          durationDays: Math.min(
                            current.durationDays,
                            nextScale?.maximumDurationDays ?? 1,
                          ),
                        }
                      : current,
                  );
                }}
              >
                <SelectTrigger id="festival-scale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.scales.map((scale) => (
                    <SelectItem key={scale.key} value={scale.key}>
                      {scale.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {localPreview ? (
                <p className="text-xs text-muted-foreground">
                  Base capacity range {localPreview.capacityRange}.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-duration">Duration</Label>
              <Select
                value={String(draft.durationDays)}
                disabled={!data.editable}
                onValueChange={(value) =>
                  setDraft((current) =>
                    current
                      ? { ...current, durationDays: Number(value) }
                      : current,
                  )
                }
              >
                <SelectTrigger id="festival-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: selectedScale?.maximumDurationDays ?? 1 },
                    (_, index) => index + 1,
                  ).map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} day{days === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-vibe">Festival vibe</Label>
              <Select
                value={draft.vibe}
                disabled={!data.editable}
                onValueChange={(vibe) =>
                  setDraft((current) =>
                    current ? { ...current, vibe } : current,
                  )
                }
              >
                <SelectTrigger id="festival-vibe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.vibes.map((vibe) => (
                    <SelectItem key={vibe.key} value={vibe.key}>
                      {vibe.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-marketing">Marketing emphasis</Label>
              <Select
                value={draft.marketingEmphasis}
                disabled={!data.editable}
                onValueChange={(marketingEmphasis) =>
                  setDraft((current) =>
                    current ? { ...current, marketingEmphasis } : current,
                  )
                }
              >
                <SelectTrigger id="festival-marketing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.marketingEmphases.map((marketing) => (
                    <SelectItem key={marketing.key} value={marketing.key}>
                      {marketing.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMarketing ? (
                <p className="text-xs text-muted-foreground">
                  {selectedMarketing.description}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server projection</CardTitle>
              <CardDescription>
                Recalculated after saving from the permanent company upgrades and
                active licence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Projection
                icon={<Users className="h-4 w-4" />}
                label="Expected capacity"
                value={
                  data.expectedCapacity?.toLocaleString("en-GB") ??
                  "Save to calculate"
                }
              />
              <Projection
                icon={<WalletCards className="h-4 w-4" />}
                label="Estimated operating cost"
                value={
                  data.estimatedOperatingCostMinor
                    ? money(data.estimatedOperatingCostMinor)
                    : "Save to calculate"
                }
              />
              <Projection
                icon={<MapPin className="h-4 w-4" />}
                label="Current location"
                value={
                  data.city
                    ? `${data.city.name}, ${data.city.country}`
                    : "Not saved"
                }
              />
              <Projection
                icon={<Megaphone className="h-4 w-4" />}
                label="Marketing demand effect"
                value={
                  localPreview
                    ? `${localPreview.demandEffect >= 0 ? "+" : ""}${localPreview.demandEffect}%`
                    : "—"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Festival readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Readiness</span>
                <strong>{data.readinessScore}%</strong>
              </div>
              <Progress value={data.readinessScore} />
              <p className="text-sm text-muted-foreground">
                Upgrade levels influence capacity and reduce operating cost.
                Licence limits can still block launch without blocking planning.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {monthMismatch ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The start date must fall in the selected Festival month.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.blockers.length ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{data.blockers.length} launch readiness item(s):</strong>
            <ul className="mt-2 space-y-1">
              {data.blockers.map((blocker) => (
                <li key={blocker.code}>• {blocker.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : data.planningStatus === "ready" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" /> The high-level annual plan is
          ready for line-up and ticket choices.
        </p>
      ) : null}

      {save.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            The annual plan could not be saved. {save.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
        <span role="status" className="text-sm text-muted-foreground">
          {save.isPending
            ? "Saving and recalculating…"
            : dirty
              ? "Unsaved annual Festival choices"
              : "Annual Festival choices saved"}
        </span>
        <Button
          disabled={
            !complete ||
            !dirty ||
            save.isPending ||
            !data.canWrite ||
            monthMismatch
          }
          onClick={persist}
        >
          Save annual plan
        </Button>
      </div>
    </section>
  );
}

function Projection({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <strong className="text-right text-sm">{value}</strong>
    </div>
  );
}
