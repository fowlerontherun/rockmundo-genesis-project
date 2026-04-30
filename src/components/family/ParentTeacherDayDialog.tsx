import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, GraduationCap } from "lucide-react";
import { useLogChildSchoolEvent } from "@/hooks/useChildSchoolEvents";

interface Props {
  childId: string;
  childName?: string;
  trigger?: React.ReactNode;
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${label} ${n}`}
          >
            <Star
              className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ParentTeacherDayDialog({ childId, childName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [rating, setRating] = useState(3);
  const [behavior, setBehavior] = useState(3);
  const [academic, setAcademic] = useState(3);
  const [notes, setNotes] = useState("");
  const log = useLogChildSchoolEvent();

  const reset = () => {
    setTeacher(""); setSubject(""); setRating(3); setBehavior(3); setAcademic(3); setNotes("");
  };

  const submit = async () => {
    await log.mutateAsync({
      childId,
      teacherName: teacher.trim() || null,
      subject: subject.trim() || null,
      rating,
      behaviorRating: behavior,
      academicRating: academic,
      notes: notes.trim() || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
            <GraduationCap className="h-3.5 w-3.5" /> Parent-Teacher Day
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-social-chemistry" />
            Parent-Teacher Day{childName ? ` · ${childName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Teacher</Label>
              <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Ms. Carter" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Math" className="h-8 text-xs" />
            </div>
          </div>
          <StarPicker label="Overall rating" value={rating} onChange={setRating} />
          <div className="grid grid-cols-2 gap-3">
            <StarPicker label="Behavior" value={behavior} onChange={setBehavior} />
            <StarPicker label="Academic" value={academic} onChange={setAcademic} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Teacher comments, recommendations, concerns…"
              className="text-xs min-h-[80px]"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Higher ratings boost mood, stability, bond and learning. Low ratings may dent mood.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={log.isPending}>
            {log.isPending ? "Saving…" : "Save event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
