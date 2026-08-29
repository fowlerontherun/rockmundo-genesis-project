import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileCheck2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Shirt,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TOUR_OPERATIONS_QUERY_KEY,
  applyTourOperationTemplate,
  completeTourOperationsReport,
  getTourOperationsWorkspace,
  recordTourLogisticsEvent,
  resolveTourLogisticsEvent,
  saveTourOperationTemplate,
  saveTourOperationsPlan,
  tourOperationsErrorMessage,
  workspaceToEditablePlan,
  type SponsorObligationType,
  type TourLogisticsEventType,
  type TourOperationCrewMember,
  type TourOperationEquipmentItem,
  type TourOperationsPlan,
  type TourSponsorObligation,
} from "@/lib/api/tourOperations";

interface LiveTourHQPanelProps {
  tourId: string;
  tourStatus: string;
}

const eventOptions: Array<{ value: TourLogisticsEventType; label: string }> = [
  { value: "vehicle_breakdown", label: "Vehicle breakdown" },
  { value: "flight_delay", label: "Flight delay" },
  { value: "lost_luggage", label: "Lost luggage" },
  { value: "food_poisoning", label: "Food poisoning" },
  { value: "sponsor_dinner", label: "Sponsor dinner" },
  { value: "fan_meet_greet", label: "Fan meet-and-greet" },
  { value: "local_media_interview", label: "Local media interview" },
  { value: "weather_delay", label: "Weather delay" },
  { value: "customs_inspection", label: "Customs inspection" },
  { value: "equipment_delivery_issue", label: "Equipment delivery issue" },
  { value: "unexpected_upgrade", label: "Unexpected upgrade" },
  { value: "hotel_overbooking", label: "Hotel overbooking" },
];

const sponsorTypes: Array<{ value: SponsorObligationType; label: string }> = [
  { value: "meet_fans", label: "Meet fans" },
  { value: "social_post", label: "Social post" },
  { value: "vip_appearance", label: "VIP appearance" },
  { value: "interview", label: "Interview" },
  { value: "merch_promotion", label: "Merch promotion" },
];

const money = (value: number) => `£${Math.round(value).toLocaleString()}`;
const readable = (value: string) => value.replaceAll("_", " ");
const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  : "Not scheduled";

const nextCrewMember = (): TourOperationCrewMember => ({
  display_name: "",
  role: "",
  daily_cost: 0,
  fatigue_score: 0,
  morale_score: 70,
  accommodation_status: "unassigned",
  transport_status: "pending",
});

const nextEquipmentItem = (): TourOperationEquipmentItem => ({
  name: "",
  equipment_source: "planned",
  role: "",
  load_weight: 0,
  condition_snapshot: 100,
  is_spare: false,
  in_transit: false,
  needs_repair: false,
  replacement_cost: 0,
});

const nextSponsor = (): TourSponsorObligation => ({
  sponsor_name: "",
  obligation_type: "meet_fans",
  value_amount: 0,
  status: "pending",
  notes: "",
});

