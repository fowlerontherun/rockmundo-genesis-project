import { Fragment, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Eye,
  Lock,
  Plus,
  Send,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFestivalScheduleWorkspace,
  useScheduleMutations,
} from "../hooks";
import { festivalScheduleLoadErrorMessage } from "../errors";
import {
  scheduleTemplates,
  type FestivalScheduleItem,
  type FestivalScheduleWorkspaceData,
} from "../model";
import {
  buildFestivalSlotInstants,
  buildFestivalTimelineSlots,
  festivalDateLabel,
  festivalDateTimeInputToIso,
  findStageOperatingHours,
  formatFestivalDateTimeInput,
  formatFestivalTime,
  itemStartsInTimelineSlot,
  type FestivalTimelineSlot,
} from "../time";

type DataRecord = Record<string, unknown>;
type ConflictRecord = Record<string, unknown>;

const text = (value: unknown, fallback = "—") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);

const isRecord = (value: unknown): value is DataRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stageName = (stage?: DataRecord) =>
  text(stage?.public_name ?? stage?.stage_name ?? stage?.name, "Stage");

const stageId = (stage?: DataRecord) =>
  typeof stage?.id === "string" ? stage.id : "";

const draftRevisionId = (data: FestivalScheduleWorkspaceData) =>
  typeof data.draftRevision?.id === "string" ? data.draftRevision.id : "";

const conflictItemIds = (conflict: ConflictRecord): string[] => {
  const value = conflict.itemIds ?? conflict.item_ids;
  return Array.isArray(value) ? value.map(String) : [];
};

