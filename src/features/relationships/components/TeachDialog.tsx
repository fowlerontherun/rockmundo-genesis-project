import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { executeRelationshipAction } from "@/hooks/useRelationshipRewards";
import { GraduationCap } from "lucide-react";

interface TeachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorProfileId: string;
  studentProfileId: string;
  studentDisplayName: string;
  onComplete?: () => void;
}

export function TeachDialog({
  open,
  onOpenChange,
  mentorProfileId,
  studentProfileId,
  studentDisplayName,
  onComplete,
}: TeachDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [skills, setSkills] = useState<Array<{ slug: string; level: number }>>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("skill_progress")
        .select("skill_slug, current_level")
        .eq("profile_id", mentorProfileId)
        .gte("current_level", 1)
        .order("current_level", { ascending: false })
        .limit(20);
      const list = (data ?? []).map((r: any) => ({ slug: r.skill_slug, level: r.current_level }));
      setSkills(list);
      if (list.length > 0) setSelectedSkill(list[0].slug);
    })();
  }, [open, mentorProfileId]);

  const formatSkillName = (slug: string) =>
    slug.split(/[_-]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

  const handleTeach = async () => {
    if (!selectedSkill) return;
    setBusy(true);
    try {
      const mentorResult = await executeRelationshipAction({
        action: "teach",
        profileId: mentorProfileId,
        otherProfileId: studentProfileId,
        message: `Taught ${formatSkillName(selectedSkill)} to ${studentDisplayName}`,
        metadata: { focus_skill: selectedSkill, role: "mentor" },
      });

      if (!mentorResult.success) {
        toast({ title: "Couldn't teach", description: mentorResult.error, variant: "destructive" });
        return;
      }

      const studentXp = Number((mentorResult as any).student_skill_xp_awarded ?? 0);

      toast({
        title: `Taught ${formatSkillName(selectedSkill)}!`,
        description: studentXp > 0
          ? `+${mentorResult.xp_awarded} XP for you · +${studentXp} ${formatSkillName(selectedSkill)} XP for ${studentDisplayName}`
          : `+${mentorResult.xp_awarded} XP for you · No student skill XP (locked or maxed)`,
      });

      queryClient.invalidateQueries({ queryKey: ["friend-rewards"] });
      queryClient.invalidateQueries({ queryKey: ["social-streak"] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
      onComplete?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Teach failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Teach {studentDisplayName} a skill
          </DialogTitle>
        </DialogHeader>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You need at least one skill at Level 1+ to teach. Practice a skill first.
          </p>
        ) : (
          <div className="space-y-3">
            <Select value={selectedSkill} onValueChange={setSelectedSkill}>
              <SelectTrigger><SelectValue placeholder="Pick a skill" /></SelectTrigger>
              <SelectContent>
                {skills.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {formatSkillName(s.slug)} (Lv {s.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You earn <span className="font-medium">+30 XP · +8 Mentoring</span>.{" "}
              {studentDisplayName} earns <span className="font-medium">+25 skill XP</span> in your chosen skill.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleTeach} disabled={busy || !selectedSkill}>
            {busy ? "Teaching..." : "Run teach session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