const NumberInput = ({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      min={0}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  </div>
);

export function LiveTourHQPanel({ tourId, tourStatus }: LiveTourHQPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState<TourOperationsPlan | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [eventType, setEventType] = useState<TourLogisticsEventType>("weather_delay");
  const [eventNotes, setEventNotes] = useState("");

  const workspaceQuery = useQuery({
    queryKey: [TOUR_OPERATIONS_QUERY_KEY, tourId],
    queryFn: () => getTourOperationsWorkspace(tourId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const workspace = workspaceQuery.data;

  useEffect(() => {
    if (!workspace || dirty) return;
    setDraft(workspaceToEditablePlan(workspace));
    setDraftVersion(workspace.state.plan_version);
  }, [workspace, dirty]);

  const refreshWorkspace = async () => {
    await queryClient.invalidateQueries({ queryKey: [TOUR_OPERATIONS_QUERY_KEY, tourId] });
  };

  const notifyError = (error: unknown) => {
    toast({
      title: "Tour HQ update failed",
      description: tourOperationsErrorMessage(error),
      variant: "destructive",
    });
  };

  const savePlanMutation = useMutation({
    mutationFn: () => saveTourOperationsPlan(tourId, draftVersion, draft!),
    onSuccess: async () => {
      setDirty(false);
      toast({ title: "Tour plan saved", description: "The live Tour HQ plan is now available in every session." });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: () => saveTourOperationTemplate(tourId, templateName.trim(), draft!),
    onSuccess: async () => {
      setTemplateName("");
      toast({ title: "Template saved", description: "This band can reuse the plan on another tour." });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => applyTourOperationTemplate(tourId, templateId, workspace!.state.plan_version),
    onSuccess: async () => {
      setDirty(false);
      toast({ title: "Template applied", description: "Crew, equipment, merchandise, sponsors and settings were refreshed." });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const recordEventMutation = useMutation({
    mutationFn: () => recordTourLogisticsEvent(tourId, eventType, eventNotes.trim() || undefined),
    onSuccess: async () => {
      setEventNotes("");
      toast({ title: "Logistics event recorded", description: "The server applied its canonical cost, fatigue and morale effects." });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const resolveEventMutation = useMutation({
    mutationFn: (eventId: string) => resolveTourLogisticsEvent(tourId, eventId),
    onSuccess: async () => {
      toast({ title: "Logistics event resolved" });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const reportMutation = useMutation({
    mutationFn: () => completeTourOperationsReport(tourId),
    onSuccess: async () => {
      toast({ title: "Tour report generated", description: "The report was derived from canonical gig and operations records." });
      await refreshWorkspace();
    },
    onError: notifyError,
  });

  const pending = savePlanMutation.isPending
    || saveTemplateMutation.isPending
    || applyTemplateMutation.isPending
    || recordEventMutation.isPending
    || resolveEventMutation.isPending
    || reportMutation.isPending;

  const productionTone = useMemo(() => {
    if (workspace?.state.production_status === "blocked") return "destructive" as const;
    if (workspace?.state.production_status === "at_risk") return "secondary" as const;
    return "default" as const;
  }, [workspace?.state.production_status]);

  const updateDraft = (updater: (current: TourOperationsPlan) => TourOperationsPlan) => {
    setDraft((current) => current ? updater(current) : current);
    setDirty(true);
  };

  if (workspaceQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading live Tour HQ…
        </CardContent>
      </Card>
    );
  }

  if (workspaceQuery.isError || !workspace) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Tour HQ is unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{tourOperationsErrorMessage(workspaceQuery.error)}</p>
          <Button size="sm" variant="outline" onClick={() => workspaceQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!draft) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Preparing the live plan…
        </CardContent>
      </Card>
    );
  }

  const canManage = workspace.can_manage;
  const hasNewerVersion = dirty && workspace.state.plan_version !== draftVersion;
  const completedPct = workspace.live.progress.total > 0
    ? (workspace.live.progress.completed / workspace.live.progress.total) * 100
    : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Live Tour HQ
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Canonical operations · version {workspace.state.plan_version} · refreshed {formatDate(workspace.generated_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={productionTone}>{readable(workspace.state.production_status)}</Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={workspaceQuery.isFetching}
              onClick={() => workspaceQuery.refetch()}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", workspaceQuery.isFetching && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        {!canManage && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Read-only Tour HQ</AlertTitle>
            <AlertDescription>You can follow the live plan, but only a band leader or manager can change it.</AlertDescription>
          </Alert>
        )}

        {hasNewerVersion && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>A newer plan is available</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>Your draft is based on version {draftVersion}. Refresh before saving to avoid overwriting another session.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDirty(false);
                  setDraft(workspaceToEditablePlan(workspace));
                  setDraftVersion(workspace.state.plan_version);
                }}
              >
                Load version {workspace.state.plan_version}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Shows completed</p>
                  <p className="text-2xl font-bold">{workspace.live.progress.completed}/{workspace.live.progress.total}</p>
                  <Progress value={completedPct} className="mt-2 h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Next stop</p>
                  <p className="truncate text-lg font-bold">{workspace.live.next_stop?.city_name ?? "Tour complete"}</p>
                  <p className="truncate text-xs text-muted-foreground">{workspace.live.next_stop?.venue_name ?? "No remaining venue"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Realised revenue</p>
                  <p className="text-2xl font-bold text-green-500">{money(workspace.live.finance.realised_revenue)}</p>
                  <p className="text-xs text-muted-foreground">Upfront {money(workspace.live.finance.upfront_cost)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Operations roster</p>
                  <p className="text-2xl font-bold">{workspace.crew.length} crew · {workspace.equipment.length} items</p>
                  <p className="text-xs text-muted-foreground">{workspace.events.filter((event) => !event.resolved).length} open events</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base"><CalendarDays className="mr-2 inline h-4 w-4" />Live itinerary</CardTitle></CardHeader>
                <CardContent className="max-h-80 space-y-2 overflow-y-auto">
                  {workspace.live.stops.map((stop) => (
                    <div key={stop.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{stop.city_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{stop.venue_name} · {formatDate(stop.date)}</p>
                      </div>
                      <Badge variant={stop.status === "completed" ? "default" : "outline"}>{readable(stop.status)}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base"><AlertTriangle className="mr-2 inline h-4 w-4" />Outstanding issues</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {workspace.events.filter((event) => !event.resolved).length === 0 && workspace.live.issues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unresolved operational issues.</p>
                  ) : (
                    <>
                      {workspace.events.filter((event) => !event.resolved).map((event) => (
                        <div key={event.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium capitalize">{readable(event.event_type)}</p>
                            <Badge variant={event.severity === "critical" ? "destructive" : "secondary"}>{event.severity}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                        </div>
                      ))}
                      {workspace.live.issues.map((issue, index) => (
                        <div key={`${issue.code ?? "issue"}-${index}`} className="rounded-md border p-3 text-sm">{issue.message}</div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {workspace.ledger.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base"><Coins className="mr-2 inline h-4 w-4" />Operations ledger</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {workspace.ledger.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate capitalize">{entry.description ?? readable(entry.category)}</span>
                      <span className={entry.direction === "income" ? "text-green-500" : "text-destructive"}>
                        {entry.direction === "income" ? "+" : "−"}{money(entry.amount)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plan" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base"><Sparkles className="mr-2 inline h-4 w-4" />Production settings</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {(["production_package", "lighting_package", "audio_package"] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`tour-${field}`} className="capitalize">{readable(field)}</Label>
                    <Input
                      id={`tour-${field}`}
                      value={draft.settings[field]}
                      disabled={!canManage}
                      maxLength={80}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        settings: { ...current.settings, [field]: event.target.value },
                      }))}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="tour-vehicle-tier">Vehicle setup</Label>
                  <Input
                    id="tour-vehicle-tier"
                    placeholder="e.g. sleeper bus"
                    value={String(draft.settings.vehicle_setup.tier ?? "")}
                    disabled={!canManage}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        vehicle_setup: { ...current.settings.vehicle_setup, tier: event.target.value },
                      },
                    }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tour-accommodation-quality">Accommodation</Label>
                  <Input
                    id="tour-accommodation-quality"
                    placeholder="e.g. standard hotel"
                    value={String(draft.settings.accommodation_preferences.quality ?? "")}
                    disabled={!canManage}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        accommodation_preferences: {
                          ...current.settings.accommodation_preferences,
                          quality: event.target.value,
                        },
                      },
                    }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base"><Users className="mr-2 inline h-4 w-4" />Crew schedule</CardTitle>
                {canManage && <Button size="sm" variant="outline" onClick={() => updateDraft((current) => ({ ...current, crew: [...current.crew, nextCrewMember()] }))}><Plus className="mr-2 h-4 w-4" />Add crew</Button>}
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.crew.length === 0 && <p className="text-sm text-muted-foreground">No crew scheduled yet.</p>}
                {draft.crew.map((member, index) => (
                  <div key={member.id ?? `crew-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-5">
                    <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input value={member.display_name} disabled={!canManage} maxLength={120} onChange={(event) => updateDraft((current) => ({ ...current, crew: current.crew.map((item, itemIndex) => itemIndex === index ? { ...item, display_name: event.target.value } : item) }))} /></div>
                    <div className="space-y-1.5"><Label>Role</Label><Input value={member.role} disabled={!canManage} maxLength={80} onChange={(event) => updateDraft((current) => ({ ...current, crew: current.crew.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) }))} /></div>
                    <NumberInput id={`crew-cost-${index}`} label="Daily cost" value={member.daily_cost} disabled={!canManage} onChange={(value) => updateDraft((current) => ({ ...current, crew: current.crew.map((item, itemIndex) => itemIndex === index ? { ...item, daily_cost: value } : item) }))} />
                    <div className="flex items-end"><Button aria-label={`Remove ${member.display_name || "crew member"}`} size="icon" variant="ghost" disabled={!canManage} onClick={() => updateDraft((current) => ({ ...current, crew: current.crew.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base"><Package className="mr-2 inline h-4 w-4" />Equipment manifest</CardTitle>
                {canManage && <Button size="sm" variant="outline" onClick={() => updateDraft((current) => ({ ...current, equipment: [...current.equipment, nextEquipmentItem()] }))}><Plus className="mr-2 h-4 w-4" />Add item</Button>}
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.equipment.length === 0 && <p className="text-sm text-muted-foreground">No equipment assigned yet.</p>}
                {draft.equipment.map((item, index) => (
                  <div key={item.id ?? `equipment-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-6">
                    <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input value={item.name} disabled={!canManage} maxLength={120} onChange={(event) => updateDraft((current) => ({ ...current, equipment: current.equipment.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry) }))} /></div>
                    <div className="space-y-1.5"><Label>Role</Label><Input value={item.role} disabled={!canManage} maxLength={80} onChange={(event) => updateDraft((current) => ({ ...current, equipment: current.equipment.map((entry, itemIndex) => itemIndex === index ? { ...entry, role: event.target.value } : entry) }))} /></div>
                    <NumberInput id={`equipment-weight-${index}`} label="Weight (kg)" value={item.load_weight} disabled={!canManage} onChange={(value) => updateDraft((current) => ({ ...current, equipment: current.equipment.map((entry, itemIndex) => itemIndex === index ? { ...entry, load_weight: value } : entry) }))} />
                    <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={item.is_spare} disabled={!canManage} onChange={(event) => updateDraft((current) => ({ ...current, equipment: current.equipment.map((entry, itemIndex) => itemIndex === index ? { ...entry, is_spare: event.target.checked } : entry) }))} /> Spare</label>
                    <div className="flex items-end"><Button aria-label={`Remove ${item.name || "equipment item"}`} size="icon" variant="ghost" disabled={!canManage} onClick={() => updateDraft((current) => ({ ...current, equipment: current.equipment.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base"><Shirt className="mr-2 inline h-4 w-4" />Merchandise plan</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["starting_stock", "Starting stock"],
                  ["unit_cost", "Unit cost"],
                  ["unit_price", "Unit price"],
                  ["reorder_quantity", "Reorder quantity"],
                  ["reorder_cost", "Reorder cost"],
                  ["shipping_cost", "Shipping cost"],
                  ["storage_cost_per_day", "Storage / day"],
                ] as const).map(([field, label]) => (
                  <NumberInput key={field} id={`merch-${field}`} label={label} value={draft.merchandise[field]} disabled={!canManage} onChange={(value) => updateDraft((current) => ({ ...current, merchandise: { ...current.merchandise, [field]: value } }))} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base"><Sparkles className="mr-2 inline h-4 w-4" />Sponsor obligations</CardTitle>
                {canManage && <Button size="sm" variant="outline" onClick={() => updateDraft((current) => ({ ...current, sponsors: [...current.sponsors, nextSponsor()] }))}><Plus className="mr-2 h-4 w-4" />Add obligation</Button>}
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.sponsors.length === 0 && <p className="text-sm text-muted-foreground">No sponsor obligations planned.</p>}
                {draft.sponsors.map((sponsor, index) => (
                  <div key={sponsor.id ?? `sponsor-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-5">
                    <div className="space-y-1.5 md:col-span-2"><Label>Sponsor</Label><Input value={sponsor.sponsor_name} disabled={!canManage} maxLength={120} onChange={(event) => updateDraft((current) => ({ ...current, sponsors: current.sponsors.map((item, itemIndex) => itemIndex === index ? { ...item, sponsor_name: event.target.value } : item) }))} /></div>
                    <div className="space-y-1.5"><Label>Obligation</Label><Select value={sponsor.obligation_type} disabled={!canManage} onValueChange={(value: SponsorObligationType) => updateDraft((current) => ({ ...current, sponsors: current.sponsors.map((item, itemIndex) => itemIndex === index ? { ...item, obligation_type: value } : item) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sponsorTypes.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                    <NumberInput id={`sponsor-value-${index}`} label="Value" value={sponsor.value_amount} disabled={!canManage} onChange={(value) => updateDraft((current) => ({ ...current, sponsors: current.sponsors.map((item, itemIndex) => itemIndex === index ? { ...item, value_amount: value } : item) }))} />
                    <div className="flex items-end"><Button aria-label={`Remove ${sponsor.sponsor_name || "sponsor obligation"}`} size="icon" variant="ghost" disabled={!canManage} onClick={() => updateDraft((current) => ({ ...current, sponsors: current.sponsors.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {canManage && (
              <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
                <p className="text-sm text-muted-foreground">{dirty ? `Unsaved changes based on version ${draftVersion}` : "Plan is up to date"}</p>
                <Button disabled={!dirty || pending || hasNewerVersion} onClick={() => savePlanMutation.mutate()}>
                  {savePlanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save live plan
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            {canManage && (
              <Card>
                <CardHeader><CardTitle className="text-base">Save current draft as a band template</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Input value={templateName} maxLength={80} placeholder="e.g. UK club tour" onChange={(event) => setTemplateName(event.target.value)} />
                  <Button disabled={!templateName.trim() || pending} onClick={() => saveTemplateMutation.mutate()}>
                    {saveTemplateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save template
                  </Button>
                </CardContent>
              </Card>
            )}
            {workspace.templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">This band has no saved tour templates yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {workspace.templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader><CardTitle className="text-base">{template.name}</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-muted-foreground">{template.crew.length} crew · {template.equipment.length} equipment · {template.sponsors.length} sponsor obligations</p>
                      <div className="flex flex-wrap gap-2"><Badge variant="outline">{template.production_package}</Badge><Badge variant="outline">{template.lighting_package} lighting</Badge><Badge variant="outline">{template.audio_package} audio</Badge></div>
                      {canManage && <Button className="w-full" variant="outline" disabled={pending || dirty} onClick={() => applyTemplateMutation.mutate(template.id)}>Apply to this tour</Button>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {canManage && (
              <Card>
                <CardHeader><CardTitle className="text-base"><Wrench className="mr-2 inline h-4 w-4" />Record operational event</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={eventType} onValueChange={(value: TourLogisticsEventType) => setEventType(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{eventOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea value={eventNotes} maxLength={500} placeholder="Optional context; canonical impacts are calculated by the server." onChange={(event) => setEventNotes(event.target.value)} />
                  <Button disabled={pending} onClick={() => recordEventMutation.mutate()}>
                    {recordEventMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Record event
                  </Button>
                </CardContent>
              </Card>
            )}

            {workspace.events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No logistics events recorded.</p>
            ) : workspace.events.map((event) => (
              <Card key={event.id} className={cn(!event.resolved && event.severity === "critical" && "border-destructive/50")}>
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium capitalize">{readable(event.event_type)}</p><Badge variant={event.resolved ? "outline" : event.severity === "critical" ? "destructive" : "secondary"}>{event.resolved ? "resolved" : event.severity}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Cost {money(event.cost_impact)} · fatigue {event.fatigue_impact >= 0 ? "+" : ""}{event.fatigue_impact} · morale {event.morale_impact >= 0 ? "+" : ""}{event.morale_impact}</p>
                  </div>
                  {canManage && !event.resolved && <Button size="sm" variant="outline" disabled={pending} onClick={() => resolveEventMutation.mutate(event.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve</Button>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            {workspace.report ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" />End-of-tour report</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Reputation gained</p><p className="text-2xl font-bold">+{workspace.report.reputation_gained}</p></div>
                    <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Fans gained</p><p className="text-2xl font-bold">+{workspace.report.fans_gained}</p></div>
                    <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="font-bold">{formatDate(workspace.report.completed_at)}</p></div>
                  </div>
                  {workspace.report.biggest_media_story && <Alert><Sparkles className="h-4 w-4" /><AlertTitle>Tour story</AlertTitle><AlertDescription>{workspace.report.biggest_media_story}</AlertDescription></Alert>}
                  <Separator />
                  <div><p className="mb-2 font-medium">Future planning modifiers</p><div className="flex flex-wrap gap-2">{Object.entries(workspace.report.future_planning_modifiers).map(([key, value]) => <Badge key={key} variant="outline" className="capitalize">{readable(key)}: {String(value)}</Badge>)}</div></div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <FileCheck2 className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">No completion report yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Reports use canonical gig outcomes, operations ledger, crew, equipment and logistics records.</p>
                  {canManage && tourStatus === "completed" && <Button className="mt-4" disabled={pending} onClick={() => reportMutation.mutate()}>{reportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}Generate report</Button>}
                  {tourStatus !== "completed" && <Badge variant="outline" className="mt-4">Available when the tour is completed</Badge>}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
