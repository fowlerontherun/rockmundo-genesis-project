import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  defaultFestivalCreationDraft,
  validateFestivalCreationDraft,
  hasCreationErrors,
  stagePreset,
  moneyToCents,
  centsToMoney,
  buildEditionTitle,
} from "../creationValidation";
import {
  useCreateFestivalFromWizard,
  useFestivalReferenceData,
} from "../hooks";
import type {
  AdminFestivalCatalogueRow,
  FestivalCreationDraft,
  FestivalCreationResult,
} from "../types";
import { isFestivalCreationDraftDirty } from "./creation/festivalCreationDirtyState";

const stepNames = [
  "Festival",
  "First event",
  "Location",
  "Stages",
  "Commercial",
  "Review",
];
export function FestivalCreationWizard({
  open,
  mode,
  festival,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  mode: FestivalCreationDraft["mode"];
  festival?: AdminFestivalCatalogueRow;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: FestivalCreationResult) => void;
}) {
  const [draft, setDraft] = useState(() =>
    defaultFestivalCreationDraft(mode, festival?.festivalId),
  );
  const [initialDraft, setInitialDraft] = useState(draft);
  const [step, setStep] = useState(0);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const refs = useFestivalReferenceData();
  const create = useCreateFestivalFromWizard();
  useEffect(() => {
    if (open) {
      const next = defaultFestivalCreationDraft(mode, festival?.festivalId);
      if (festival) {
        next.identity.name = festival.brandName;
        next.identity.shortDescription = festival.brandName;
        next.identity.fullDescription = festival.brandName;
        next.location.cityName = festival.cityName;
      }
      setDraft(next);
      setInitialDraft(next);
      setStep(mode === "create_festival" ? 0 : 1);
    }
  }, [open, mode, festival]);
  const errors = useMemo(() => validateFestivalCreationDraft(draft), [draft]);
  const currentErrors =
    errors[
      ["identity", "edition", "location", "stages", "commercial", "submit"][
        step
      ] as keyof typeof errors
    ] ?? [];
  const update = (patch: Partial<FestivalCreationDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const submit = () =>
    create.mutate(draft, {
      onSuccess: (result) => {
        setInitialDraft(draft);
        onCreated(result);
      },
    });
  const referenceData = refs.data;
  const genres = referenceData?.genres ?? [];
  const festivalTypes = referenceData?.festivalTypes ?? [];
  const currencies = referenceData?.currencies ?? [];
  const countries = referenceData?.countries ?? [];
  const cities = (referenceData?.cities ?? []).filter(
    (city) => !draft.location.country || city.country === draft.location.country,
  );
  const venues = (referenceData?.venues ?? []).filter(
    (venue) => venue.cityId === draft.location.cityId,
  );
  const selectedVenue = venues.find((venue) => venue.id === draft.location.venueId);
  const venueCapacityExceeded = Boolean(selectedVenue?.capacity && draft.location.capacity > selectedVenue.capacity);
  const canCloseWithoutPrompt =
    !open || create.isSuccess || !isFestivalCreationDraftDirty(initialDraft, draft);
  const canNext =
    step === 5 ? !hasCreationErrors(errors) : currentErrors.length === 0;
  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          onOpenChange(true);
          return;
        }
        if (create.isPending) return;
        if (canCloseWithoutPrompt) onOpenChange(false);
        else setDiscardPromptOpen(true);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create_festival"
              ? "Create Festival"
              : mode === "create_first_edition"
                ? "Create first edition"
                : "Add new edition"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {stepNames.map((name, i) => (
            <Button
              key={name}
              size="sm"
              variant={i === step ? "default" : "outline"}
              aria-current={i === step ? "step" : undefined}
              disabled={(mode !== "create_festival" && i === 0) || i > step + 1 || (i > step && currentErrors.length > 0)}
              onClick={() => { if (i <= step || currentErrors.length === 0) setStep(i); }}
            >
              {i + 1}. {name}
            </Button>
          ))}
        </div>
        {mode !== "create_festival" && (
          <Card>
            <CardContent className="p-3 text-sm">
              Festival: <b>{festival?.brandName}</b>. The permanent festival
              identity is locked; this flow creates edition setup only.
            </CardContent>
          </Card>
        )}
        {step === 0 && (
          <div className="grid gap-3">
            <Label>
              Festival name
              <Input
                value={draft.identity.name}
                onChange={(e) => {
                  const name = e.target.value;
                  update({
                    identity: { ...draft.identity, name },
                    edition: {
                      ...draft.edition,
                      title:
                        draft.edition.title ||
                        buildEditionTitle(name, draft.edition.startAt),
                    },
                  });
                }}
              />
            </Label>
            <Label>
              Short description
              <Input
                value={draft.identity.shortDescription}
                onChange={(e) =>
                  update({
                    identity: {
                      ...draft.identity,
                      shortDescription: e.target.value,
                    },
                  })
                }
              />
            </Label>
            <Label>
              Full description
              <Textarea
                value={draft.identity.fullDescription}
                onChange={(e) =>
                  update({
                    identity: {
                      ...draft.identity,
                      fullDescription: e.target.value,
                    },
                  })
                }
              />
            </Label>
            <Label>
              Festival type
              <Select
                value={draft.identity.festivalType}
                onValueChange={(v) =>
                  update({ identity: { ...draft.identity, festivalType: v } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {festivalTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Image reference
              <Input
                value={draft.identity.imageUrl ?? ""}
                onChange={(e) =>
                  update({
                    identity: { ...draft.identity, imageUrl: e.target.value },
                  })
                }
              />
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {genres.map((genre) => (
                <Label key={genre} className="flex items-center gap-2">
                  <Checkbox
                    checked={draft.identity.primaryGenres.includes(genre)}
                    onCheckedChange={(checked) =>
                      update({
                        identity: {
                          ...draft.identity,
                          primaryGenres: checked
                            ? [...draft.identity.primaryGenres, genre]
                            : draft.identity.primaryGenres.filter(
                                (g) => g !== genre,
                              ),
                        },
                      })
                    }
                  />
                  {genre}
                </Label>
              ))}
            </div>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={draft.identity.isPublic}
                onCheckedChange={(checked) =>
                  update({
                    identity: { ...draft.identity, isPublic: Boolean(checked) },
                  })
                }
              />
              Visible on public festival lists when lifecycle allows
            </Label>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-3 md:grid-cols-2">
            <Label>
              Edition title
              <Input
                value={draft.edition.title}
                onChange={(e) =>
                  update({
                    edition: { ...draft.edition, title: e.target.value },
                  })
                }
              />
            </Label>
            <Label>
              Edition number
              <Input
                type="number"
                value={draft.edition.editionNumber}
                onChange={(e) =>
                  update({
                    edition: {
                      ...draft.edition,
                      editionNumber: Number(e.target.value),
                    },
                  })
                }
              />
            </Label>
            {[
              "startAt",
              "endAt",
              "applicationsOpenAt",
              "applicationsCloseAt",
              "bookingDeadlineAt",
            ].map((key) => (
              <Label key={key}>
                {key.replace(/([A-Z])/g, " $1")}
                <Input
                  type="datetime-local"
                  value={(draft.edition as any)[key] ?? ""}
                  onChange={(e) =>
                    update({
                      edition: {
                        ...draft.edition,
                        [key]: e.target.value,
                      } as any,
                    })
                  }
                />
              </Label>
            ))}
            <Label>
              Time zone
              <Select
                value={draft.edition.timezone}
                onValueChange={(v) =>
                  update({ edition: { ...draft.edition, timezone: v } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[draft.edition.timezone].filter(Boolean).map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Currency
              <Select
                value={draft.edition.currencyCode}
                onValueChange={(v) =>
                  update({ edition: { ...draft.edition, currencyCode: v } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-3 md:grid-cols-2">
            <Label>
              Country
              <Select
                value={draft.location.country}
                onValueChange={(country) => update({
                  location: { ...draft.location, country, cityId: "", cityName: "", venueId: "" },
                })}
              >
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              City
              <Select
                value={draft.location.cityId}
                onValueChange={(cityId) => {
                  const city = cities.find((c: any) => c.id === cityId);
                  update({
                    location: {
                      ...draft.location,
                      cityId,
                      cityName: city?.name,
                      country: city?.country ?? "",
                      venueId: "",
                    },
                    edition: {
                      ...draft.edition,
                      timezone: city?.timezone || draft.edition.timezone,
                      currencyCode: city?.currencyCode || draft.edition.currencyCode,
                    },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}, {city.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Venue or festival site
              <Select
                value={draft.location.venueId || "custom"}
                onValueChange={(venueId) =>
                  update({
                    location: {
                      ...draft.location,
                      venueId: venueId === "custom" ? "" : venueId,
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    Public festival site name
                  </SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Public site name
              <Input
                value={draft.location.siteName ?? ""}
                onChange={(e) =>
                  update({
                    location: { ...draft.location, siteName: e.target.value },
                  })
                }
              />
            </Label>
            {selectedVenue?.capacity && (
              <p className={venueCapacityExceeded ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                Venue capacity: {selectedVenue.capacity.toLocaleString()}
                {venueCapacityExceeded ? " — requested capacity exceeds this venue." : ""}
              </p>
            )}
            <Label>
              Overall capacity
              <Input
                type="number"
                value={draft.location.capacity}
                onChange={(e) =>
                  update({
                    location: {
                      ...draft.location,
                      capacity: Number(e.target.value),
                    },
                  })
                }
              />
            </Label>
            {[
              ["Minimum ticket", "minTicketPriceCents"],
              ["Maximum ticket", "maxTicketPriceCents"],
              ["Default ticket", "defaultTicketPriceCents"],
            ].map(([label, key]) => (
              <Label key={key}>
                {label}
                <Input
                  type="number"
                  value={centsToMoney((draft.location as any)[key])}
                  onChange={(e) =>
                    update({
                      location: {
                        ...draft.location,
                        [key]: moneyToCents(e.target.value),
                      } as any,
                    })
                  }
                />
              </Label>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  update({
                    stages: stagePreset("small", draft.location.capacity),
                  })
                }
              >
                Small preset
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  update({
                    stages: stagePreset("medium", draft.location.capacity),
                  })
                }
              >
                Medium preset
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  update({
                    stages: stagePreset("large", draft.location.capacity),
                  })
                }
              >
                Large preset
              </Button>
              <Button
                onClick={() =>
                  update({
                    stages: [
                      ...draft.stages,
                      stagePreset("small", draft.location.capacity)[0],
                    ],
                  })
                }
              >
                Add stage
              </Button>
            </div>
            {draft.stages.map((stage, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>{stage.name || "Stage"}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-4">
                  <Input
                    value={stage.name}
                    onChange={(e) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, name: e.target.value } : s,
                        ),
                      })
                    }
                  />
                  <Select
                    value={stage.type}
                    onValueChange={(value) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, type: value } : s,
                        ),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Stage type" /></SelectTrigger>
                    <SelectContent>
                      {(referenceData?.stageTypes ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={stage.capacity}
                    onChange={(e) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index
                            ? { ...s, capacity: Number(e.target.value) }
                            : s,
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    value={stage.changeoverMinutes}
                    onChange={(e) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index
                            ? {
                                ...s,
                                changeoverMinutes: Number(e.target.value),
                              }
                            : s,
                        ),
                      })
                    }
                  />
                  <Input
                    value={stage.curfew}
                    onChange={(e) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, curfew: e.target.value } : s,
                        ),
                      })
                    }
                  />
                  <Select
                    value={stage.weatherProtection}
                    onValueChange={(value) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, weatherProtection: value } : s,
                        ),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Weather protection" /></SelectTrigger>
                    <SelectContent>
                      {(referenceData?.weatherOptions ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={stage.soundCapability}
                    onValueChange={(value) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, soundCapability: value } : s,
                        ),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Sound capability" /></SelectTrigger>
                    <SelectContent>
                      {(referenceData?.soundOptions ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={stage.lightingCapability}
                    onValueChange={(value) =>
                      update({
                        stages: draft.stages.map((s, i) =>
                          i === index ? { ...s, lightingCapability: value } : s,
                        ),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Lighting capability" /></SelectTrigger>
                    <SelectContent>
                      {(referenceData?.lightingOptions ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      update({
                        stages: draft.stages.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Estimated attendance", "estimatedAttendance", 1],
              ["Operating budget", "operatingBudgetCents", 100],
              ["Performer budget", "performerBudgetCents", 100],
              ["Staffing budget", "staffingBudgetCents", 100],
              ["Marketing budget", "marketingBudgetCents", 100],
            ].map(([label, key, div]) => (
              <Label key={String(key)}>
                {label}
                <Input
                  type="number"
                  value={Number((draft.commercial as any)[key]) / Number(div)}
                  onChange={(e) =>
                    update({
                      commercial: {
                        ...draft.commercial,
                        [key]: Number(e.target.value) * Number(div),
                      } as any,
                    })
                  }
                />
              </Label>
            ))}
            {[
              ["Sponsorship", "sponsorshipEnabled"],
              ["Merchandise", "merchandiseEnabled"],
              ["Food and drink", "concessionsEnabled"],
            ].map(([label, key]) => (
              <Label key={key} className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean((draft.commercial as any)[key])}
                  onCheckedChange={(checked) =>
                    update({
                      commercial: {
                        ...draft.commercial,
                        [key]: Boolean(checked),
                      } as any,
                    })
                  }
                />
                {label} enabled
              </Label>
            ))}
          </div>
        )}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Review and create</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <b>Festival:</b> {draft.identity.name || festival?.brandName}
              </p>
              <p>
                <b>Type:</b> {draft.identity.festivalType}
              </p>
              <p>
                <b>Genres:</b>{" "}
                {draft.identity.primaryGenres.join(", ") ||
                  "Stored on festival"}
              </p>
              <p>
                <b>Location:</b> {draft.location.cityName}{" "}
                {draft.location.siteName}
              </p>
              <p>
                <b>Edition:</b> {draft.edition.title} · planning
              </p>
              <p>
                <b>Dates:</b> {draft.edition.startAt} → {draft.edition.endAt}
              </p>
              <p>
                <b>Applications:</b> {draft.edition.applicationsOpenAt} →{" "}
                {draft.edition.applicationsCloseAt}
              </p>
              <p>
                <b>Capacity:</b> {draft.location.capacity}
              </p>
              <p>
                <b>Tickets:</b>{" "}
                {centsToMoney(draft.location.minTicketPriceCents)}–
                {centsToMoney(draft.location.maxTicketPriceCents)}{" "}
                {draft.edition.currencyCode}
              </p>
              <p>
                <b>Stages:</b> {draft.stages.map((s) => s.name).join(", ")}
              </p>
              <p>
                <b>Budget:</b>{" "}
                {centsToMoney(draft.commercial.operatingBudgetCents)}{" "}
                {draft.edition.currencyCode}
              </p>
            </CardContent>
          </Card>
        )}
        {currentErrors.length > 0 && (
          <div className="rounded border border-destructive p-3 text-sm text-destructive">
            {currentErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {create.error && (
          <p className="text-sm text-destructive">
            The festival could not be created. No records were saved. Reference
            FESTIVAL_CREATE_TRANSACTION.
          </p>
        )}
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={step === 0 || create.isPending}
            onClick={() =>
              setStep(Math.max(mode === "create_festival" ? 0 : 1, step - 1))
            }
          >
            Back
          </Button>
          {step < 5 ? (
            <Button disabled={!canNext || venueCapacityExceeded} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={!canNext || create.isPending} onClick={submit}>
              {create.isPending
                ? "Creating…"
                : mode === "create_festival"
                  ? "Create festival"
                  : "Create edition"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardPromptOpen} onOpenChange={setDiscardPromptOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this festival setup draft?</AlertDialogTitle>
          <AlertDialogDescription>
            Continue editing to keep this setup, or discard the draft and lose unsaved festival creation changes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setDiscardPromptOpen(false);
              setInitialDraft(draft);
              onOpenChange(false);
            }}
          >
            Discard draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
