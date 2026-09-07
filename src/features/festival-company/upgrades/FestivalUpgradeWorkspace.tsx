import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronDown,
  Construction,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { FestivalOwnerNavigation } from "@/features/festivals/ui/FestivalOwnerNavigation";
import {
  applyFestivalCompanyLicence,
  getFestivalCompanyUpgrades,
  previewFestivalUpgrade,
  purchaseFestivalUpgrade,
} from "./repository";
import {
  FESTIVAL_LICENCE_MESSAGES,
  FESTIVAL_UPGRADE_MESSAGES,
  type FestivalLicenceProgress,
  type FestivalUpgradeCategory,
  type FestivalUpgradeKey,
  type FestivalUpgradePreview,
} from "./types";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(minor / 100);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );

const effectLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());

const upgradeQueryKey = (festivalCompanyId: string) => [
  "festival-company-upgrades",
  festivalCompanyId,
];

type UpgradeGroup = {
  key: string;
  title: string;
  description: string;
  icon: typeof Building2;
  categories: readonly FestivalUpgradeKey[];
};

const UPGRADE_GROUPS: readonly UpgradeGroup[] = [
  {
    key: "venue",
    title: "Venue & infrastructure",
    description: "Site capacity, stages, transport and the physical Festival footprint.",
    icon: Building2,
    categories: ["site_infrastructure", "stages_production", "transport_access"],
  },
  {
    key: "production",
    title: "Production & safety",
    description: "Security, welfare, sanitation and the systems that keep the event running.",
    icon: ShieldCheck,
    categories: ["security_crowd_control", "medical_welfare", "sanitation_utilities"],
  },
  {
    key: "commercial",
    title: "Commercial & marketing",
    description: "Audience reach, artist treatment and the Festival's commercial pull.",
    icon: Megaphone,
    categories: ["artist_backstage", "marketing_media"],
  },
  {
    key: "experience",
    title: "Audience experience",
    description: "Comfort, camping and sustainable technology that shape how fans remember the event.",
    icon: Users,
    categories: ["audience_facilities", "camping_accommodation", "sustainability_technology"],
  },
] as const;