export function FestivalScheduleWorkspace({ editionId }: { editionId: string }) {
  const query = useFestivalScheduleWorkspace(editionId);
  const [day, setDay] = useState<string>();
  const [stage, setStage] = useState<string>();
  const [selected, setSelected] = useState<FestivalScheduleItem | null>(null);

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">Loading visual schedule…</CardContent>
      </Card>
    );
  }
  if (query.error || !query.data) {
    return (
      <Card>
        <CardContent className="p-6 text-destructive">
          {festivalScheduleLoadErrorMessage(query.error)}
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  const activeDay =
    day && data.festivalDates.includes(day) ? day : data.festivalDates[0];
  const firstStageId = stageId(data.stages[0]);
  const activeStage =
    stage && data.stages.some((item) => stageId(item) === stage)
      ? stage
      : firstStageId;
  const items = activeDay
    ? data.scheduleItems.filter((item) => item.festival_date === activeDay)
    : [];
  const rawConflicts = data.conflictSummary.items;
  const conflicts = Array.isArray(rawConflicts)
    ? rawConflicts.filter(isRecord)
    : [];
  const timelineSlots = activeDay
    ? buildFestivalTimelineSlots({
        festivalDate: activeDay,
        timeZone: data.timeZone,
        operatingHours: data.operatingHours,
        items,
      })
    : [];

  return (
    <div className="space-y-4">
      <FestivalScheduleHeader data={data} editionId={editionId} />
      {activeDay ? (
        <>
          <FestivalDayTabs
            days={data.festivalDates}
            value={activeDay}
            timeZone={data.timeZone}
            onChange={setDay}
          />
          {data.stages.length > 0 && (
            <div className="lg:hidden">
              <Select value={activeStage} onValueChange={setStage}>
                <SelectTrigger>
                  <Smartphone className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.stages.map((item) => (
                    <SelectItem key={stageId(item)} value={stageId(item)}>
                      {stageName(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <FestivalTimelineBoard
            stages={data.stages}
            items={items}
            conflicts={conflicts}
            slots={timelineSlots}
            timeZone={data.timeZone}
            onSelect={setSelected}
          />
          <FestivalMobileAgenda
            stageIdValue={activeStage}
            stages={data.stages}
            items={items}
            conflicts={conflicts}
            timeZone={data.timeZone}
            onSelect={setSelected}
          />
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This edition has no Festival dates configured yet.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <FestivalUnscheduledPanel
          items={data.unscheduledItems}
          timeZone={data.timeZone}
          onSelect={setSelected}
        />
        <FestivalScheduleConflictPanel conflicts={conflicts} />
      </div>
      <FestivalScheduleInspector
        item={selected}
        data={data}
        onClose={() => setSelected(null)}
        editionId={editionId}
      />
    </div>
  );
}

function FestivalScheduleHeader({
  data,
  editionId,
}: {
  data: FestivalScheduleWorkspaceData;
  editionId: string;
}) {
  const mutations = useScheduleMutations(editionId);
  const blockers = Number(data.conflictSummary.blockingCount ?? 0);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-2xl font-bold">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Revision {text(data.draftRevision?.revision_number)} · {data.timeZone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={data.scheduleState === "published" ? "default" : "secondary"}
          >
            {data.scheduleState}
          </Badge>
          {blockers > 0 && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {blockers} blockers
            </Badge>
          )}
          <TemplateDialog data={data} editionId={editionId} />
          <ManualSlotDialog data={data} editionId={editionId} />
          <PublishDialog
            data={data}
            editionId={editionId}
            disabled={blockers > 0 || mutations.publish.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FestivalDayTabs({
  days,
  value,
  timeZone,
  onChange,
}: {
  days: string[];
  value: string;
  timeZone: string;
  onChange: (value: string) => void;
}) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="flex h-auto flex-wrap">
        {days.map((festivalDate) => (
          <TabsTrigger key={festivalDate} value={festivalDate}>
            {festivalDateLabel(festivalDate, timeZone)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function FestivalTimelineBoard({
  stages,
  items,
  conflicts,
  slots,
  timeZone,
  onSelect,
}: {
  stages: DataRecord[];
  items: FestivalScheduleItem[];
  conflicts: ConflictRecord[];
  slots: FestivalTimelineSlot[];
  timeZone: string;
  onSelect: (item: FestivalScheduleItem) => void;
}) {
  if (stages.length === 0) {
    return (
      <Card className="hidden lg:block">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Complete site planning for this annual edition before building its schedule.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hidden overflow-auto lg:block">
      <CardContent className="min-w-[900px] p-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `7rem repeat(${stages.length}, minmax(13rem,1fr))`,
          }}
        >
          <div className="sticky top-0 z-10 border-b bg-card p-3 font-semibold">
            Time
          </div>
          {stages.map((item) => (
            <div
              key={stageId(item)}
              className="sticky top-0 z-10 border-b border-l bg-card p-3 font-semibold"
            >
              {stageName(item)}
            </div>
          ))}
          {slots.map((slot) => (
            <Fragment key={slot.key}>
              <div className="border-b p-3 text-sm text-muted-foreground">
                {slot.label}
              </div>
              {stages.map((stageItem) => (
                <div
                  key={`${stageId(stageItem)}-${slot.key}`}
                  className="min-h-24 border-b border-l p-2"
                >
                  {items
                    .filter(
                      (item) =>
                        item.stage_id === stageId(stageItem) &&
                        itemStartsInTimelineSlot(item, slot),
                    )
                    .map((item) => (
                      <ScheduleItem
                        key={item.id}
                        item={item}
                        conflicts={conflicts}
                        timeZone={timeZone}
                        onSelect={onSelect}
                      />
                    ))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FestivalMobileAgenda({
  stageIdValue,
  stages,
  items,
  conflicts,
  timeZone,
  onSelect,
}: {
  stageIdValue: string;
  stages: DataRecord[];
  items: FestivalScheduleItem[];
  conflicts: ConflictRecord[];
  timeZone: string;
  onSelect: (item: FestivalScheduleItem) => void;
}) {
  const stageItems = items
    .filter((item) => item.stage_id === stageIdValue)
    .sort((a, b) => text(a.starts_at).localeCompare(text(b.starts_at)));
  return (
    <Card className="lg:hidden">
      <CardHeader>
        <CardTitle>
          {stageName(stages.find((item) => stageId(item) === stageIdValue))} agenda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Complete site planning for this annual edition before building its schedule.
          </p>
        ) : stageItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items on this stage/day.
          </p>
        ) : (
          stageItems.map((item) => (
            <ScheduleItem
              key={item.id}
              item={item}
              conflicts={conflicts}
              timeZone={timeZone}
              onSelect={onSelect}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleItem({
  item,
  conflicts,
  timeZone,
  onSelect,
}: {
  item: FestivalScheduleItem;
  conflicts: ConflictRecord[];
  timeZone: string;
  onSelect: (item: FestivalScheduleItem) => void;
}) {
  const hasConflict = conflicts.some((conflict) =>
    conflictItemIds(conflict).includes(item.id),
  );
  return (
    <button
      type="button"
      className="mb-2 w-full rounded-lg border bg-background p-2 text-left shadow-sm hover:bg-muted"
      onClick={() => onSelect(item)}
    >
      <div className="flex items-center justify-between gap-2">
        <b>
          {formatFestivalTime(item.starts_at, timeZone)}–
          {formatFestivalTime(item.ends_at, timeZone)}
        </b>
        {hasConflict && (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Conflict
          </Badge>
        )}
      </div>
      <p>{item.title}</p>
      <p className="text-xs text-muted-foreground">
        {item.item_type} · {item.duration_minutes} min {item.locked && <Lock className="inline h-3 w-3" />}
      </p>
    </button>
  );
}

function FestivalUnscheduledPanel({
  items,
  timeZone,
  onSelect,
}: {
  items: FestivalScheduleItem[];
  timeZone: string;
  onSelect: (item: FestivalScheduleItem) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unscheduled items</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unscheduled items.</p>
        ) : (
          items.map((item) => (
            <ScheduleItem
              key={item.id}
              item={item}
              conflicts={[]}
              timeZone={timeZone}
              onSelect={onSelect}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FestivalScheduleConflictPanel({
  conflicts,
}: {
  conflicts: ConflictRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conflict warnings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conflicts detected.</p>
        ) : (
          conflicts.map((conflict, index) => (
            <div key={`${text(conflict.code, "conflict")}-${index}`} className="rounded border p-2 text-sm">
              <Badge variant={conflict.blocksPublication ? "destructive" : "secondary"}>
                {text(conflict.severity)}
              </Badge>
              <p className="font-medium">{text(conflict.message)}</p>
              <p className="text-muted-foreground">
                {text(conflict.suggestedResolution)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FestivalScheduleInspector({
  item,
  data,
  onClose,
  editionId,
}: {
  item: FestivalScheduleItem | null;
  data: FestivalScheduleWorkspaceData;
  onClose: () => void;
  editionId: string;
}) {
  return item ? (
    <FestivalScheduleInspectorDialog
      key={item.id}
      item={item}
      data={data}
      onClose={onClose}
      editionId={editionId}
    />
  ) : null;
}

function FestivalScheduleInspectorDialog({
  item,
  data,
  onClose,
  editionId,
}: {
  item: FestivalScheduleItem;
  data: FestivalScheduleWorkspaceData;
  onClose: () => void;
  editionId: string;
}) {
  const mutations = useScheduleMutations(editionId);
  const [title, setTitle] = useState(item.title);
  const [itemType, setItemType] = useState(item.item_type);
  const [startsAt, setStartsAt] = useState(
    formatFestivalDateTimeInput(item.starts_at, data.timeZone),
  );
  const [endsAt, setEndsAt] = useState(
    formatFestivalDateTimeInput(item.ends_at, data.timeZone),
  );
  const [notes, setNotes] = useState(item.internal_notes ?? "");
  const [error, setError] = useState<string>();
  const revisionId = draftRevisionId(data);

  const save = () => {
    try {
      const startsAtIso = festivalDateTimeInputToIso(startsAt, data.timeZone);
      const endsAtIso = festivalDateTimeInputToIso(endsAt, data.timeZone);
      const durationMinutes = Math.round(
        (Date.parse(endsAtIso) - Date.parse(startsAtIso)) / 60_000,
      );
      if (durationMinutes <= 0) throw new Error("festival_schedule_invalid_range");
      setError(undefined);
      mutations.upsertItem.mutate({
        editionId,
        revisionId,
        expectedVersion: item.version,
        idempotencyKey: `edit:${item.id}:${crypto.randomUUID()}`,
        item: {
          id: item.id,
          title,
          itemType,
          stageId: item.stage_id,
          festivalDate: item.festival_date,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          internalNotes: notes,
          durationMinutes,
        },
      });
    } catch {
      setError("Enter a valid Festival-local start and end time, with the end after the start.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule item inspector</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Times are entered in {data.timeZone}. They are converted to UTC only when saved.
          </p>
          <Label>
            Title
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Label>
          <Label>
            Type
            <Input value={itemType} onChange={(event) => setItemType(event.target.value)} />
          </Label>
          <Label>
            Start
            <Input
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              type="datetime-local"
            />
          </Label>
          <Label>
            End
            <Input
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              type="datetime-local"
            />
          </Label>
          <Label>
            Internal notes
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!revisionId || mutations.upsertItem.isPending} onClick={save}>
              Save draft
            </Button>
            <Button
              variant="outline"
              disabled={!revisionId || mutations.upsertItem.isPending}
              onClick={() =>
                mutations.upsertItem.mutate({
                  editionId,
                  revisionId,
                  expectedVersion: item.version,
                  idempotencyKey: `unschedule:${item.id}:${crypto.randomUUID()}`,
                  item: {
                    id: item.id,
                    title: item.title,
                    itemType: item.item_type,
                    stageId: null,
                    festivalDate: null,
                    startsAt: null,
                    endsAt: null,
                    durationMinutes: item.duration_minutes,
                  },
                })
              }
            >
              Move to unscheduled
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManualSlotDialog({
  data,
  editionId,
}: {
  data: FestivalScheduleWorkspaceData;
  editionId: string;
}) {
  const mutations = useScheduleMutations(editionId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("New performance slot");
  const [selectedStage, setSelectedStage] = useState(stageId(data.stages[0]));
  const [festivalDate, setFestivalDate] = useState(data.festivalDates[0] ?? "");
  const [localStartTime, setLocalStartTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [error, setError] = useState<string>();
  const revisionId = draftRevisionId(data);

  const create = () => {
    try {
      if (!selectedStage || !festivalDate || !revisionId || !title.trim()) {
        throw new Error("festival_schedule_manual_slot_incomplete");
      }
      const operatingHours = findStageOperatingHours(
        data.operatingHours,
        selectedStage,
        festivalDate,
      );
      const instants = buildFestivalSlotInstants({
        festivalDate,
        localStartTime,
        durationMinutes,
        timeZone: data.timeZone,
        operatingHours,
      });
      setError(undefined);
      mutations.upsertItem.mutate(
        {
          editionId,
          revisionId,
          idempotencyKey: `manual:${revisionId}:${crypto.randomUUID()}`,
          item: {
            title: title.trim(),
            itemType: "performance_slot",
            stageId: selectedStage,
            festivalDate,
            startsAt: instants.startsAt,
            endsAt: instants.endsAt,
            durationMinutes,
            publicVisible: true,
          },
        },
        { onSuccess: () => setOpen(false) },
      );
    } catch {
      setError("Choose a stage, Festival date, valid local start time and positive duration.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={data.stages.length === 0 || !revisionId}>
          <Plus className="mr-2 h-4 w-4" />
          Manual slot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create schedule item</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Enter the advertised local time in {data.timeZone}. Early-morning times are assigned to the next calendar day when the selected stage has an overnight curfew.
          </p>
          <Label>
            Title
            <Input
              placeholder="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Label>
          <Label>
            Stage
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.stages.map((item) => (
                  <SelectItem key={stageId(item)} value={stageId(item)}>
                    {stageName(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label>
            Festival operating date
            <Input
              type="date"
              value={festivalDate}
              onChange={(event) => setFestivalDate(event.target.value)}
            />
          </Label>
          <Label>
            Local start time
            <Input
              type="time"
              value={localStartTime}
              onChange={(event) => setLocalStartTime(event.target.value)}
            />
          </Label>
          <Label>
            Duration in minutes
            <Input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            />
          </Label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={mutations.upsertItem.isPending} onClick={create}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  data,
  editionId,
}: {
  data: FestivalScheduleWorkspaceData;
  editionId: string;
}) {
  const mutations = useScheduleMutations(editionId);
  const [template, setTemplate] = useState("standard_stage");
  const [preview, setPreview] = useState<unknown>();
  const selectedStage = stageId(data.stages[0]);
  const festivalDate = data.festivalDates[0] ?? "";
  const operatingHours = findStageOperatingHours(
    data.operatingHours,
    selectedStage,
    festivalDate,
  );
  const openingTime = operatingHours
    ? formatFestivalTime(operatingHours.opens_at, data.timeZone)
    : "12:00";
  const curfew = operatingHours
    ? formatFestivalTime(operatingHours.curfew_at, data.timeZone)
    : "23:00";
  const revisionId = draftRevisionId(data);
  const previewItems =
    isRecord(preview) && Array.isArray(preview.items) ? preview.items : [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!selectedStage || !festivalDate || !revisionId}>
          <Clock className="mr-2 h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preview and apply template</DialogTitle>
        </DialogHeader>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scheduleTemplates.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {openingTime}–{curfew} in {data.timeZone}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              mutations.previewTemplate.mutate(
                {
                  editionId,
                  stageId: selectedStage,
                  date: festivalDate,
                  template,
                  openingTime,
                  curfew,
                },
                { onSuccess: setPreview },
              )
            }
          >
            Preview
          </Button>
          <Button
            onClick={() =>
              mutations.applyTemplate.mutate({
                editionId,
                revisionId,
                stageId: selectedStage,
                date: festivalDate,
                template,
                openingTime,
                curfew,
                confirmOverwrite: false,
              })
            }
          >
            Apply transactionally
          </Button>
        </div>
        <div className="max-h-64 overflow-auto rounded border p-2 text-sm">
          {previewItems.length > 0
            ? previewItems.map((value, index) => {
                const item = isRecord(value) ? value : {};
                return (
                  <p key={`${text(item.title, "item")}-${index}`}>
                    {text(item.title)}: {text(item.startsAt)} → {text(item.endsAt)}
                  </p>
                );
              })
            : "Preview shows generated items, changeovers, unused time and conflicts."}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog({
  data,
  editionId,
  disabled,
}: {
  data: FestivalScheduleWorkspaceData;
  editionId: string;
  disabled: boolean;
}) {
  const mutations = useScheduleMutations(editionId);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const blockers = Number(data.conflictSummary.blockingCount ?? 0);
  const warnings = Number(data.conflictSummary.warningCount ?? 0);
  const revisionId = draftRevisionId(data);
  const requiresAcknowledgement = warnings > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled || !revisionId}>
          <Send className="mr-2 h-4 w-4" />
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish review</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            Revision {text(data.draftRevision?.revision_number)} · {data.festivalDates.length} days · {data.stages.length} stages.
          </p>
          <p>
            {data.scheduleItems.length} scheduled items · {data.unscheduledItems.length} unscheduled · {blockers} blocking conflicts · {warnings} warnings.
          </p>
          {requiresAcknowledgement && (
            <Label className="flex items-start gap-2 rounded border p-3">
              <input
                type="checkbox"
                checked={acknowledgeWarnings}
                onChange={(event) => setAcknowledgeWarnings(event.target.checked)}
              />
              I have reviewed and accept the non-blocking schedule warnings.
            </Label>
          )}
          <Button
            disabled={
              blockers > 0 ||
              mutations.publish.isPending ||
              (requiresAcknowledgement && !acknowledgeWarnings)
            }
            onClick={() =>
              mutations.publish.mutate({
                editionId,
                revisionId,
                acknowledgeWarnings:
                  !requiresAcknowledgement || acknowledgeWarnings,
              })
            }
          >
            <Eye className="mr-2 h-4 w-4" />
            Publish schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FestivalScheduleWorkspace;
