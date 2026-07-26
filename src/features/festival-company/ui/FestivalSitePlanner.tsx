import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFestivalConfiguration } from "../application/useFestivalConfiguration";
import {
  useFestivalSitePlan,
  useSaveFestivalSitePlan,
} from "../application/useFestivalSitePlan";
import {
  sitePlanToDraft,
  type FestivalSitePlanDraft,
  type FestivalStage,
} from "../domain/festivalSitePlan";
import {
  slugifyStage,
  validateSitePlanDraft,
} from "../domain/festivalSitePlanValidation";

const number = new Intl.NumberFormat("en-GB");
const blankStage = (order: number, capacity: number): FestivalStage => ({
  id: null,
  name: order ? `Stage ${order + 1}` : "Main Stage",
  slug: order ? `stage-${order + 1}` : "main-stage",
  stageType: order ? "secondary" : "main",
  sortOrder: order,
  capacity,
  minimumArtistFame: null,
  performanceAreaQuality: null,
  soundQuality: null,
  lightingQuality: null,
  productionComplexity: "standard",
  indoor: false,
  covered: true,
  accessibleViewingCapacity: Math.ceil(capacity / 100),
  opensAt: "12:00",
  closesAt: "22:00",
  changeoverMinutes: 30,
  headlineSlotMinutes: 90,
  standardSlotMinutes: 45,
  status: "planned",
});
export function FestivalSitePlanner({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const configuration = useFestivalConfiguration(festivalCompanyId);
  const query = useFestivalSitePlan(
    festivalCompanyId,
    configuration.data?.setupStatus === "ready_for_planning",
  );
  const save = useSaveFestivalSitePlan();
  const [draft, setDraft] = useState<FestivalSitePlanDraft | null>(null);
  const [section, setSection] = useState<"site" | "stages" | "review">("site");
  const [conflict, setConflict] = useState(false);
  const live = useRef<HTMLParagraphElement>(null);
  const request = useRef<{ hash: string; key: string } | null>(null);
  useEffect(() => {
    if (query.data) setDraft(sitePlanToDraft(query.data));
  }, [query.data]);
  const canonical = sitePlanToDraft(query.data!);
  const dirty = Boolean(
    draft && canonical && JSON.stringify(draft) !== JSON.stringify(canonical),
  );
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", fn);
    return () => removeEventListener("beforeunload", fn);
  }, [dirty]);
  if (configuration.isLoading)
    return <p role="status">Checking planning readiness…</p>;
  if (configuration.data?.setupStatus !== "ready_for_planning")
    return (
      <Alert>
        <AlertDescription>
          Complete Identity &amp; dates before Site and Stages unlock. Future
          setup phases remain locked until their prerequisites are complete.
        </AlertDescription>
      </Alert>
    );
  if (query.isLoading) return <p role="status">Loading site and stage plan…</p>;
  if (query.isError || !query.data)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Site planning could not be loaded. Check your access and try again.
        </AlertDescription>
      </Alert>
    );
  const initial = (): FestivalSitePlanDraft => ({
    sitePlan: {
      id: null,
      siteSource: "temporary_site",
      existingVenueId: null,
      siteName: "",
      siteType: "outdoor",
      siteDescription: "",
      cityId: configuration.data!.homeCity!.id,
      timezone: configuration.data!.homeCity!.timezone,
      totalCapacity: query.data!.scaleLimits.minimumSiteCapacity,
      usableCapacity: query.data!.scaleLimits.minimumSiteCapacity,
      reservedCapacity: 0,
      minimumAge: null,
      curfewTime: "23:00",
      gatesOpenTime: "11:00",
      dailyOpenTime: "11:00",
      dailyCloseTime: "23:00",
      accessibilityNotes: "",
      transportNotes: "",
      weatherExposure: "exposed",
      groundCondition: "grass",
      status: "in_progress",
    },
    stages: [blankStage(0, query.data!.scaleLimits.minimumSiteCapacity)],
  });
  const d = draft ?? initial();
  const issues = validateSitePlanDraft(d, query.data.scaleLimits);
  const patchSite = (x: Partial<typeof d.sitePlan>) =>
    setDraft({ ...d, sitePlan: { ...d.sitePlan, ...x } });
  const patchStage = (i: number, x: Partial<FestivalStage>) =>
    setDraft({
      ...d,
      stages: d.stages.map((s, n) => (n === i ? { ...s, ...x } : s)),
    });
  const persist = (complete = false) => {
    if (save.isPending || !query.data!.canWrite) return;
    const hash = JSON.stringify({ d, complete });
    if (request.current?.hash !== hash)
      request.current = { hash, key: crypto.randomUUID() };
    save.mutate(
      {
        festivalCompanyId,
        expectedVersion: query.data!.planningVersion,
        draft: d,
        idempotencyKey: request.current.key,
        complete,
      },
      {
        onSuccess: (r) => {
          setDraft(sitePlanToDraft(r));
          request.current = null;
          setConflict(false);
        },
        onError: (e) => setConflict(e.message === "festival_site_plan_stale"),
      },
    );
  };
  const total = d.stages.reduce((sum, s) => sum + s.capacity, 0),
    main = d.stages.find((s) => s.stageType === "main");
  return (
    <section className="mt-8 space-y-6" aria-labelledby="planning-title">
      <div>
        <h2 id="planning-title" className="text-2xl font-bold">
          Site and stage planning
        </h2>
        <p className="text-muted-foreground">
          Select a site for planning — this does not book or pay for a venue.
        </p>
      </div>
      <nav
        aria-label="Festival planning steps"
        className="grid grid-cols-3 gap-2"
      >
        {(["site", "stages", "review"] as const).map((x, i) => (
          <Button
            key={x}
            variant={section === x ? "default" : "outline"}
            onClick={() => setSection(x)}
          >
            {i + 2}. {x[0].toUpperCase() + x.slice(1)}
          </Button>
        ))}
      </nav>
      {conflict && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            A newer plan exists. Your local changes are preserved.{" "}
            <Button
              variant="link"
              onClick={() => {
                setDraft(sitePlanToDraft(query.data!));
                setConflict(false);
              }}
            >
              Reload latest
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {section === "site" && (
        <div className="space-y-5">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="font-semibold">Site source</legend>
            <Button
              variant={
                d.sitePlan.siteSource === "existing_venue"
                  ? "default"
                  : "outline"
              }
              onClick={() => patchSite({ siteSource: "existing_venue" })}
            >
              Use an existing venue
            </Button>
            <Button
              variant={
                d.sitePlan.siteSource !== "existing_venue"
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                patchSite({
                  siteSource: "temporary_site",
                  existingVenueId: null,
                })
              }
            >
              Create a temporary festival site
            </Button>
          </fieldset>
          {d.sitePlan.siteSource === "existing_venue" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {query.data.venueOptions.map((v) => (
                <li key={v.id} className="rounded border p-4">
                  <h3 className="font-semibold">{v.name}</h3>
                  <p>
                    {v.cityName} · {v.venueType} · {number.format(v.capacity)}
                  </p>
                  <p>
                    Quality {v.quality} · Availability {v.availability}
                  </p>
                  <Button
                    className="mt-3"
                    disabled={!v.festivalCompatible}
                    onClick={() =>
                      patchSite({
                        existingVenueId: v.id,
                        siteName: v.name,
                        siteType: v.siteType,
                        totalCapacity: v.capacity,
                        usableCapacity: Math.min(
                          v.capacity,
                          query.data!.scaleLimits.maximumSiteCapacity,
                        ),
                      })
                    }
                  >
                    Select for planning
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name">
                <Input
                  value={d.sitePlan.siteName}
                  onChange={(e) => patchSite({ siteName: e.target.value })}
                />
              </Field>
              <Field label="Site type">
                <select
                  className="h-10 rounded border bg-background px-3"
                  value={d.sitePlan.siteType}
                  onChange={(e) =>
                    patchSite({
                      siteType: e.target.value as typeof d.sitePlan.siteType,
                    })
                  }
                >
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>
              <Field label="Planned usable capacity">
                <Input
                  type="number"
                  value={d.sitePlan.usableCapacity}
                  onChange={(e) =>
                    patchSite({
                      usableCapacity: Number(e.target.value),
                      totalCapacity: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Minimum age">
                <Input
                  type="number"
                  value={d.sitePlan.minimumAge ?? ""}
                  onChange={(e) =>
                    patchSite({
                      minimumAge: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="Daily opening">
                <Input
                  type="time"
                  value={d.sitePlan.dailyOpenTime}
                  onChange={(e) => patchSite({ dailyOpenTime: e.target.value })}
                />
              </Field>
              <Field label="Daily closing">
                <Input
                  type="time"
                  value={d.sitePlan.dailyCloseTime}
                  onChange={(e) =>
                    patchSite({ dailyCloseTime: e.target.value })
                  }
                />
              </Field>
              <Field label="Curfew">
                <Input
                  type="time"
                  value={d.sitePlan.curfewTime ?? ""}
                  onChange={(e) =>
                    patchSite({ curfewTime: e.target.value || null })
                  }
                />
              </Field>
              <Field label="Weather exposure">
                <Input
                  value={d.sitePlan.weatherExposure}
                  onChange={(e) =>
                    patchSite({ weatherExposure: e.target.value })
                  }
                />
              </Field>
              <Field label="Ground condition">
                <Input
                  value={d.sitePlan.groundCondition}
                  onChange={(e) =>
                    patchSite({ groundCondition: e.target.value })
                  }
                />
              </Field>
              <Field label="Accessibility notes">
                <Textarea
                  value={d.sitePlan.accessibilityNotes}
                  onChange={(e) =>
                    patchSite({ accessibilityNotes: e.target.value })
                  }
                />
              </Field>
              <Field label="Transport notes">
                <Textarea
                  value={d.sitePlan.transportNotes}
                  onChange={(e) =>
                    patchSite({ transportNotes: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
        </div>
      )}
      {section === "stages" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p>
              {d.stages.length} of {query.data.scaleLimits.maximumStages} stages
            </p>
            <Button
              disabled={d.stages.length >= query.data.scaleLimits.maximumStages}
              onClick={() =>
                setDraft({
                  ...d,
                  stages: [
                    ...d.stages,
                    blankStage(
                      d.stages.length,
                      Math.min(
                        d.sitePlan.usableCapacity,
                        Math.ceil(d.sitePlan.usableCapacity / 2),
                      ),
                    ),
                  ],
                })
              }
            >
              Add stage
            </Button>
          </div>
          <ol className="space-y-3">
            {d.stages.map((s, i) => (
              <li key={`${s.slug}-${i}`} className="rounded border p-4">
                <details open={i === 0}>
                  <summary className="cursor-pointer font-semibold">
                    {s.name} · {s.stageType} · {number.format(s.capacity)}
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label={`Stage ${i + 1} name`}>
                      <Input
                        value={s.name}
                        onChange={(e) =>
                          patchStage(i, {
                            name: e.target.value,
                            slug: slugifyStage(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Stage type">
                      <select
                        className="h-10 rounded border bg-background px-3"
                        value={s.stageType}
                        onChange={(e) =>
                          patchStage(i, {
                            stageType: e.target
                              .value as FestivalStage["stageType"],
                          })
                        }
                      >
                        {[
                          "main",
                          "secondary",
                          "emerging",
                          "acoustic",
                          "dance",
                          "specialist",
                          "community",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Capacity">
                      <Input
                        type="number"
                        value={s.capacity}
                        onChange={(e) =>
                          patchStage(i, { capacity: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Accessible viewing">
                      <Input
                        type="number"
                        value={s.accessibleViewingCapacity}
                        onChange={(e) =>
                          patchStage(i, {
                            accessibleViewingCapacity: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Opens">
                      <Input
                        type="time"
                        value={s.opensAt}
                        onChange={(e) =>
                          patchStage(i, { opensAt: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Closes">
                      <Input
                        type="time"
                        value={s.closesAt}
                        onChange={(e) =>
                          patchStage(i, { closesAt: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Standard slot minutes">
                      <Input
                        type="number"
                        value={s.standardSlotMinutes}
                        onChange={(e) =>
                          patchStage(i, {
                            standardSlotMinutes: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Changeover minutes">
                      <Input
                        type="number"
                        value={s.changeoverMinutes}
                        onChange={(e) =>
                          patchStage(i, {
                            changeoverMinutes: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <label>
                      <input
                        type="checkbox"
                        checked={s.indoor}
                        onChange={(e) =>
                          patchStage(i, { indoor: e.target.checked })
                        }
                      />{" "}
                      Indoor
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={s.covered}
                        onChange={(e) =>
                          patchStage(i, { covered: e.target.checked })
                        }
                      />{" "}
                      Covered
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      aria-label={`Move ${s.name} up`}
                      disabled={!i}
                      onClick={() => {
                        const a = [...d.stages];
                        [a[i - 1], a[i]] = [a[i], a[i - 1]];
                        setDraft({
                          ...d,
                          stages: a.map((x, n) => ({ ...x, sortOrder: n })),
                        });
                      }}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="outline"
                      aria-label={`Move ${s.name} down`}
                      disabled={i === d.stages.length - 1}
                      onClick={() => {
                        const a = [...d.stages];
                        [a[i], a[i + 1]] = [a[i + 1], a[i]];
                        setDraft({
                          ...d,
                          stages: a.map((x, n) => ({ ...x, sortOrder: n })),
                        });
                      }}
                    >
                      Move down
                    </Button>
                    <Button
                      variant="destructive"
                      aria-label={`Remove ${s.name}`}
                      onClick={() =>
                        setDraft({
                          ...d,
                          stages: d.stages
                            .filter((_, n) => n !== i)
                            .map((x, n) => ({ ...x, sortOrder: n })),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
      {section === "review" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              title="Site capacity"
              value={number.format(d.sitePlan.usableCapacity)}
            />
            <Metric
              title="Largest stage"
              value={number.format(
                Math.max(0, ...d.stages.map((s) => s.capacity)),
              )}
            />
            <Metric
              title="Total stage capacities"
              value={number.format(total)}
            />
            <Metric
              title="Main stage share"
              value={`${Math.round((100 * (main?.capacity ?? 0)) / d.sitePlan.usableCapacity)}%`}
            />
          </div>
          {total > d.sitePlan.usableCapacity * 1.5 && (
            <Alert>
              <AlertDescription>
                Combined stage capacities exceed the site population. This is
                allowed, but scheduling will need to spread demand.
              </AlertDescription>
            </Alert>
          )}
          <div>
            <h3 className="font-semibold">Facility recommendations</h3>
            <p className="text-sm text-muted-foreground">
              Planning estimates only. Staff and suppliers will be contracted in
              later setup stages.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(query.data.facilities).map(([k, v]) => (
                <Metric
                  key={k}
                  title={k.replace(/([A-Z])/g, " $1")}
                  value={number.format(v)}
                />
              ))}
            </div>
          </div>
          <div tabIndex={-1} aria-label="Planning validation summary">
            <h3 className="font-semibold">Blocking issues and warnings</h3>
            {issues.length ? (
              <ul>
                {issues.map((i) => (
                  <li key={i.code}>{i.message}</li>
                ))}
              </ul>
            ) : (
              <p>Ready to complete.</p>
            )}
          </div>
          <Button
            disabled={
              issues.length > 0 || save.isPending || !query.data.canWrite
            }
            onClick={() => persist(true)}
          >
            Complete site and stage planning
          </Button>
          <p>
            Completing planning does not sell tickets, book a venue, schedule
            artists, hire staff or create finance transactions.
          </p>
        </div>
      )}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button
          disabled={save.isPending || !query.data.canWrite}
          onClick={() => persist(false)}
        >
          Save planning draft
        </Button>
        <p ref={live} aria-live="polite">
          {save.isPending
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : query.data.ready
                ? "Site and stage planning complete. Ticket types and capacity allocation can now be configured."
                : "All changes saved"}
        </p>
      </div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="grid gap-2">
      {label}
      {children}
    </Label>
  );
}
function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs">Recommended · Contracted later</p>
    </div>
  );
}