export function FestivalUpgradeWorkspace({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const queryClient = useQueryClient();
  const [openGroup, setOpenGroup] = useState(UPGRADE_GROUPS[0].key);
  const [selectedKey, setSelectedKey] = useState<FestivalUpgradeKey | null>(null);
  const licenceRequest = useRef<{ signature: string; key: string } | null>(null);

  const query = useQuery({
    queryKey: upgradeQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyUpgrades(festivalCompanyId),
    enabled: Boolean(festivalCompanyId),
  });

  const selected =
    query.data?.categories.find((category) => category.key === selectedKey) ?? null;

  const preview = useQuery({
    queryKey: ["festival-upgrade-preview", festivalCompanyId, selected?.key],
    queryFn: () =>
      previewFestivalUpgrade({
        festivalCompanyId,
        categoryKey: selected!.key,
      }),
    enabled: Boolean(selected?.nextLevel),
  });

  const buy = useMutation({
    mutationFn: async (purchase: FestivalUpgradePreview) =>
      purchaseFestivalUpgrade({
        festivalCompanyId,
        categoryKey: purchase.category.key,
        nextLevel: purchase.category.nextLevel!,
        catalogueVersion: purchase.catalogueVersion,
        companyVersion: purchase.companyVersion,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async (state) => {
      setSelectedKey(null);
      queryClient.setQueryData(upgradeQueryKey(festivalCompanyId), state);
      await queryClient.invalidateQueries({ queryKey: upgradeQueryKey(festivalCompanyId) });
    },
  });

  const licence = useMutation({
    mutationFn: (input: {
      tierKey: string;
      licenceVersion: number;
      idempotencyKey: string;
    }) => applyFestivalCompanyLicence({ festivalCompanyId, ...input }),
    onSuccess: async (state) => {
      licenceRequest.current = null;
      queryClient.setQueryData(upgradeQueryKey(festivalCompanyId), state);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: upgradeQueryKey(festivalCompanyId) }),
        queryClient.invalidateQueries({ queryKey: ["festival-company-editions", festivalCompanyId] }),
      ]);
    },
  });

  const grouped = useMemo(() => {
    if (!query.data) return [];
    return UPGRADE_GROUPS.map((group) => ({
      ...group,
      items: group.categories
        .map((key) => query.data.categories.find((category) => category.key === key))
        .filter((value): value is FestivalUpgradeCategory => Boolean(value)),
    }));
  }, [query.data]);

  if (query.isLoading) return <main className="p-6" role="status">Loading Festival upgrades…</main>;
  if (query.error || !query.data) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Upgrades unavailable</h1>
        <p role="alert">
          {query.error instanceof Error ? query.error.message : "The server did not return the catalogue."}
        </p>
      </main>
    );
  }

  const purchaseWindow = query.data.purchaseWindow;
  const applyForLicence = () => {
    const target = query.data.licence.target;
    const action = query.data.licence.action;
    if (!target || !action || !query.data.licence.canApply) return;
    const signature = `${query.data.licence.licenceVersion}:${target.key}:${action}`;
    if (licenceRequest.current?.signature !== signature) {
      licenceRequest.current = { signature, key: crypto.randomUUID() };
    }
    licence.mutate({
      tierKey: target.key,
      licenceVersion: query.data.licence.licenceVersion,
      idempotencyKey: licenceRequest.current.key,
    });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <FestivalOwnerNavigation festivalCompanyId={festivalCompanyId} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Grow your Festival</h1>
          <p className="mt-1 text-muted-foreground">
            Improve four clear areas. The eleven detailed upgrade tracks still power the simulation underneath.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Company funds</span>
          <strong className="ml-2">{money(query.data.availableBalanceMinor)}</strong>
        </div>
      </header>

      <Licence
        data={query.data.licence}
        pending={licence.isPending}
        error={licence.error instanceof Error ? licence.error.message : null}
        onApply={applyForLicence}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
          <div>
            <p className="font-medium">Upgrade pace</p>
            <p className="text-muted-foreground">
              {purchaseWindow.remaining} purchase{purchaseWindow.remaining === 1 ? "" : "s"} available in the current {purchaseWindow.windowDays}-day window.
            </p>
          </div>
          {purchaseWindow.nextAvailableAt ? (
            <Badge variant="outline">Next slot {dateTime(purchaseWindow.nextAvailableAt)}</Badge>
          ) : (
            <Badge>Ready to upgrade</Badge>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Festival upgrade areas">
        {grouped.map((group) => {
          const Icon = group.icon;
          const active = openGroup === group.key;
          const totalOwned = group.items.reduce((sum, item) => sum + item.ownedLevel, 0);
          const totalMax = group.items.reduce((sum, item) => sum + item.maximumLevel, 0);
          const building = group.items.some((item) => item.status === "building");
          return (
            <Card key={group.key} className={active ? "border-primary/40" : undefined}>
              <button
                className="w-full p-5 text-left"
                aria-expanded={active}
                onClick={() => setOpenGroup(active ? "" : group.key)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><Icon className="h-5 w-5" /></div>
                    <div>
                      <h2 className="font-semibold">{group.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition ${active ? "rotate-180" : ""}`} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={totalMax ? (totalOwned / totalMax) * 100 : 0} className="h-2" />
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{totalOwned}/{totalMax}</span>
                  {building ? <Badge variant="secondary"><Construction className="mr-1 h-3 w-3" /> Building</Badge> : null}
                </div>
              </button>

              {active ? (
                <CardContent className="space-y-3 border-t pt-4">
                  {group.items.map((category) => {
                    const isSelected = selected?.key === category.key;
                    const currentPreview =
                      isSelected && preview.data?.category.key === category.key ? preview.data : undefined;
                    return (
                      <UpgradeTrack
                        key={category.key}
                        category={category}
                        selected={isSelected}
                        quotaAvailable={purchaseWindow.remaining > 0}
                        preview={currentPreview}
                        previewLoading={isSelected && preview.isLoading}
                        previewError={isSelected && preview.isError}
                        purchasePending={buy.isPending}
                        onToggle={() => setSelectedKey(isSelected ? null : category.key)}
                        onPurchase={() => currentPreview && buy.mutate(currentPreview)}
                      />
                    );
                  })}
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </section>

      {buy.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{buy.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </main>
  );
}

function UpgradeTrack({
  category,
  selected,
  quotaAvailable,
  preview,
  previewLoading,
  previewError,
  onToggle,
  onPurchase,
  purchasePending,
}: {
  category: FestivalUpgradeCategory;
  selected: boolean;
  quotaAvailable: boolean;
  preview: FestivalUpgradePreview | undefined;
  previewLoading: boolean;
  previewError: boolean;
  onToggle: () => void;
  onPurchase: () => void;
  purchasePending: boolean;
}) {
  const complete = category.nextLevel === null;
  return (
    <div className="rounded-lg border bg-background">
      <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={onToggle} aria-expanded={selected}>
        <div>
          <p className="font-medium">{category.displayName}</p>
          <p className="text-sm text-muted-foreground">
            Level {category.ownedLevel}/{category.maximumLevel} · {category.ownedLevel === 0 ? "Not installed" : category.bandName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {category.status === "building" ? <Construction className="h-4 w-4" /> : null}
          {complete ? <Badge variant="secondary">Max</Badge> : <ChevronDown className={`h-4 w-4 transition ${selected ? "rotate-180" : ""}`} />}
        </div>
      </button>

      {selected ? (
        <div className="space-y-3 border-t p-4 text-sm">
          <p>{category.description}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Effective level" value={String(category.effectiveLevel)} />
            <Stat label="Weekly upkeep" value={money(category.currentUpkeepMinor)} />
            <Stat label="Next milestone" value={category.nextMilestoneName ?? "Complete"} />
          </div>

          {category.delinquent ? (
            <p className="font-medium text-destructive">Upkeep is overdue, so this track is currently under-performing.</p>
          ) : null}

          {!complete ? (
            <>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="font-medium">Next level: {category.nextLevel}</p>
                <p className="text-muted-foreground">
                  {money(category.nextCostMinor!)} · {category.buildDurationHours}h construction · {money(category.nextUpkeepMinor!)} weekly upkeep
                </p>
              </div>

              {category.effectDelta ? (
                <div>
                  <p className="mb-1 font-medium">What improves</p>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {Object.entries(category.effectDelta)
                      .filter(([, value]) => value.kind === "number" ? value.delta !== 0 : value.changed)
                      .map(([key, value]) => (
                        <li key={key} className="text-muted-foreground">
                          {effectLabel(key)}: {String(value.current)} → {String(value.next)}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {previewLoading ? <p role="status">Checking purchase…</p> : null}
              {previewError ? <p role="alert" className="text-destructive">The upgrade quote could not be loaded.</p> : null}
              {preview ? (
                <>
                  {[...preview.reasonCodes, ...preview.category.missingRequirements.map((item) => item.code)].length ? (
                    <ul className="space-y-1 text-destructive">
                      {preview.reasonCodes.map((code) => <li key={code}>{FESTIVAL_UPGRADE_MESSAGES[code] ?? code}</li>)}
                      {preview.category.missingRequirements.map((item) => <li key={item.code}>{item.message}</li>)}
                    </ul>
                  ) : null}
                  <Button disabled={!preview.eligible || !quotaAvailable || purchasePending} onClick={onPurchase}>
                    {purchasePending ? "Purchasing…" : `Upgrade for ${money(category.nextCostMinor!)}`}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <p className="font-medium">This upgrade track is fully developed.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Licence({
  data,
  pending,
  error,
  onApply,
}: {
  data: FestivalLicenceProgress;
  pending: boolean;
  error: string | null;
  onApply: () => void;
}) {
  const target = data.target;
  const label =
    data.action === "renew"
      ? `Renew ${target?.name ?? "licence"}`
      : data.action === "upgrade"
        ? `Upgrade to ${target?.name ?? "next licence"}`
        : `Apply for ${target?.name ?? "licence"}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Festival licence</CardTitle>
            <CardDescription>Your licence sets the maximum scale of Festival you can operate.</CardDescription>
          </div>
          <Badge variant={data.current?.active ? "default" : "secondary"}>
            {data.current?.active ? `${data.current.name} active` : data.current ? `${data.current.name} ${data.current.status}` : "No active licence"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.current ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Attendance limit" value={data.current.maxAttendance.toLocaleString("en-GB")} />
            <Stat label="Maximum duration" value={`${data.current.maxDays} day(s)`} />
            <Stat label="Maximum stages" value={String(data.current.maxStages)} />
            <Stat label="Expiry" value={data.current.validUntil ? dateOnly(data.current.validUntil) : "No expiry"} />
          </div>
        ) : (
          <Alert><AlertDescription>Complete the Local licence requirements before launching an annual Festival.</AlertDescription></Alert>
        )}

        {target ? (
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{target.name} licence</h3>
                <p className="text-sm text-muted-foreground">Up to {target.maxAttendance.toLocaleString("en-GB")} people · {target.maxDays} day(s) · {target.maxStages} stage(s)</p>
              </div>
              <Badge variant="outline">{money(target.feeMinor)}</Badge>
            </div>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {data.requirements.map((requirement) => (
                <li className="flex gap-2" key={requirement.code}>
                  {requirement.complete ? <BadgeCheck className="mt-0.5 h-4 w-4" /> : <CalendarClock className="mt-0.5 h-4 w-4" />}
                  <span>{requirement.description} ({requirement.currentValue}/{requirement.requiredValue})</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Available: {money(data.availableBalanceMinor)}</span>
              <Button disabled={!data.canApply || pending} onClick={onApply}>{pending ? "Processing…" : label}</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4" /> Highest available licence reached.</div>
        )}

        {data.renewalOpensAt && data.action !== "renew" ? <p className="text-sm text-muted-foreground">Renewal opens {dateOnly(data.renewalOpensAt)}.</p> : null}
        {data.reasonCodes.length ? <ul className="text-sm text-muted-foreground">{data.reasonCodes.map((code) => <li key={code}>{FESTIVAL_LICENCE_MESSAGES[code] ?? code}</li>)}</ul> : null}
        {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
