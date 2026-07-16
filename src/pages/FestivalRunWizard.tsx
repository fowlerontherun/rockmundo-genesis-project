import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Rocket,
  FileText,
  ShieldCheck,
  Music,
  Calendar as CalendarIcon,
  Ticket,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import {
  useFestivalStages,
  useFestivalStageSlots,
} from "@/hooks/useFestivalStages";
import {
  listFestivalEditions,
  transitionFestivalEdition,
} from "@/features/festivals/service";
import { getFestivalEditionStatusLabel } from "@/features/festivals/lifecycle";
import { format } from "date-fns";

type StepKey = "draft" | "booking" | "compliance" | "launch";
const STEPS: { key: StepKey; label: string; icon: any }[] = [
  { key: "draft", label: "Draft Setup", icon: FileText },
  { key: "booking", label: "Booking Confirmation", icon: Music },
  { key: "compliance", label: "Permits & Insurance", icon: ShieldCheck },
  { key: "launch", label: "Go Live", icon: Rocket },
];

export default function FestivalRunWizard() {
  const { festivalId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profileId } = useActiveProfile();
  const [stepIdx, setStepIdx] = useState(0);

  const { data: festival, isLoading } = useQuery({
    queryKey: ["run-wizard-festival", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festivals")
        .select("*, city:cities(name,country)")
        .eq("id", festivalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!festivalId,
  });

  const { data: editions = [] } = useQuery({
    queryKey: ["festival-editions", festivalId],
    queryFn: () => listFestivalEditions(festivalId!),
    enabled: !!festivalId,
  });
  const currentEdition = editions[0];

  const { data: stages = [] } = useFestivalStages(festivalId);
  const { data: slots = [] } = useFestivalStageSlots(festivalId);

  const { data: permits = [] } = useQuery({
    queryKey: ["run-wizard-permits", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_permits")
        .select("*")
        .eq("festival_id", festivalId);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const { data: insurance = [] } = useQuery({
    queryKey: ["run-wizard-insurance", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_insurance_policies")
        .select("*")
        .eq("festival_id", festivalId)
        .eq("active", true);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const isOwner =
    !!festival && !!profileId && festival.owner_profile_id === profileId;

  // Draft edits
  const [draftName, setDraftName] = useState<string>("");
  const [draftAttendance, setDraftAttendance] = useState<string>("");
  const [draftLow, setDraftLow] = useState<string>("");
  const [draftHigh, setDraftHigh] = useState<string>("");
  const [originalDraft, setOriginalDraft] = useState<{
    name: string;
    attendance: string;
    low: string;
    high: string;
  } | null>(null);

  // Initialize once
  useMemo(() => {
    if (festival && draftName === "") {
      const name = festival.name || "";
      const attendance = String(festival.expected_attendance ?? "");
      const low = String(festival.ticket_price_low ?? "");
      const high = String(festival.ticket_price_high ?? "");
      setDraftName(name);
      setDraftAttendance(attendance);
      setDraftLow(low);
      setDraftHigh(high);
      if (!originalDraft) setOriginalDraft({ name, attendance, low, high });
    }
  }, [festival]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const attendance = Number(draftAttendance);
      const low = Number(draftLow);
      const high = Number(draftHigh);
      if (!draftName.trim()) throw new Error("Name is required");
      if (!Number.isFinite(attendance) || attendance <= 0)
        throw new Error("Attendance must be positive");
      if (!Number.isFinite(low) || !Number.isFinite(high) || high < low)
        throw new Error("Ticket range invalid");
      const { error } = await (supabase as any)
        .from("festivals")
        .update({
          name: draftName.trim(),
          expected_attendance: Math.round(attendance),
          ticket_price_low: low,
          ticket_price_high: high,
          updated_at: new Date().toISOString(),
        })
        .eq("id", festivalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["run-wizard-festival", festivalId] });
      qc.invalidateQueries({ queryKey: ["festival-editions", festivalId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Compliance checks
  const approvedPermits = permits.filter((p: any) => p.status === "approved");
  const requiredPermitTypes = ["event", "safety", "noise"]; // baseline required
  const missingPermitTypes = requiredPermitTypes.filter(
    (t) =>
      !approvedPermits.some((p: any) =>
        (p.permit_type || "").toLowerCase().includes(t),
      ),
  );
  const hasInsurance = insurance.length > 0;

  // Booking checks
  const confirmedSlots = slots.filter((s: any) => s.band_id || s.is_npc_dj);
  const stagesWithBookings = new Set(
    confirmedSlots.map((s: any) => s.stage_id),
  );
  const stagesMissing = stages.filter((st) => !stagesWithBookings.has(st.id));
  const headliners = confirmedSlots.filter(
    (s: any) => s.slot_type === "headliner",
  );

  const checks: Record<StepKey, { ok: boolean; label: string }[]> = {
    draft: [
      { ok: !!festival?.name, label: "Festival has a name" },
      {
        ok: (festival?.expected_attendance ?? 0) > 0,
        label: "Expected attendance set",
      },
      {
        ok:
          (Number(festival?.ticket_price_low) || 0) > 0 &&
          Number(festival?.ticket_price_high) >=
            Number(festival?.ticket_price_low),
        label: "Ticket price range valid",
      },
      {
        ok: !!festival?.start_date && !!festival?.end_date,
        label: "Run dates confirmed",
      },
      {
        ok: !!festival?.city_id && !!festival?.venue_id,
        label: "City & venue selected",
      },
    ],
    booking: [
      { ok: stages.length > 0, label: "At least one stage created" },
      {
        ok: stagesMissing.length === 0 && stages.length > 0,
        label: "All stages have at least one booking",
      },
      { ok: headliners.length > 0, label: "Headline act confirmed" },
      {
        ok: confirmedSlots.length >= Math.max(3, stages.length * 2),
        label: `Minimum performers booked (${confirmedSlots.length}/${Math.max(3, stages.length * 2)})`,
      },
      {
        ok: confirmedSlots.every((s: any) => s.start_time && s.end_time),
        label: "All confirmed slots have set times",
      },
    ],
    compliance: [
      {
        ok: missingPermitTypes.length === 0,
        label: `Required permits approved (missing: ${missingPermitTypes.join(", ") || "none"})`,
      },
      { ok: hasInsurance, label: "Active insurance policy on file" },
      {
        ok: insurance.some((i: any) => i.weather_rider),
        label: "Weather cover rider (recommended)",
      },
    ],
    launch: [
      {
        ok: currentEdition
          ? ["booking", "announced", "on_sale", "setup", "live"].includes(
              currentEdition.status as string,
            )
          : festival?.status === "confirmed" ||
            festival?.status === "live" ||
            festival?.status === "announced",
        label: currentEdition
          ? "Canonical edition lifecycle ready for launch"
          : "Legacy festival status ready (compatibility only)",
      },
    ],
  };

  const stepReady = (k: StepKey) => checks[k].every((c) => c.ok);
  const canLaunch =
    stepReady("draft") && stepReady("booking") && stepReady("compliance");

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (currentEdition) {
        await transitionFestivalEdition({
          editionId: currentEdition.id,
          targetStatus: "announced",
          metadata: { source: "FestivalRunWizard" },
          idempotencyKey: `run-wizard-announce-${currentEdition.id}`,
        });
        return;
      }
      throw new Error(
        "No canonical edition is available yet; legacy brand status was not changed.",
      );
    },
    onSuccess: () => {
      toast.success("Festival is live! Announcement pushed.");
      qc.invalidateQueries({ queryKey: ["run-wizard-festival", festivalId] });
      qc.invalidateQueries({ queryKey: ["festival-editions", festivalId] });
      setStepIdx(STEPS.length - 1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const progressPct = Math.round(
    (STEPS.slice(0, stepIdx + 1).filter((s) => stepReady(s.key)).length /
      STEPS.length) *
      100,
  );

  const step = STEPS[stepIdx];

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Run Festival"
        icon={Rocket}
        backTo={`/festivals/${festivalId}`}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </FMPageScaffold>
    );
  }
  if (!festival) {
    return (
      <FMPageScaffold title="Run Festival" icon={Rocket} backTo="/festivals">
        <p className="p-8 text-center text-muted-foreground">
          Festival not found.
        </p>
      </FMPageScaffold>
    );
  }
  if (!isOwner) {
    return (
      <FMPageScaffold
        title="Run Festival"
        icon={Rocket}
        backTo={`/festivals/${festivalId}`}
      >
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
            <p className="font-medium mb-1">Owner access required</p>
            <p className="text-sm text-muted-foreground mb-4">
              Only the festival owner can run the go-live wizard.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(`/festivals/${festivalId}`)}
            >
              Back to festival
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const CheckList = ({
    items,
  }: {
    items: { ok: boolean; label: string }[];
  }) => (
    <ul className="space-y-2">
      {items.map((c, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {c.ok ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive mt-0.5" />
          )}
          <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <FMPageScaffold
      title="Run Festival"
      subtitle={`${festival.name} • ${festival.city?.name || ""} • ${format(new Date(festival.start_date), "MMM d")} – ${format(new Date(festival.end_date), "MMM d, yyyy")}`}
      icon={Rocket}
      backTo={`/festivals/${festivalId}`}
    >
      {/* Stepper */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === stepIdx;
              const done = stepReady(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => setStepIdx(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-green-500/20 text-green-500"
                        : active
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
          <Progress value={progressPct} />
          <p className="text-xs text-muted-foreground">
            Overall readiness: {progressPct}%
          </p>
          {currentEdition ? (
            <p className="text-xs text-muted-foreground">
              Canonical edition #{currentEdition.edition_number} lifecycle:{" "}
              <Badge variant="outline">
                {getFestivalEditionStatusLabel(currentEdition.status)}
              </Badge>
            </p>
          ) : (
            <p className="text-xs text-amber-500">
              Canonical edition not resolved. The wizard will not mutate the
              permanent festival brand lifecycle.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <step.icon className="h-5 w-5 text-primary" />
            {step.label}
          </CardTitle>
          <CardDescription>
            {step.key === "draft" &&
              "Confirm the festival's core details before promotion."}
            {step.key === "booking" &&
              "Verify stages, lineup, and set times are locked in."}
            {step.key === "compliance" &&
              "Approve permits and confirm active insurance before doors."}
            {step.key === "launch" &&
              "Push the announcement and open ticket sales."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step.key === "draft" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <div>
                <Label>Expected Attendance</Label>
                <Input
                  type="number"
                  min={0}
                  value={draftAttendance}
                  onChange={(e) => setDraftAttendance(e.target.value)}
                />
              </div>
              <div>
                <Label>Ticket Price — Low</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftLow}
                  onChange={(e) => setDraftLow(e.target.value)}
                />
              </div>
              <div>
                <Label>Ticket Price — High</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftHigh}
                  onChange={(e) => setDraftHigh(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveDraft.mutate()}
                  disabled={saveDraft.isPending}
                >
                  {saveDraft.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Save Draft
                </Button>
              </div>
              <div className="md:col-span-2">
                <Separator className="my-2" />
                <CheckList items={checks.draft} />
              </div>
            </div>
          )}

          {step.key === "booking" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Stages</p>
                  <p className="text-xl font-bold">{stages.length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Confirmed slots
                  </p>
                  <p className="text-xl font-bold">{confirmedSlots.length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Headliners</p>
                  <p className="text-xl font-bold">{headliners.length}</p>
                </div>
              </div>
              {stagesMissing.length > 0 && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" /> Stages
                    without bookings
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {stagesMissing.map((s) => (
                      <Badge key={s.id} variant="outline">
                        {s.stage_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <CheckList items={checks.booking} />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/festivals/${festivalId}/calendar`)}
                >
                  <CalendarIcon className="h-4 w-4 mr-1" /> Open Booking
                  Calendar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/festivals/${festivalId}/manage`)}
                >
                  Manage Lineup
                </Button>
              </div>
            </div>
          )}

          {step.key === "compliance" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Permits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {permits.length === 0 ? (
                      <p className="text-muted-foreground">No permits filed.</p>
                    ) : (
                      <ul className="space-y-1">
                        {permits.map((p: any) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between"
                          >
                            <span className="capitalize">{p.permit_type}</span>
                            <Badge
                              variant={
                                p.status === "approved" ? "default" : "outline"
                              }
                              className="capitalize"
                            >
                              {p.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    {missingPermitTypes.length > 0 && (
                      <p className="text-xs text-yellow-500 mt-2">
                        Missing approvals: {missingPermitTypes.join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Insurance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {!hasInsurance ? (
                      <p className="text-muted-foreground">No active policy.</p>
                    ) : (
                      <ul className="space-y-1">
                        {insurance.map((i: any) => (
                          <li
                            key={i.id}
                            className="flex items-center justify-between"
                          >
                            <span className="capitalize">
                              {i.coverage_type}
                              {i.weather_rider ? " + weather" : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              cap $
                              {(
                                (i.payout_ceiling_cents ?? 0) / 100
                              ).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
              <CheckList items={checks.compliance} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/festivals/${festivalId}/manage?tab=compliance`)
                  }
                >
                  Manage Permits & Insurance
                </Button>
              </div>
            </div>
          )}

          {step.key === "launch" &&
            (() => {
              // Build run order across all stages, sorted by day + start_time
              const runOrder = [...confirmedSlots].sort((a: any, b: any) => {
                if (a.day_number !== b.day_number)
                  return a.day_number - b.day_number;
                const at = a.start_time || "";
                const bt = b.start_time || "";
                return at.localeCompare(bt);
              });
              const bookedByStage = stages
                .map((st) => ({
                  stage: st,
                  slots: confirmedSlots
                    .filter((s: any) => s.stage_id === st.id)
                    .sort(
                      (a: any, b: any) =>
                        a.day_number - b.day_number ||
                        String(a.start_time || "").localeCompare(
                          String(b.start_time || ""),
                        ),
                    ),
                }))
                .filter((g) => g.slots.length > 0);

              const slotLabel = (s: any) =>
                s.band?.name ||
                s.npc_dj_name ||
                (s.is_npc_dj ? "NPC DJ" : "Unassigned");
              const fmtTime = (t: string | null) =>
                t ? String(t).slice(0, 5) : "TBA";

              const edits: { label: string; before: string; after: string }[] =
                originalDraft
                  ? [
                      {
                        label: "Name",
                        before: originalDraft.name || "—",
                        after: draftName || "—",
                      },
                      {
                        label: "Expected attendance",
                        before: originalDraft.attendance || "—",
                        after: draftAttendance || "—",
                      },
                      {
                        label: "Ticket low",
                        before: `$${originalDraft.low || "0"}`,
                        after: `$${draftLow || "0"}`,
                      },
                      {
                        label: "Ticket high",
                        before: `$${originalDraft.high || "0"}`,
                        after: `$${draftHigh || "0"}`,
                      },
                    ].filter((e) => e.before !== e.after)
                  : [];

              return (
                <div className="space-y-4">
                  <div className="rounded-md border p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span>
                        Ticket range: ${festival.ticket_price_low} – $
                        {festival.ticket_price_high}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span>
                        {format(new Date(festival.start_date), "MMM d")} –{" "}
                        {format(new Date(festival.end_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Music className="h-4 w-4 text-primary" />
                      <span>
                        {stages.length} stages • {confirmedSlots.length}{" "}
                        confirmed acts
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>
                        {approvedPermits.length} approved permits •{" "}
                        {insurance.length} active policies
                      </span>
                    </div>
                  </div>

                  {/* Wizard edits diff */}
                  {edits.length > 0 && (
                    <Card className="border-primary/40 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Edits made in this
                          wizard
                        </CardTitle>
                        <CardDescription>
                          Review changes before going live.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5 text-sm">
                          {edits.map((e, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between gap-2 flex-wrap"
                            >
                              <span className="text-muted-foreground">
                                {e.label}
                              </span>
                              <span className="font-mono text-xs">
                                <span className="line-through text-muted-foreground">
                                  {e.before}
                                </span>
                                <ArrowRight className="inline h-3 w-3 mx-1" />
                                <span className="text-primary">{e.after}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Side-by-side: Run Order vs Booked Stages */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Card className="border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" /> Run Order
                        </CardTitle>
                        <CardDescription>
                          Chronological across all stages ({runOrder.length}{" "}
                          acts)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {runOrder.length === 0 ? (
                          <p className="text-muted-foreground">
                            No confirmed acts yet.
                          </p>
                        ) : (
                          <ol className="space-y-1.5 max-h-80 overflow-auto pr-1">
                            {runOrder.map((s: any, idx: number) => {
                              const stageName =
                                stages.find((st) => st.id === s.stage_id)
                                  ?.stage_name || "Stage";
                              return (
                                <li
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 border-b border-border/40 pb-1 last:border-0"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-mono text-muted-foreground w-6">
                                      #{idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">
                                        {slotLabel(s)}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        Day {s.day_number} •{" "}
                                        {fmtTime(s.start_time)}–
                                        {fmtTime(s.end_time)} • {stageName}
                                      </div>
                                    </div>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="capitalize text-[10px]"
                                  >
                                    {String(s.slot_type).replace("_", " ")}
                                  </Badge>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Music className="h-4 w-4" /> Booked Stages
                        </CardTitle>
                        <CardDescription>
                          Grouped by stage ({bookedByStage.length}/
                          {stages.length})
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {bookedByStage.length === 0 ? (
                          <p className="text-muted-foreground">
                            No stages have bookings yet.
                          </p>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-auto pr-1">
                            {bookedByStage.map(
                              ({ stage, slots: stageSlots }) => (
                                <div key={stage.id}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="font-medium">
                                      {stage.stage_name}
                                    </div>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      {stageSlots.length} act
                                      {stageSlots.length !== 1 ? "s" : ""}
                                    </Badge>
                                  </div>
                                  <ul className="space-y-1 pl-2 border-l border-border/60">
                                    {stageSlots.map((s: any) => (
                                      <li
                                        key={s.id}
                                        className="flex items-center justify-between text-[12px]"
                                      >
                                        <span className="truncate">
                                          {slotLabel(s)}
                                        </span>
                                        <span className="text-muted-foreground font-mono text-[10px] ml-2">
                                          D{s.day_number}{" "}
                                          {fmtTime(s.start_time)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {!canLaunch && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                      <span>
                        Complete all previous steps before going live.
                      </span>
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={
                      !canLaunch ||
                      launchMutation.isPending ||
                      festival.status === "announced" ||
                      festival.status === "live"
                    }
                    onClick={() => launchMutation.mutate()}
                  >
                    {launchMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    {festival.status === "announced" ||
                    festival.status === "live"
                      ? "Festival is Live"
                      : "Go Live & Announce"}
                  </Button>
                </div>
              );
            })()}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          size="sm"
          onClick={() => setStepIdx(Math.min(STEPS.length - 1, stepIdx + 1))}
          disabled={stepIdx >= STEPS.length - 1}
        >
          Next <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </FMPageScaffold>
  );
}
