import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Music, Users, MapPin, Building2 } from "lucide-react";
import { format, differenceInMinutes, addDays, startOfDay } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useFestivalStages, useFestivalStageSlots, type FestivalStageSlot } from "@/hooks/useFestivalStages";

interface Festival {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  venue_id: string | null;
  total_stages: number | null;
  attendance_projection: number | null;
}

interface StaffRow {
  id: string;
  name: string;
  role: string;
  skill_level: number;
  weekly_wage_cents: number;
  hired_at: string | null;
  terminated_at: string | null;
  metadata: any;
}

const HOUR_PX = 60; // 60px per hour

function slotColor(type: string) {
  switch (type) {
    case "headliner": return "bg-yellow-500/25 border-yellow-500/60 text-yellow-100";
    case "support": return "bg-primary/25 border-primary/60";
    case "dj_session": return "bg-purple-500/25 border-purple-500/60 text-purple-100";
    default: return "bg-muted border-border";
  }
}

export default function FestivalBookingCalendar() {
  const { festivalId } = useParams();
  const navigate = useNavigate();
  const [selectedEditionId, setSelectedEditionId] = useState<string | undefined>(festivalId);

  // Current festival
  const { data: current } = useQuery<Festival | null>({
    queryKey: ["fbc-festival", festivalId],
    queryFn: async () => {
      if (!festivalId) return null;
      const { data, error } = await (supabase as any)
        .from("game_events")
        .select("id,title,start_date,end_date,location,venue_id,total_stages,attendance_projection")
        .eq("id", festivalId)
        .maybeSingle();
      if (error) throw error;
      return data as Festival | null;
    },
    enabled: !!festivalId,
  });

  // Editions: same title (any year) - simplistic edition grouping
  const { data: editions = [] } = useQuery<Festival[]>({
    queryKey: ["fbc-editions", current?.title],
    queryFn: async () => {
      if (!current?.title) return [];
      const { data, error } = await (supabase as any)
        .from("game_events")
        .select("id,title,start_date,end_date,location,venue_id,total_stages,attendance_projection")
        .eq("title", current.title)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Festival[];
    },
    enabled: !!current?.title,
  });

  const activeId = selectedEditionId || festivalId;
  const active = editions.find(e => e.id === activeId) || current || null;

  const { data: stages = [] } = useFestivalStages(activeId);
  const { data: slots = [] } = useFestivalStageSlots(activeId);

  const { data: staff = [] } = useQuery<StaffRow[]>({
    queryKey: ["fbc-staff", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data, error } = await (supabase as any)
        .from("festival_staff")
        .select("id,name,role,skill_level,weekly_wage_cents,hired_at,terminated_at,metadata")
        .eq("festival_id", activeId)
        .order("role", { ascending: true });
      if (error) throw error;
      return (data || []) as StaffRow[];
    },
    enabled: !!activeId,
  });

  const days = useMemo(() => {
    if (!active) return [] as { day: number; date: Date }[];
    const start = startOfDay(new Date(active.start_date));
    const end = startOfDay(new Date(active.end_date));
    const total = Math.max(1, differenceInMinutes(end, start) / (60 * 24) + 1);
    return Array.from({ length: Math.round(total) }, (_, i) => ({ day: i + 1, date: addDays(start, i) }));
  }, [active]);

  // Extract shifts from staff metadata: metadata.shifts = [{day, role?, start:"HH:mm", end:"HH:mm", note?}]
  type Shift = { staff_id: string; name: string; role: string; day: number; start: string; end: string; note?: string };
  const shifts: Shift[] = useMemo(() => {
    const out: Shift[] = [];
    for (const s of staff) {
      const raw = s.metadata?.shifts;
      if (Array.isArray(raw)) {
        for (const sh of raw) {
          if (!sh || typeof sh !== "object") continue;
          out.push({
            staff_id: s.id,
            name: s.name,
            role: sh.role || s.role,
            day: Number(sh.day) || 1,
            start: String(sh.start || "10:00"),
            end: String(sh.end || "22:00"),
            note: sh.note,
          });
        }
      }
    }
    return out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  }, [staff]);

  const shiftsByDay = useMemo(() => {
    const m = new Map<number, Shift[]>();
    for (const sh of shifts) {
      const arr = m.get(sh.day) || [];
      arr.push(sh);
      m.set(sh.day, arr);
    }
    return m;
  }, [shifts]);

  // For each day figure hour window
  const dayWindow = (day: number) => {
    const s = slots.filter(x => x.day_number === day && x.start_time && x.end_time);
    if (s.length === 0) return { startHour: 10, endHour: 24 };
    let minH = 24, maxH = 0;
    for (const x of s) {
      const st = new Date(x.start_time!);
      const en = new Date(x.end_time!);
      minH = Math.min(minH, st.getHours());
      maxH = Math.max(maxH, en.getHours() + (en.getMinutes() > 0 ? 1 : 0));
    }
    if (maxH <= minH) maxH = minH + 1;
    return { startHour: Math.max(0, minH - 1), endHour: Math.min(30, maxH + 1) };
  };

  const performerName = (s: FestivalStageSlot) => s.band?.name || (s.is_npc_dj ? s.npc_dj_name || "NPC DJ" : "TBA");

  return (
    <FMPageScaffold
      title="Booking Calendar"
      subtitle={active ? `${active.title} • ${format(new Date(active.start_date), "MMM d")} – ${format(new Date(active.end_date), "MMM d, yyyy")}` : "Festival schedule"}
      icon={Calendar}
      backTo={festivalId ? `/festivals/${festivalId}` : "/festivals"}
    >
      {/* Edition + summary bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <p className="text-xs text-muted-foreground mb-1">Edition</p>
            <Select value={activeId} onValueChange={(v) => { setSelectedEditionId(v); navigate(`/festivals/${v}/calendar`); }}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select edition" />
              </SelectTrigger>
              <SelectContent>
                {(editions.length ? editions : (active ? [active] : [])).map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {format(new Date(e.start_date), "yyyy")} — {e.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{stages.length} stage{stages.length === 1 ? "" : "s"} booked</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span>{slots.length} slot{slots.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{staff.length} staff • {shifts.length} shifts</span>
          </div>
          {active && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{active.location}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="run-order" className="w-full">
        <TabsList>
          <TabsTrigger value="run-order">Run Order</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="stages">Booked Stages</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
        </TabsList>

        {/* Run Order (stage-by-stage, list per day) */}
        <TabsContent value="run-order" className="mt-4 space-y-6">
          {days.map(({ day, date }) => (
            <div key={day} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-semibold">
                  Day {day} <span className="text-muted-foreground font-normal">— {format(date, "EEE, MMM d")}</span>
                </h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {stages.map(stage => {
                  const stageSlots = slots
                    .filter(s => s.stage_id === stage.id && s.day_number === day)
                    .sort((a, b) => (a.start_time && b.start_time
                      ? new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                      : a.slot_number - b.slot_number));
                  return (
                    <Card key={stage.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-primary" />
                            {stage.stage_name}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {stageSlots.length} slot{stageSlots.length === 1 ? "" : "s"}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {stageSlots.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground">No performances scheduled.</p>
                        ) : (
                          <ul className="divide-y divide-border/40">
                            {stageSlots.map(slot => {
                              const dur = slot.start_time && slot.end_time
                                ? Math.round((new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / 60000)
                                : null;
                              return (
                                <li key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="w-20 shrink-0 font-mono text-sm">
                                    <div>{slot.start_time ? format(new Date(slot.start_time), "HH:mm") : "TBA"}</div>
                                    {dur != null && (
                                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" /> {dur}m
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{performerName(slot)}</p>
                                    {slot.start_time && slot.end_time && (
                                      <p className="text-[10px] text-muted-foreground">
                                        {format(new Date(slot.start_time), "HH:mm")} – {format(new Date(slot.end_time), "HH:mm")}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="capitalize">{slot.slot_type.replace("_", " ")}</Badge>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
          {stages.length === 0 && (
            <p className="text-center py-12 text-muted-foreground">No stages booked for this edition yet.</p>
          )}
        </TabsContent>

        {/* Timeline (Gantt-style per day) */}
        <TabsContent value="timeline" className="mt-4 space-y-8">
          {days.map(({ day, date }) => {
            const { startHour, endHour } = dayWindow(day);
            const totalHours = endHour - startHour;
            const widthPx = totalHours * HOUR_PX;
            return (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Day {day} — {format(date, "EEE, MMM d")}</h3>
                </div>
                <div className="overflow-x-auto rounded-md border border-border/40 bg-card">
                  <div style={{ minWidth: widthPx + 160 }}>
                    {/* Hour ruler */}
                    <div className="flex text-[10px] text-muted-foreground border-b border-border/40">
                      <div className="w-40 shrink-0 px-2 py-1 border-r border-border/40 font-medium">Stage</div>
                      <div className="flex" style={{ width: widthPx }}>
                        {Array.from({ length: totalHours }, (_, i) => (
                          <div key={i} className="border-r border-border/30 py-1 text-center" style={{ width: HOUR_PX }}>
                            {String((startHour + i) % 24).padStart(2, "0")}:00
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Rows */}
                    {stages.map(stage => (
                      <div key={stage.id} className="flex border-b border-border/30 last:border-b-0">
                        <div className="w-40 shrink-0 px-2 py-2 border-r border-border/40 text-sm">
                          <div className="font-medium truncate">{stage.stage_name}</div>
                          <div className="text-[10px] text-muted-foreground">Cap {stage.capacity.toLocaleString()}</div>
                        </div>
                        <div className="relative" style={{ width: widthPx, height: 56 }}>
                          {/* hour gridlines */}
                          {Array.from({ length: totalHours }, (_, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-r border-border/20" style={{ left: (i + 1) * HOUR_PX }} />
                          ))}
                          {slots
                            .filter(s => s.stage_id === stage.id && s.day_number === day && s.start_time && s.end_time)
                            .map(s => {
                              const st = new Date(s.start_time!);
                              const en = new Date(s.end_time!);
                              const startPos = (st.getHours() + st.getMinutes() / 60 - startHour) * HOUR_PX;
                              const w = Math.max(24, ((en.getTime() - st.getTime()) / 3600000) * HOUR_PX);
                              return (
                                <div
                                  key={s.id}
                                  className={`absolute top-1 bottom-1 rounded-md border px-2 py-1 text-[11px] overflow-hidden ${slotColor(s.slot_type)}`}
                                  style={{ left: startPos, width: w }}
                                  title={`${performerName(s)} • ${format(st, "HH:mm")}–${format(en, "HH:mm")}`}
                                >
                                  <div className="font-semibold truncate leading-tight">{performerName(s)}</div>
                                  <div className="text-[10px] opacity-80 truncate">
                                    {format(st, "HH:mm")}–{format(en, "HH:mm")}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                    {stages.length === 0 && (
                      <p className="p-6 text-sm text-muted-foreground">No stages booked.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* Booked Stages */}
        <TabsContent value="stages" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stages.map(stage => {
              const stageSlotCount = slots.filter(s => s.stage_id === stage.id).length;
              const performers = new Set(slots.filter(s => s.stage_id === stage.id).map(performerName));
              return (
                <Card key={stage.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-primary" />
                        {stage.stage_name}
                      </span>
                      <Badge variant="outline">#{stage.stage_number}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Capacity {stage.capacity.toLocaleString()}{stage.genre_focus ? ` • ${stage.genre_focus}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Slots</span><span>{stageSlotCount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Performers</span><span>{performers.size}</span></div>
                  </CardContent>
                </Card>
              );
            })}
            {stages.length === 0 && (
              <p className="col-span-full text-center py-12 text-muted-foreground">No stages booked.</p>
            )}
          </div>
        </TabsContent>

        {/* Shifts */}
        <TabsContent value="shifts" className="mt-4 space-y-6">
          {days.map(({ day, date }) => {
            const dayShifts = shiftsByDay.get(day) || [];
            return (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Day {day} — {format(date, "EEE, MMM d")}
                    <Badge variant="outline" className="ml-2">{dayShifts.length} shifts</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dayShifts.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No shifts scheduled for this day. Staff shifts can be added via each staff member's metadata (shifts array).
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {dayShifts.map((sh, i) => (
                        <li key={`${sh.staff_id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <div className="w-28 shrink-0 font-mono">
                            {sh.start} – {sh.end}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{sh.name}</p>
                            {sh.note && <p className="text-[11px] text-muted-foreground truncate">{sh.note}</p>}
                          </div>
                          <Badge variant="secondary" className="capitalize">{sh.role.replace("_", " ")}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {staff.length > 0 && shifts.length === 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Roster (no shift schedule found)</CardTitle>
                <CardDescription>All hired staff — assumed on-call across the festival run.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/40">
                  {staff.map(s => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">Skill {s.skill_level}/100</p>
                      </div>
                      <Badge variant="secondary" className="capitalize">{s.role.replace("_", " ")}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate(`/festivals/${activeId}`)}>Back to Festival</Button>
      </div>
    </FMPageScaffold>
  );
}
