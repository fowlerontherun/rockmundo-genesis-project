import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, MapPin, Sparkles, Tent } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { festivalRoutes } from "@/features/festivals/routes";
import {
  useFestivalConfiguration,
  useSaveFestivalConfiguration,
} from "../application/useFestivalConfiguration";
import type {
  FestivalCatalogueOption,
  FestivalCity,
  FestivalConfigurationDraft,
  FestivalScaleOption,
} from "../domain/festivalConfiguration";
import {
  FestivalConfigurationError,
  festivalConfigurationErrorMessage,
} from "../domain/festivalConfigurationErrors";
import {
  validateFestivalDraft,
  type FieldValidation,
} from "../domain/festivalConfigurationValidation";
import { FestivalConflictAlert } from "./FestivalConflictAlert";
import { FestivalSaveStatus } from "./FestivalSaveStatus";
import { useFestivalConfigurationDraft } from "./useFestivalConfigurationDraft";

const compactSteps = [
  {
    id: 1,
    title: "Festival identity",
    description: "Name and describe the permanent Festival company brand.",
  },
  {
    id: 2,
    title: "Festival defaults",
    description: "Choose the usual location, month, vibe and operating style.",
  },
  {
    id: 3,
    title: "First annual Festival",
    description: "Seed the first event with a size and date. You can refine it on Plan.",
  },
  {
    id: 4,
    title: "Review & create",
    description: "Create the first annual edition and continue straight to Plan.",
  },
] as const;

type CompactStep = (typeof compactSteps)[number]["id"];

const compactStepFromServer = (currentStep: number): CompactStep => {
  if (currentStep <= 1) return 1;
  if (currentStep <= 3) return 2;
  if (currentStep <= 5) return 3;
  return 4;
};

const serverStepFromCompact = (step: CompactStep) =>
  step === 1 ? 1 : step === 2 ? 3 : step === 3 ? 5 : 6;

const addDays = (startDate: string, durationDays: number) => {
  if (!startDate) return null;
  const date = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Math.max(0, durationDays - 1));
  return date.toISOString().slice(0, 10);
};

const monthName = (month: number | null) =>
  month
    ? new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
        new Date(Date.UTC(2026, month - 1, 1)),
      )
    : "Not selected";

const FieldError = ({
  state,
  show,
}: {
  state: FieldValidation;
  show: boolean;
}) =>
  show && !state.valid ? (
    <p className="text-sm text-destructive">{state.message}</p>
  ) : null;

