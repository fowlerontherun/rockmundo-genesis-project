import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  Construction,
  ShieldCheck,
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
import { festivalRoutes } from "@/features/festivals/routes";
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
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());

const upgradeQueryKey = (festivalCompanyId: string) => [
  "festival-company-upgrades",
  festivalCompanyId,
];

export function FestivalUpgradeWorkspace({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const licenceRequest = useRef<{ signature: string; key: string } | null>(null);
  const query = useQuery({
    queryKey: upgradeQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyUpgrades(festivalCompanyId),
    enabled: Boolean(festivalCompanyId),
  });
  const selected =
    query.data?.categories.find((category) => category.key === selectedKey) ??
    null;
  const preview = useQuery({
    queryKey: [
      "festival-upgrade-preview",
      festivalCompanyId,
      selected?.key,
    ],
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
      await queryClient.invalidateQueries({
        queryKey: upgradeQueryKey(festivalCompanyId),
      });
    },
  });
  const licence = useMutation({
    mutationFn: (input: {
      tierKey: string;
      licenceVersion: number;
      idempotencyKey: string;
    }) =>
      applyFestivalCompanyLicence({
        festivalCompanyId,
        ...input,
      }),
    onSuccess: async (state) => {
      licenceRequest.current = null;
      queryClient.setQueryData(upgradeQueryKey(festivalCompanyId), state);
      await queryClient.invalidateQueries({
        queryKey: upgradeQueryKey(festivalCompanyId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["festival-company-editions", festivalCompanyId],
      });
    },
  });

  if (query.isLoading) {
    return (
      <main className="p-6" role="status">
        Loading authoritative upgrade catalogue…
      </main>
    );
  }
  if (query.error || !query.data) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Upgrades unavailable</h1>
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "The server did not return the catalogue."}
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
      licenceRequest.current = {
        signature,
        key: crypto.randomUUID(),
      };
    }
    licence.mutate({
      tierKey: target.key,
      licenceVersion: query.data.licence.licenceVersion,
      idempotencyKey: licenceRequest.current.key,
    });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <Link
        className="underline"
        to={festivalRoutes.company(festivalCompanyId)}
      >
        ← Festival company
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Upgrades and licence</h1>
        <p>
          Catalogue v{query.data.catalogueVersion}. Available company funds:{" "}
          {money(query.data.availableBalanceMinor)}.
        </p>
      </div>

      <Licence
        data={query.data.licence}
        pending={licence.isPending}
        error={licence.error instanceof Error ? licence.error.message : null}
        onApply={applyForLicence}
      />

      <Card>
        <CardHeader>
          <CardTitle>Rolling upgrade purchase window</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {purchaseWindow.used} of {purchaseWindow.limit} purchases used in the
            last {purchaseWindow.windowDays} days. {purchaseWindow.remaining}{" "}
            remaining.
          </p>
          {purchaseWindow.nextAvailableAt ? (
            <p className="font-medium">
              Next purchase available {dateTime(purchaseWindow.nextAvailableAt)}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-2 md:grid-cols-2">
        {query.data.categories.map((category) => {
          const isSelected = selected?.key === category.key;
          const currentPreview =
            isSelected && preview.data?.category.key === category.key
              ? preview.data
              : undefined;
          return (
            <UpgradeCard
              key={category.key}
              category={category}
              selected={isSelected}
              quotaAvailable={purchaseWindow.remaining > 0}
              onToggle={() =>
                setSelectedKey(isSelected ? null : category.key)
              }
              preview={currentPreview}
              previewLoading={isSelected && preview.isLoading}
              previewError={isSelected && preview.isError}
              onPurchase={() => {
                if (currentPreview) buy.mutate(currentPreview);
              }}
              purchasePending={buy.isPending}
            />
          );
        })}
      </div>
      {buy.error ? <p role="alert">{buy.error.message}</p> : null}
    </main>
  );
}

interface UpgradeCardProps {
  category: FestivalUpgradeCategory;
  selected: boolean;
  quotaAvailable: boolean;
  onToggle: () => void;
  preview: FestivalUpgradePreview | undefined;
  previewLoading: boolean;
  previewError: boolean;
  onPurchase: () => void;
  purchasePending: boolean;
}

