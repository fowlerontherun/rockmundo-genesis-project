import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useProposeMotion, useMyMayorSeat } from "@/hooks/useParliament";
import { MOTION_TYPE_LABELS, type MotionType } from "@/types/parliament";

export function ProposeMotionDialog() {
  const { data: seat } = useMyMayorSeat();
  const propose = useProposeMotion();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<MotionType>("resolution");
  const [days, setDays] = useState(3);
  const [paySalary, setPaySalary] = useState("15000");

  if (!seat?.id) {
    return null;
  }

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {};
    if (type === "mayor_pay") {
      payload.weekly_salary_cents = Math.round(parseFloat(paySalary) * 100);
    }
    propose.mutate(
      { title, body, motion_type: type, payload, voting_days: days },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setBody("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Propose Motion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Table a New Motion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MotionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MOTION_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "mayor_pay" && (
            <div>
              <Label>Proposed Weekly Mayor Salary ($)</Label>
              <Input type="number" min={50} max={50000} value={paySalary} onChange={(e) => setPaySalary(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Range: $50 – $50,000 per week</p>
            </div>
          )}
          <div>
            <Label>Body</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <Label>Voting window (days)</Label>
            <Input type="number" min={1} max={14} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 3)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title || !body || propose.isPending}>
            {propose.isPending ? "Tabling…" : "Table Motion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
