/* eslint-disable @typescript-eslint/no-explicit-any -- compact typed step boundaries are validated by the shared domain validator */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useFestivalConfiguration,
  useSaveFestivalConfiguration,
} from "../application/useFestivalConfiguration";
import {
  FestivalConfigurationError,
  festivalConfigurationErrorMessage,
} from "../domain/festivalConfigurationErrors";
import {
  maximumReachableStep,
  validateFestivalDraft,
  type FieldValidation,
} from "../domain/festivalConfigurationValidation";
import type { FestivalConfigurationDraft } from "../domain/festivalConfiguration";
import { FestivalWizardProgress } from "./FestivalWizardProgress";
import { FestivalSaveStatus } from "./FestivalSaveStatus";
import { FestivalConflictAlert } from "./FestivalConflictAlert";
import { useFestivalConfigurationDraft } from "./useFestivalConfigurationDraft";

export function FestivalConfigurationWizard({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const query = useFestivalConfiguration(festivalCompanyId);
  const save = useSaveFestivalConfiguration();
  const { draft, setDraft, dirty, version, acceptCanonical } =
    useFestivalConfigurationDraft(query.data);
  const [conflict, setConflict] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
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
        anchor.origin !== location.origin
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(anchor.href);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [dirty]);
  if (query.isLoading) return <p role="status">Loading configuration…</p>;
  if (query.isError || !query.data || !draft)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Festival configuration could not be loaded. Check that you own this
          company and try again.
        </AlertDescription>
      </Alert>
    );

  const validation = validateFestivalDraft(
    draft,
    query.data.cities,
    query.data.scales,
  );
  const maximumStep = maximumReachableStep(validation);
  const selectedScale = query.data.scales.find(
    (scale) => scale.key === draft.festivalScale,
  );
  const canWrite = query.data.canWrite;
  const patch = (values: Partial<FestivalConfigurationDraft>) =>
    setDraft({ ...draft, ...values });
  const showErrors = (valid: boolean) => {
    if (valid) return false;
    setAttempted(true);
    queueMicrotask(() => summaryRef.current?.focus());
    return true;
  };
  const persist = (nextStep = draft.currentStep, complete = false) => {
    if (!canWrite || save.isPending) return;
    const stepValid =
      draft.currentStep === 1
        ? validation.identityValid
        : draft.currentStep === 2
            ? validation.fields.homeCityId.valid && validation.fields.annualMonth.valid
            : draft.currentStep === 3
              ? validation.fields.vibe.valid && validation.fields.siteType.valid
              : draft.currentStep === 4
                ? validation.fields.festivalScale.valid && validation.fields.environmentalPolicy.valid
                : draft.currentStep === 5 ? validation.datesValid : validation.allValid;
    if (showErrors(stepValid && (!complete || validation.allValid))) return;
    const configuration = { ...draft, currentStep: nextStep, complete };
    const payload = JSON.stringify(configuration);
    if (!requestRef.current || requestRef.current.payload !== payload)
      requestRef.current = { payload, key: crypto.randomUUID() };
    setConflict(false);
    setSaveFailed(false);
    save.mutate(
      {
        festivalCompanyId,
        expectedVersion: version.current,
        configuration,
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
        },
        onError: (error) => {
          if (
            error instanceof FestivalConfigurationError &&
            error.code === "festival_configuration_stale"
          )
            setConflict(true);
          else setSaveFailed(true);
        },
      },
    );
  };
  const reloadLatest = async () => {
    const result = await query.refetch();
    if (result.data) {
      acceptCanonical(result.data);
      setConflict(false);
      setSaveFailed(false);
      requestRef.current = null;
    }
  };
  const errors = Object.values(validation.fields).filter(
    (field) => !field.valid,
  );
  return (
    <section className="space-y-6" aria-labelledby="wizard-title">
      <div>
        <h2 id="wizard-title" className="text-xl font-semibold">
          Festival configuration
        </h2>
        <p>
          Build the public identity and initial schedule. This draft does not
          announce or launch your festival.
        </p>
      </div>
      {!canWrite && (
        <Alert>
          <AlertDescription>
            This configuration is read-only. You can review every section, but
            only an authorised owner or administrator can save changes.
          </AlertDescription>
        </Alert>
      )}
      {query.data.festivalEditionId && query.data.editionYear && (
        <Alert>
          <AlertDescription>
            Annual edition {query.data.editionYear} was created and is ready for private planning.
          </AlertDescription>
        </Alert>
      )}
      <FestivalWizardProgress
        currentStep={draft.currentStep}
        maximumStep={canWrite ? (validation.allValid ? 6 : maximumStep) : 6}
        onSelect={(currentStep) => patch({ currentStep })}
      />
      <FestivalSaveStatus
        pending={save.isPending}
        conflict={conflict}
        dirty={dirty}
        failed={saveFailed}
        readOnly={!canWrite}
        savedAt={savedAt}
      />
      {conflict && (
        <FestivalConflictAlert
          loading={query.isFetching}
          onReload={reloadLatest}
          onKeep={() => setConflict(false)}
        />
      )}
      {saveFailed && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {festivalConfigurationErrorMessage(save.error)}
          </AlertDescription>
        </Alert>
      )}
      {attempted && errors.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded border border-destructive p-4"
        >
          <h3 className="font-semibold">Check the following fields</h3>
          <ul className="list-disc pl-5">
            {errors.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.currentStep === 1 && (
        <IdentityStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          validation={validation.fields}
          patch={patch}
        />
      )}
      {draft.currentStep === 2 && (
        <LocationStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          configuration={query.data}
          validation={validation.fields}
          patch={patch}
        />
      )}
      {draft.currentStep === 3 && (
        <VibeSiteStep draft={draft} disabled={!canWrite} attempted={attempted} configuration={query.data} validation={validation.fields} patch={patch} />
      )}
      {draft.currentStep === 4 && (
        <ScalePolicyStep draft={draft} disabled={!canWrite} attempted={attempted} configuration={query.data} validation={validation.fields} patch={patch} />
      )}
      {draft.currentStep === 5 && (
        <ScheduleStep
          draft={draft}
          disabled={!canWrite}
          attempted={attempted}
          duration={validation.durationDays}
          maximum={selectedScale?.maximumDurationDays}
          validation={validation.fields}
          patch={patch}
        />
      )}
      {draft.currentStep === 6 && (
        <ReviewStep
          draft={draft}
          legalName={query.data.legalCompanyName}
          city={
            query.data.cities.find((city) => city.id === draft.homeCityId)?.name
          }
          scale={selectedScale?.displayName}
          duration={validation.durationDays}
          status={query.data.setupStatus}
        />
      )}
      {canWrite && (
        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            disabled={draft.currentStep === 1 || save.isPending}
            onClick={() => patch({ currentStep: draft.currentStep - 1 })}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending || !dirty}
            onClick={() => persist()}
          >
            Save draft
          </Button>
          {draft.currentStep < 6 ? (
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => persist(draft.currentStep + 1)}
            >
              Save and continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => persist(6, true)}
            >
              Complete initial setup
            </Button>
          )}
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              You have unsaved festival changes.
            </AlertDialogTitle>
            <AlertDialogDescription>
              Discard these changes and leave this page?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay and continue editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingNavigation) location.assign(pendingNavigation);
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