export function UpgradeCard({
  category,
  selected,
  quotaAvailable,
  onToggle,
  preview,
  previewLoading,
  previewError,
  onPurchase,
  purchasePending,
}: UpgradeCardProps) {
  const complete = category.nextLevel === null;
  const bandProgress = Math.max(
    0,
    category.ownedLevel - category.bandStartLevel + 1,
  );
  return (
    <Card>
      <button
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={selected}
        onClick={onToggle}
      >
        <span>
          <strong>{category.displayName}</strong>
          <span className="block text-sm text-muted-foreground">
            {category.ownedLevel === 0
              ? "Not installed"
              : category.status === "building"
                ? "Under construction"
                : category.delinquent
                  ? "Delinquent"
                  : complete
                    ? "Maximum level"
                    : category.bandName}{" "}
            · effective level {category.effectiveLevel}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {category.status === "building" ? (
            <Construction aria-label="Under construction" />
          ) : null}
          <span
            aria-label={`${category.ownedLevel} of ${category.maximumLevel} levels`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={category.maximumLevel}
            aria-valuenow={category.ownedLevel}
          >
            Level {category.ownedLevel} of {category.maximumLevel}
          </span>
          <ChevronDown />
        </span>
      </button>
      {selected ? (
        <CardContent className="space-y-3 border-t pt-4">
          <p>{category.description}</p>
          <p>
            <strong>{category.bandName}</strong> · levels {category.bandStartLevel}
            –{category.bandEndLevel}
          </p>
          <div>
            <label className="text-sm">Current band progress</label>
            <progress
              className="block w-full"
              max={category.bandEndLevel - category.bandStartLevel + 1}
              value={bandProgress}
            />
          </div>
          <div>
            <label className="text-sm">Overall progress</label>
            <progress
              className="block w-full"
              max={category.maximumLevel}
              value={category.ownedLevel}
            />
          </div>
          <p>
            Current upkeep: {money(category.currentUpkeepMinor)} per week.
          </p>
          {category.delinquent ? (
            <p className="font-medium text-destructive">
              Upkeep is delinquent; effective benefits are reduced by one
              progression band.
            </p>
          ) : null}
          {complete ? (
            <p className="font-medium">
              Maximum level reached. No further purchase is available.
            </p>
          ) : (
            <>
              <p>
                Next milestone: {category.nextMilestoneName} at level{" "}
                {category.nextMilestoneLevel} ({category.levelsUntilMilestone}{" "}
                levels away).
              </p>
              <p>
                Next level: {category.nextLevel} · {money(category.nextCostMinor!)} ·
                upkeep {money(category.nextUpkeepMinor!)} weekly · construction{" "}
                {category.buildDurationHours} hours.
              </p>
              {category.effectDelta ? (
                <ul aria-label="Effect changes">
                  {Object.entries(category.effectDelta).map(([key, value]) => (
                    <li key={key}>
                      {effectLabel(key)}: {String(value.current)} →{" "}
                      {String(value.next)} ({value.kind === "number"
                        ? `${value.delta >= 0 ? "+" : ""}${value.delta}`
                        : value.changed
                          ? "changes"
                          : "unchanged"})
                    </li>
                  ))}
                </ul>
              ) : null}
              {previewLoading ? (
                <p role="status">Loading server quote…</p>
              ) : previewError ? (
                <p role="alert">The server quote could not be loaded.</p>
              ) : preview ? (
                <>
                  <ul aria-label="Purchase blockers">
                    {preview.reasonCodes.map((code) => (
                      <li key={code} className="text-destructive">
                        {FESTIVAL_UPGRADE_MESSAGES[code] ?? code}
                      </li>
                    ))}
                    {preview.category.missingRequirements.map((item) => (
                      <li key={item.code} className="text-destructive">
                        {item.message}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Balance after purchase: {money(preview.remainingBalanceMinor)}.
                    Purchases are final.
                  </p>
                  <Button
                    disabled={
                      !preview.eligible ||
                      !quotaAvailable ||
                      purchasePending
                    }
                    onClick={onPurchase}
                  >
                    {purchasePending ? "Purchasing…" : "Purchase next level"}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
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
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Festival licence
            </CardTitle>
            <CardDescription>
              One company-level licence controls maximum Festival size and
              duration. The fee is charged from company funds; permits and
              insurance are automatic simulation details.
            </CardDescription>
          </div>
          <Badge variant={data.current?.active ? "default" : "secondary"}>
            {data.current?.active
              ? `${data.current.name} active`
              : data.current
                ? `${data.current.name} ${data.current.status}`
                : "No active licence"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.current ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <LicenceStat
              label="Attendance limit"
              value={data.current.maxAttendance.toLocaleString("en-GB")}
            />
            <LicenceStat
              label="Maximum duration"
              value={`${data.current.maxDays} day(s)`}
            />
            <LicenceStat
              label="Maximum stages"
              value={String(data.current.maxStages)}
            />
            <LicenceStat
              label="Expiry"
              value={
                data.current.validUntil
                  ? dateOnly(data.current.validUntil)
                  : "No expiry"
              }
            />
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Complete the Local licence requirements to unlock annual Festival
              launch readiness.
            </AlertDescription>
          </Alert>
        )}

        {target ? (
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{target.name} licence</h3>
                <p className="text-sm text-muted-foreground">
                  Up to {target.maxAttendance.toLocaleString("en-GB")} attendees ·{" "}
                  {target.maxDays} day(s) · {target.maxStages} stage(s)
                </p>
              </div>
              <Badge variant="outline">{money(target.feeMinor)}</Badge>
            </div>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {data.requirements.map((requirement) => (
                <li className="flex items-start gap-2" key={requirement.code}>
                  {requirement.complete ? (
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {requirement.description} ({requirement.currentValue}/
                    {requirement.requiredValue})
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Available company funds: {money(data.availableBalanceMinor)}
              </p>
              <Button disabled={!data.canApply || pending} onClick={onApply}>
                {pending ? "Processing licence…" : label}
              </Button>
            </div>
          </div>
        ) : null}

        {data.renewalOpensAt && data.action !== "renew" ? (
          <p className="text-sm text-muted-foreground">
            Renewal becomes available {dateOnly(data.renewalOpensAt)}.
          </p>
        ) : null}

        {data.reasonCodes.length ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.reasonCodes.map((code) => (
              <li key={code}>{FESTIVAL_LICENCE_MESSAGES[code] ?? code}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LicenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
