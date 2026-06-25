import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = [
  { value: "ui", label: "UI / Visual" },
  { value: "gameplay", label: "Gameplay / Mechanic" },
  { value: "performance", label: "Performance / Slowness" },
  { value: "crash", label: "Crash / Error" },
  { value: "data", label: "Wrong data / numbers" },
  { value: "audio", label: "Audio / Music" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "low", label: "Low — minor annoyance" },
  { value: "medium", label: "Medium — affects gameplay" },
  { value: "high", label: "High — blocks progress" },
  { value: "critical", label: "Critical — game-breaking" },
];

export const BugReportButton = () => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [category, setCategory] = useState("other");
  const [severity, setSeverity] = useState("medium");
  const location = useLocation();

  const reset = () => {
    setTitle("");
    setDescription("");
    setSteps("");
    setCategory("other");
    setSeverity("medium");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please provide a title and description.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("bug_reports").insert({
        user_id: user?.id ?? null,
        page_url: typeof window !== "undefined" ? window.location.href : location.pathname,
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: steps.trim() || null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        viewport:
          typeof window !== "undefined"
            ? `${window.innerWidth}x${window.innerHeight}`
            : null,
      });
      if (error) throw error;
      toast.success("Bug report submitted — thanks!");
      reset();
      setOpen(false);
    } catch (err: any) {
      console.error("Bug report failed:", err);
      toast.error(err?.message ?? "Failed to submit bug report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-16 right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-20 sm:right-4 sm:h-12 sm:w-12"
      >
        <Bug className="h-5 w-5" />
        <span className="sr-only">Report a bug</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              Report a bug
            </DialogTitle>
            <DialogDescription>
              Help us improve RockMundo. We'll include the current page URL and
              browser info automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bug-title">Title</Label>
              <Input
                id="bug-title"
                placeholder="Short summary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-description">What happened?</Label>
              <Textarea
                id="bug-description"
                placeholder="Describe the bug — what you saw vs. what you expected."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-steps">Steps to reproduce (optional)</Label>
              <Textarea
                id="bug-steps"
                placeholder="1. Go to…&#10;2. Click…&#10;3. See error"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={3}
                maxLength={1500}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Page: <span className="font-mono">{location.pathname}</span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                "Submit report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BugReportButton;