const NativeSelect = ({
  id,
  label,
  value,
  disabled,
  placeholder,
  options,
  validation,
  showError,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  validation: FieldValidation;
  showError: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <select
      id={id}
      className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
      disabled={disabled}
      value={value}
      aria-invalid={showError && !validation.valid}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <FieldError state={validation} show={showError} />
  </div>
);

export function FestivalConfigurationWizard({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const navigate = useNavigate();
  const query = useFestivalConfiguration(festivalCompanyId);
  const save = useSaveFestivalConfiguration();
  const { draft, setDraft, dirty, version, acceptCanonical } =
    useFestivalConfigurationDraft(query.data);
  const [conflict, setConflict] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !dirty ||
        !anchor ||
        anchor.target ||
        anchor.origin !== window.location.origin
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(anchor.href);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [dirty]);

  if (query.isLoading) return <p role="status">Loading Festival setup…</p>;

  if (query.isError || !query.data || !draft) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="space-y-3">
          <p>{festivalConfigurationErrorMessage(query.error)}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Retrying…" : "Try again"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const configuration = query.data;
  const validation = validateFestivalDraft(
    draft,
    configuration.cities,
    configuration.scales,
  );
  const step = compactStepFromServer(draft.currentStep);
  const selectedScale = configuration.scales.find(
    (scale) => scale.key === draft.festivalScale,
  );
  const selectedCity = configuration.cities.find(
    (city) => city.id === draft.homeCityId,
  );
  const selectedVibe = configuration.vibes.find(
    (option) => option.key === draft.vibe,
  );
  const selectedSite = configuration.siteTypes.find(
    (option) => option.key === draft.siteType,
  );
  const selectedEnvironment = configuration.environmentalPolicies.find(
    (option) => option.key === draft.environmentalPolicy,
  );
  const durationDays = validation.durationDays ?? 1;
  const canWrite = configuration.canWrite;

  const patch = (values: Partial<FestivalConfigurationDraft>) =>
    setDraft({ ...draft, ...values });

  const defaultsValid =
    validation.fields.homeCityId.valid &&
    validation.fields.annualMonth.valid &&
    validation.fields.vibe.valid &&
    validation.fields.siteType.valid &&
    validation.fields.environmentalPolicy.valid;
  const firstEditionValid =
    validation.fields.festivalScale.valid && validation.datesValid;
  const stepValid =
    step === 1
      ? validation.identityValid
      : step === 2
        ? defaultsValid
        : step === 3
          ? firstEditionValid
          : validation.allValid;

  const errorsForStep = () => {
    const fields = validation.fields;
    const selected =
      step === 1
        ? [fields.publicName, fields.shortName, fields.tagline, fields.description]
        : step === 2
          ? [
              fields.homeCityId,
              fields.annualMonth,
              fields.vibe,
              fields.siteType,
              fields.environmentalPolicy,
            ]
          : step === 3
            ? [fields.festivalScale, fields.plannedStartDate, fields.plannedEndDate]
            : Object.values(fields);
    return selected.filter((field) => !field.valid);
  };

  const persist = (targetStep: CompactStep, complete = false) => {
    if (!canWrite || save.isPending) return;
    if (!stepValid || (complete && !validation.allValid)) {
      setAttempted(true);
      return;
    }

    const nextDraft: FestivalConfigurationDraft = {
      ...draft,
      currentStep: serverStepFromCompact(targetStep),
      complete,
    };
    const payload = JSON.stringify(nextDraft);
    if (!requestRef.current || requestRef.current.payload !== payload) {
      requestRef.current = { payload, key: crypto.randomUUID() };
    }

    setConflict(false);
    setSaveFailed(false);
    save.mutate(
      {
        festivalCompanyId,
        expectedVersion: version.current,
        configuration: nextDraft,
        idempotencyKey: requestRef.current.key,
      },
      {
        onSuccess: (canonical) => {
          acceptCanonical(canonical);
          setSavedAt(canonical.updatedAt ?? new Date().toISOString());
          setConflict(false);
          setSaveFailed(false);
          setAttempted(false);
          requestRef.current = null;

          if (complete && canonical.festivalEditionId) {
            navigate(
              festivalRoutes.edition(
                festivalCompanyId,
                canonical.festivalEditionId,
              ),
            );
          }
        },
        onError: (error) => {
          if (
            error instanceof FestivalConfigurationError &&
            error.code === "festival_configuration_stale"
          ) {
            setConflict(true);
          } else {
            setSaveFailed(true);
          }
        },
      },
    );
  };

  const reloadLatest = async () => {
    const result = await query.refetch();
    if (!result.data) return;
    acceptCanonical(result.data);
    setConflict(false);
    setSaveFailed(false);
    requestRef.current = null;
  };

  const progress = ((step - 1) / (compactSteps.length - 1)) * 100;

  return (
    <section className="space-y-6" aria-labelledby="festival-setup-title">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle id="festival-setup-title" className="flex items-center gap-2">
            <Tent className="h-5 w-5" /> Set up your Festival company
          </CardTitle>
          <CardDescription>
            Set the permanent brand and sensible defaults, then seed the first
            annual Festival. After setup you will manage each year through the
            simpler Plan → Line-up → Tickets & budget → Run Festival → Results flow.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canWrite ? (
        <Alert>
          <AlertDescription>
            This setup is read-only. An authorised company owner or manager can
            make changes.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3" aria-label="Festival setup progress">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {compactSteps.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-md border p-3 text-left text-sm transition-colors ${
                item.id === step
                  ? "border-primary bg-primary/10"
                  : item.id < step
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "bg-card"
              }`}
              disabled={item.id > step || save.isPending}
              onClick={() =>
                patch({ currentStep: serverStepFromCompact(item.id) })
              }
            >
              <span className="flex items-center gap-2 font-medium">
                {item.id < step ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                    {item.id}
                  </span>
                )}
                {item.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <FestivalSaveStatus
        pending={save.isPending}
        conflict={conflict}
        dirty={dirty}
        failed={saveFailed}
        readOnly={!canWrite}
        savedAt={savedAt}
      />

      {conflict ? (
        <FestivalConflictAlert
          loading={query.isFetching}
          onReload={reloadLatest}
          onKeep={() => setConflict(false)}
        />
      ) : null}

      {saveFailed ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {festivalConfigurationErrorMessage(save.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {attempted && errorsForStep().length > 0 ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <p className="font-medium">Finish these fields before continuing:</p>
            <ul className="mt-2 list-disc pl-5">
              {errorsForStep().map((field, index) => (
                <li key={`${field.code ?? "field"}-${index}`}>{field.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {step === 1 ? (
        <IdentityStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          validation={validation.fields}
          patch={patch}
        />
      ) : null}

      {step === 2 ? (
        <DefaultsStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          cities={configuration.cities}
          vibes={configuration.vibes}
          siteTypes={configuration.siteTypes}
          environmentalPolicies={configuration.environmentalPolicies}
          validation={validation.fields}
          patch={patch}
        />
      ) : null}

      {step === 3 ? (
        <FirstEditionStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          scales={configuration.scales}
          selectedScale={selectedScale}
          durationDays={durationDays}
          validation={validation.fields}
          patch={patch}
        />
      ) : null}

      {step === 4 ? (
        <ReviewStep
          draft={draft}
          legalCompanyName={configuration.legalCompanyName}
          city={selectedCity}
          vibe={selectedVibe}
          site={selectedSite}
          environment={selectedEnvironment}
          scale={selectedScale}
          durationDays={durationDays}
        />
      ) : null}

      {canWrite ? (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            disabled={step === 1 || save.isPending}
            onClick={() =>
              patch({
                currentStep: serverStepFromCompact((step - 1) as CompactStep),
              })
            }
          >
            Back
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending || !dirty}
            onClick={() => persist(step)}
          >
            Save draft
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => persist((step + 1) as CompactStep)}
            >
              Save and continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => persist(4, true)}
            >
              Finish setup & open Plan
            </Button>
          )}
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved Festival changes.</AlertDialogTitle>
            <AlertDialogDescription>
              Discard these changes and leave this page?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay and continue editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingNavigation) window.location.assign(pendingNavigation);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function IdentityStep({
  draft,
  disabled,
  attempted,
  validation,
  patch,
}: {
  draft: FestivalConfigurationDraft;
  disabled: boolean;
  attempted: boolean;
  validation: ReturnType<typeof validateFestivalDraft>["fields"];
  patch: (values: Partial<FestivalConfigurationDraft>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Festival identity
        </CardTitle>
        <CardDescription>
          This is the permanent public brand. Annual Festivals will inherit the
          name but keep their own dates, line-up and results.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <TextInput
          id="festival-public-name"
          label="Public Festival name"
          value={draft.publicName}
          maxLength={80}
          disabled={disabled}
          validation={validation.publicName}
          showError={attempted}
          onChange={(publicName) => patch({ publicName })}
        />
        <TextInput
          id="festival-short-name"
          label="Short name"
          value={draft.shortName}
          maxLength={24}
          disabled={disabled}
          validation={validation.shortName}
          showError={attempted}
          onChange={(shortName) => patch({ shortName })}
        />
        <TextInput
          id="festival-tagline"
          label="Tagline"
          value={draft.tagline}
          maxLength={120}
          disabled={disabled}
          validation={validation.tagline}
          showError={attempted}
          onChange={(tagline) => patch({ tagline })}
        />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="festival-description">Description</Label>
          <Textarea
            id="festival-description"
            value={draft.description}
            maxLength={1000}
            disabled={disabled}
            onChange={(event) => patch({ description: event.target.value })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Describe the Festival for players and artists.</span>
            <span>{draft.description.length}/1000</span>
          </div>
          <FieldError state={validation.description} show={attempted} />
        </div>
      </CardContent>
    </Card>
  );
}

function DefaultsStep({
  draft,
  disabled,
  attempted,
  cities,
  vibes,
  siteTypes,
  environmentalPolicies,
  validation,
  patch,
}: {
  draft: FestivalConfigurationDraft;
  disabled: boolean;
  attempted: boolean;
  cities: FestivalCity[];
  vibes: FestivalCatalogueOption[];
  siteTypes: FestivalCatalogueOption[];
  environmentalPolicies: FestivalCatalogueOption[];
  validation: ReturnType<typeof validateFestivalDraft>["fields"];
  patch: (values: Partial<FestivalConfigurationDraft>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Festival defaults
        </CardTitle>
        <CardDescription>
          These are starting preferences for future annual Festivals, not locked
          operating rules. Each year's Plan can change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <NativeSelect
          id="festival-home-city"
          label="Home city"
          value={draft.homeCityId ?? ""}
          disabled={disabled}
          placeholder="Choose a city"
          options={cities.map((city) => ({
            value: city.id,
            label: `${city.name}, ${city.country}`,
          }))}
          validation={validation.homeCityId}
          showError={attempted}
          onChange={(homeCityId) => patch({ homeCityId: homeCityId || null })}
        />
        <NativeSelect
          id="festival-annual-month"
          label="Usual Festival month"
          value={draft.annualMonth ? String(draft.annualMonth) : ""}
          disabled={disabled}
          placeholder="Choose a month"
          options={Array.from({ length: 12 }, (_, index) => ({
            value: String(index + 1),
            label: monthName(index + 1),
          }))}
          validation={validation.annualMonth}
          showError={attempted}
          onChange={(annualMonth) =>
            patch({ annualMonth: annualMonth ? Number(annualMonth) : null })
          }
        />
        <NativeSelect
          id="festival-default-vibe"
          label="Default vibe"
          value={draft.vibe ?? ""}
          disabled={disabled}
          placeholder="Choose a vibe"
          options={vibes.map((option) => ({
            value: option.key,
            label: option.displayName,
          }))}
          validation={validation.vibe}
          showError={attempted}
          onChange={(vibe) =>
            patch({ vibe: (vibe || null) as FestivalConfigurationDraft["vibe"] })
          }
        />
        <NativeSelect
          id="festival-default-site"
          label="Default site style"
          value={draft.siteType ?? ""}
          disabled={disabled}
          placeholder="Choose a site style"
          options={siteTypes.map((option) => ({
            value: option.key,
            label: option.displayName,
          }))}
          validation={validation.siteType}
          showError={attempted}
          onChange={(siteType) =>
            patch({
              siteType: (siteType || null) as FestivalConfigurationDraft["siteType"],
            })
          }
        />
        <div className="sm:col-span-2">
          <NativeSelect
            id="festival-environment"
            label="Environmental approach"
            value={draft.environmentalPolicy ?? ""}
            disabled={disabled}
            placeholder="Choose an approach"
            options={environmentalPolicies.map((option) => ({
              value: option.key,
              label: `${option.displayName} — ${option.description}`,
            }))}
            validation={validation.environmentalPolicy}
            showError={attempted}
            onChange={(environmentalPolicy) =>
              patch({
                environmentalPolicy: (environmentalPolicy ||
                  null) as FestivalConfigurationDraft["environmentalPolicy"],
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FirstEditionStep({
  draft,
  disabled,
  attempted,
  scales,
  selectedScale,
  durationDays,
  validation,
  patch,
}: {
  draft: FestivalConfigurationDraft;
  disabled: boolean;
  attempted: boolean;
  scales: FestivalScaleOption[];
  selectedScale?: FestivalScaleOption;
  durationDays: number;
  validation: ReturnType<typeof validateFestivalDraft>["fields"];
  patch: (values: Partial<FestivalConfigurationDraft>) => void;
}) {
  const maximumDuration = selectedScale?.maximumDurationDays ?? 1;
  const currentDuration = Math.min(durationDays, maximumDuration);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          This step only seeds your first annual Festival. After setup you go
          straight to <strong>Plan</strong>, where the date, city, site style,
          size, duration, vibe and marketing can be refined before anything is
          launched.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> First annual Festival
          </CardTitle>
          <CardDescription>
            Choose an initial size and date so the first annual edition can be
            created. Detailed operations are generated automatically later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <NativeSelect
            id="festival-initial-scale"
            label="Initial Festival size"
            value={draft.festivalScale ?? ""}
            disabled={disabled}
            placeholder="Choose a size"
            options={scales.map((scale) => ({
              value: scale.key,
              label: `${scale.displayName} · up to ${scale.maximumCapacity.toLocaleString("en-GB")}`,
            }))}
            validation={validation.festivalScale}
            showError={attempted}
            onChange={(festivalScale) => {
              const nextScale = scales.find((scale) => scale.key === festivalScale);
              const nextDuration = Math.min(
                currentDuration,
                nextScale?.maximumDurationDays ?? 1,
              );
              patch({
                festivalScale:
                  (festivalScale || null) as FestivalConfigurationDraft["festivalScale"],
                plannedEndDate: draft.plannedStartDate
                  ? addDays(draft.plannedStartDate, nextDuration)
                  : draft.plannedEndDate,
              });
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="festival-first-date">First Festival start date</Label>
            <Input
              id="festival-first-date"
              type="date"
              min={today}
              disabled={disabled}
              value={draft.plannedStartDate ?? ""}
              aria-invalid={attempted && !validation.plannedStartDate.valid}
              onChange={(event) => {
                const plannedStartDate = event.target.value || null;
                const month = plannedStartDate
                  ? new Date(`${plannedStartDate}T12:00:00.000Z`).getUTCMonth() + 1
                  : draft.annualMonth;
                patch({
                  plannedStartDate,
                  annualMonth: month,
                  plannedEndDate: plannedStartDate
                    ? addDays(plannedStartDate, currentDuration)
                    : null,
                });
              }}
            />
            <FieldError state={validation.plannedStartDate} show={attempted} />
          </div>
          <NativeSelect
            id="festival-first-duration"
            label="Initial duration"
            value={String(currentDuration)}
            disabled={disabled || !selectedScale}
            placeholder="Choose duration"
            options={Array.from({ length: maximumDuration }, (_, index) => ({
              value: String(index + 1),
              label: `${index + 1} day${index === 0 ? "" : "s"}`,
            }))}
            validation={validation.plannedEndDate}
            showError={attempted}
            onChange={(duration) =>
              patch({
                plannedEndDate: draft.plannedStartDate
                  ? addDays(draft.plannedStartDate, Number(duration))
                  : null,
              })
            }
          />
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p className="font-medium">First event preview</p>
            <p className="mt-2 text-muted-foreground">
              {draft.plannedStartDate && draft.plannedEndDate
                ? `${draft.plannedStartDate} → ${draft.plannedEndDate}`
                : "Choose a start date and duration."}
            </p>
            {selectedScale ? (
              <p className="mt-1 text-muted-foreground">
                {selectedScale.displayName} · {selectedScale.minimumCapacity.toLocaleString("en-GB")}–{selectedScale.maximumCapacity.toLocaleString("en-GB")} base capacity
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewStep({
  draft,
  legalCompanyName,
  city,
  vibe,
  site,
  environment,
  scale,
  durationDays,
}: {
  draft: FestivalConfigurationDraft;
  legalCompanyName: string;
  city?: FestivalCity;
  vibe?: FestivalCatalogueOption;
  site?: FestivalCatalogueOption;
  environment?: FestivalCatalogueOption;
  scale?: FestivalScaleOption;
  durationDays: number;
}) {
  const summary = [
    ["Public Festival", draft.publicName],
    ["Legal company", legalCompanyName],
    ["Home city", city ? `${city.name}, ${city.country}` : "Not selected"],
    ["Usual month", monthName(draft.annualMonth)],
    ["Default vibe", vibe?.displayName ?? "Not selected"],
    ["Default site", site?.displayName ?? "Not selected"],
    ["Environmental approach", environment?.displayName ?? "Not selected"],
    ["First Festival size", scale?.displayName ?? "Not selected"],
    [
      "First Festival dates",
      draft.plannedStartDate && draft.plannedEndDate
        ? `${draft.plannedStartDate} → ${draft.plannedEndDate} (${durationDays} day${durationDays === 1 ? "" : "s"})`
        : "Not selected",
    ],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Ready to create
          </CardTitle>
          <CardDescription>
            This creates the permanent Festival company setup and its first draft
            annual edition. It does not announce or run the Festival.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">{label}</p>
              <p className="mt-1 font-medium">{value || "—"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Alert>
        <AlertDescription>
          After you finish, RockMundo opens the first annual <strong>Plan</strong>
          screen. That is the normal place to manage this year's Festival choices;
          you will not return to this company setup wizard for yearly planning.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  maxLength,
  disabled,
  validation,
  showError,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  disabled: boolean;
  validation: FieldValidation;
  showError: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={showError && !validation.valid}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex justify-end text-xs text-muted-foreground">
        {value.length}/{maxLength}
      </div>
      <FieldError state={validation} show={showError} />
    </div>
  );
}
