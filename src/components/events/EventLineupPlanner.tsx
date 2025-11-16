import { useMemo, useState } from "react";
import { CalendarClock, Edit2, Music, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { LineupSlot } from "./types";

interface EventLineupPlannerProps {
  lineup: LineupSlot[];
  onLineupChange: (lineup: LineupSlot[]) => void;
}

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const EventLineupPlanner = ({ lineup, onLineupChange }: EventLineupPlannerProps) => {
  const [form, setForm] = useState<Omit<LineupSlot, "id">>({
    artist: "",
    stage: "",
    startTime: "",
    endTime: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalPerformanceMinutes = useMemo(() => {
    return lineup.reduce((total, slot) => {
      const start = new Date(`1970-01-01T${slot.startTime || "00:00"}:00`);
      const end = new Date(`1970-01-01T${slot.endTime || "00:00"}:00`);
      const diff = (end.getTime() - start.getTime()) / 1000 / 60;

      if (!Number.isFinite(diff) || diff <= 0) {
        return total;
      }

      return total + diff;
    }, 0);
  }, [lineup]);

  const genreDiversityScore = useMemo(() => {
    const stages = new Set(lineup.map((slot) => slot.stage.trim().toLowerCase()).filter(Boolean));
    return Math.min(100, stages.size * 20 + lineup.length * 5);
  }, [lineup]);

  const resetForm = () => {
    setForm({ artist: "", stage: "", startTime: "", endTime: "", notes: "" });
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.artist.trim() || !form.stage.trim()) {
      return;
    }

    if (editingId) {
      const updated = lineup.map((slot) =>
        slot.id === editingId
          ? {
              ...slot,
              ...form,
            }
          : slot,
      );

      onLineupChange(updated);
    } else {
      const newSlot: LineupSlot = {
        id: generateId(),
        ...form,
      };

      onLineupChange([...lineup, newSlot]);
    }

    resetForm();
  };

  const handleEdit = (slot: LineupSlot) => {
    setForm({
      artist: slot.artist,
      stage: slot.stage,
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: slot.notes ?? "",
    });
    setEditingId(slot.id);
  };

  const handleDelete = (id: string) => {
    onLineupChange(lineup.filter((slot) => slot.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Lineup Planner</CardTitle>
            <CardDescription>Craft a balanced experience across stages and time slots.</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            <Music className="mr-1 h-4 w-4" /> {lineup.length} acts scheduled
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Performance time</p>
            <p className="text-lg font-semibold">{Math.round(totalPerformanceMinutes)} minutes</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Stage coverage score</p>
            <p className="text-lg font-semibold">{genreDiversityScore}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Prime time slots</p>
            <p className="text-lg font-semibold">
              {lineup.filter((slot) => slot.startTime >= "18:00" && slot.startTime <= "22:00").length}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="artist">Artist or segment</Label>
              <Input
                id="artist"
                value={form.artist}
                onChange={(event) => setForm((prev) => ({ ...prev, artist: event.target.value }))}
                placeholder="Headliner, support act, or experiential moment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage">Stage or location</Label>
              <Input
                id="stage"
                value={form.stage}
                onChange={(event) => setForm((prev) => ({ ...prev, stage: event.target.value }))}
                placeholder="Main stage, VIP lounge, rooftop, etc."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Program notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Highlight special guests, transitions, or production cues."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                <Plus className="mr-2 h-4 w-4" /> {editingId ? "Update slot" : "Add to lineup"}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {lineup.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold">No segments scheduled yet</p>
                <p className="text-sm text-muted-foreground">
                  Map out your performer flow to balance crowd energy and production resets.
                </p>
              </div>
            ) : (
              lineup.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {slot.stage || "Unassigned"}
                      </Badge>
                      <p className="font-semibold">{slot.artist}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {slot.startTime || "TBD"} - {slot.endTime || "TBD"}
                    </p>
                    {slot.notes && <p className="text-sm text-muted-foreground">{slot.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(slot)}>
                      <Edit2 className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(slot.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