function ErrorText({
  id,
  state,
  show,
}: {
  id: string;
  state: FieldValidation;
  show: boolean;
}) {
  return show && !state.valid ? (
    <p id={id} className="text-sm text-destructive">
      {state.message}
    </p>
  ) : null;
}
function TextField({
  label,
  id,
  value,
  max,
  disabled,
  validation,
  show,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  max: number;
  disabled: boolean;
  validation: FieldValidation;
  show: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={max}
        disabled={disabled}
        aria-invalid={show && !validation.valid}
        aria-describedby={`${id}-count${show && !validation.valid ? ` ${errorId}` : ""}`}
        onChange={(event) => onChange(event.target.value)}
      />
      <small id={`${id}-count`}>
        {value.length}/{max}
      </small>
      <ErrorText id={errorId} state={validation} show={show} />
    </div>
  );
}
function IdentityStep({ draft, disabled, attempted, validation, patch }: any) {
  return (
    <div className="space-y-4">
      <p>
        This public identity is separate from the legal Festival Company name.
      </p>
      <TextField
        label="Public festival name"
        id="public-name"
        value={draft.publicName}
        max={80}
        disabled={disabled}
        validation={validation.publicName}
        show={attempted}
        onChange={(publicName) => patch({ publicName })}
      />
      <TextField
        label="Short name"
        id="short-name"
        value={draft.shortName}
        max={24}
        disabled={disabled}
        validation={validation.shortName}
        show={attempted}
        onChange={(shortName) => patch({ shortName })}
      />
      <TextField
        label="Tagline"
        id="tagline"
        value={draft.tagline}
        max={120}
        disabled={disabled}
        validation={validation.tagline}
        show={attempted}
        onChange={(tagline) => patch({ tagline })}
      />
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          maxLength={1000}
          disabled={disabled}
          value={draft.description}
          aria-invalid={attempted && !validation.description.valid}
          aria-describedby="description-count description-error"
          onChange={(event) => patch({ description: event.target.value })}
        />
        <small id="description-count">{draft.description.length}/1000</small>
        <ErrorText
          id="description-error"
          state={validation.description}
          show={attempted}
        />
      </div>
    </div>
  );
}
function LocationStep({
  draft,
  disabled,
  attempted,
  configuration,
  validation,
  patch,
}: any) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="city">Home city</Label>
        <select
          id="city"
          disabled={disabled}
          aria-invalid={attempted && !validation.homeCityId.valid}
          aria-describedby="city-error"
          className="min-h-11 w-full rounded border bg-background p-2"
          value={draft.homeCityId ?? ""}
          onChange={(event) =>
            patch({ homeCityId: event.target.value || null })
          }
        >
          <option value="">Choose a city</option>
          {configuration.cities.map((city: any) => (
            <option key={city.id} value={city.id}>
              {city.name}, {city.country}
            </option>
          ))}
        </select>
        <ErrorText
          id="city-error"
          state={validation.homeCityId}
          show={attempted}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="annual-month">Recurring annual month</Label><select id="annual-month" disabled={disabled} className="min-h-11 w-full rounded border bg-background p-2" value={draft.annualMonth ?? ""} onChange={(event) => patch({ annualMonth: event.target.value ? Number(event.target.value) : null })}><option value="">Choose a month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1)))}</option>)}</select><ErrorText id="annual-month-error" state={validation.annualMonth} show={attempted} /></div>
      </div>
    </div>
  );
}
function CatalogueSelect({ id, label, value, disabled, options, validation, attempted, onChange }: any) {
  return <div><Label htmlFor={id}>{label}</Label><select id={id} disabled={disabled} className="min-h-11 w-full rounded border bg-background p-2" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}><option value="">Choose an option</option>{options.map((option: any) => <option key={option.key} value={option.key}>{option.displayName}</option>)}</select><ErrorText id={`${id}-error`} state={validation} show={attempted} /></div>;
}
function VibeSiteStep({ draft, disabled, attempted, configuration, validation, patch }: any) {
  return <div className="grid gap-4 sm:grid-cols-2"><CatalogueSelect id="vibe" label="Festival vibe" value={draft.vibe} disabled={disabled} options={configuration.vibes} validation={validation.vibe} attempted={attempted} onChange={(vibe: string | null) => patch({ vibe })} /><CatalogueSelect id="site-type" label="Site approach" value={draft.siteType} disabled={disabled} options={configuration.siteTypes} validation={validation.siteType} attempted={attempted} onChange={(siteType: string | null) => patch({ siteType })} /></div>;
}
function ScalePolicyStep({ draft, disabled, attempted, configuration, validation, patch }: any) {
  return <div className="space-y-4"><fieldset disabled={disabled} aria-describedby="scale-error"><legend className="font-medium">Festival scale and duration</legend><div className="grid gap-3 sm:grid-cols-2">{configuration.scales.map((scale: any) => <label key={scale.key} className="min-h-11 rounded border p-4"><input type="radio" name="scale" checked={draft.festivalScale === scale.key} onChange={() => patch({ festivalScale: scale.key })} /> <strong>{scale.displayName}</strong><span className="block">{scale.description} {scale.minimumCapacity.toLocaleString()}–{scale.maximumCapacity.toLocaleString()} daily capacity · 1–{scale.maximumDurationDays} days · {scale.complexity} complexity.</span></label>)}</div></fieldset><ErrorText id="scale-error" state={validation.festivalScale} show={attempted} /><CatalogueSelect id="environmental-policy" label="Environmental policy" value={draft.environmentalPolicy} disabled={disabled} options={configuration.environmentalPolicies} validation={validation.environmentalPolicy} attempted={attempted} onChange={(environmentalPolicy: string | null) => patch({ environmentalPolicy })} /></div>;
}
function ScheduleStep({
  draft,
  disabled,
  attempted,
  duration,
  maximum,
  validation,
  patch,
}: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="start">Start date</Label>
        <Input
          id="start"
          type="date"
          disabled={disabled}
          value={draft.plannedStartDate ?? ""}
          aria-invalid={attempted && !validation.plannedStartDate.valid}
          aria-describedby="start-error"
          onChange={(event) =>
            patch({ plannedStartDate: event.target.value || null })
          }
        />
        <ErrorText
          id="start-error"
          state={validation.plannedStartDate}
          show={attempted}
        />
      </div>
      <div>
        <Label htmlFor="end">End date</Label>
        <Input
          id="end"
          type="date"
          disabled={disabled}
          value={draft.plannedEndDate ?? ""}
          aria-invalid={attempted && !validation.plannedEndDate.valid}
          aria-describedby="end-error"
          onChange={(event) =>
            patch({ plannedEndDate: event.target.value || null })
          }
        />
        <ErrorText
          id="end-error"
          state={validation.plannedEndDate}
          show={attempted}
        />
      </div>
      <p className="sm:col-span-2">
        Calculated inclusive duration: {duration ?? "Choose valid dates"} day(s)
        {maximum ? `; maximum ${maximum} for this scale` : ""}. The server
        remains authoritative.
      </p>
    </div>
  );
}
function ReviewStep({ draft, legalName, city, scale, duration, status }: any) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Review draft</h3>
      <dl className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-2 break-words">
        <dt>Public name</dt>
        <dd>{draft.publicName}</dd>
        <dt>Festival Company</dt>
        <dd>{legalName}</dd>
        <dt>Home city</dt>
        <dd>{city ?? "Incomplete"}</dd>
        <dt>Scale</dt>
        <dd>{scale ?? "Incomplete"}</dd>
        <dt>Annual pattern</dt><dd>Month {draft.annualMonth ?? "Incomplete"} · {draft.vibe ?? "Incomplete"} · {draft.siteType ?? "Incomplete"}</dd>
        <dt>Environmental policy</dt><dd>{draft.environmentalPolicy ?? "Incomplete"}</dd>
        <dt>Dates</dt>
        <dd>
          {draft.plannedStartDate ?? "Incomplete"} –{" "}
          {draft.plannedEndDate ?? "Incomplete"}
        </dd>
        <dt>Duration</dt>
        <dd>{duration ?? "Incomplete"} days</dd>
        <dt>Status</dt>
        <dd>{status.replaceAll("_", " ")}</dd>
      </dl>
      <p>
        Completion creates a private draft annual edition. It does not announce
        the festival or create stages, tickets, sales or bookings.
      </p>
    </div>
  );
}
