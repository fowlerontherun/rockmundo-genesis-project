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
      // Mentor reward
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

      // Grant the actual skill XP to the student via direct skill_progress upsert (bonus 15 XP in target skill)
      // Note: student doesn't get the action XP / streak — that requires their own session.
      try {
        const { data: existing } = await (supabase as any)
          .from("skill_progress")
          .select("current_xp, current_level, required_xp")
          .eq("profile_id", studentProfileId)
          .eq("skill_slug", selectedSkill)
          .maybeSingle();
        const calculateRequired = (lvl: number) => Math.floor(100 * Math.pow(1.5, lvl));
        let level = Math.min(existing?.current_level ?? 0, 20);
        let remaining = (existing?.current_xp ?? 0) + 15;
        let required = existing?.required_xp ?? calculateRequired(level);
        while (level < 20 && remaining >= required) {
          remaining -= required;
          level += 1;
          required = calculateRequired(level);
        }
        await (supabase as any).from("skill_progress").upsert({
          profile_id: studentProfileId,
          skill_slug: selectedSkill,
          current_xp: remaining,
          current_level: level,
          required_xp: calculateRequired(level),
          last_practiced_at: new Date().toISOString(),
        }, { onConflict: "profile_id,skill_slug" });
      } catch (err) {
        // student grant may fail under RLS; non-blocking
        console.warn("Couldn't update student skill progress directly", err);
      }

      toast({
        title: `Taught ${formatSkillName(selectedSkill)}!`,
        description: `+${mentorResult.xp_awarded} XP for you · +15 ${formatSkillName(selectedSkill)} XP for ${studentDisplayName}`,
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
              You earn <span className="font-medium">+20 XP · +5 Mentoring</span>.{" "}
              {studentDisplayName} earns <span className="font-medium">+15 skill XP</span> in your chosen skill.
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
