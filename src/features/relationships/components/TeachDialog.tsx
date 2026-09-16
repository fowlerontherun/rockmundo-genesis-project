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

const getSkillMaxLevel = async (skillSlug: string): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_max_level", {
    p_skill_slug: skillSlug,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 20;
};

const getRequiredSkillXp = async (level: number): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 100;
};

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

      // Student skill reward. This remains non-blocking because RLS may prevent a
      // client from writing another profile, but when allowed it follows the same
      // canonical cap, tier gate and XP curve as every other skill progression path.
      try {
        const { data: tierUnlocked, error: tierError } = await (supabase as any).rpc("skill_tier_unlocked", {
          p_profile_id: studentProfileId,
          p_slug: selectedSkill,
        });
        if (tierError) throw tierError;
        if (tierUnlocked === false) throw new Error("Student has not unlocked this skill tier");

        const maxLevel = await getSkillMaxLevel(selectedSkill);
        const { data: existing, error: existingError } = await (supabase as any)
          .from("skill_progress")
          .select("current_xp, current_level, required_xp")
          .eq("profile_id", studentProfileId)
          .eq("skill_slug", selectedSkill)
          .maybeSingle();
        if (existingError) throw existingError;

        let level = Math.min(Math.max(Number(existing?.current_level ?? 0), 0), maxLevel);
        let remaining = Math.max(Number(existing?.current_xp ?? 0), 0);
        let required = Number(existing?.required_xp ?? 0);

        if (level < maxLevel) {
          if (required <= 0) required = await getRequiredSkillXp(level);
          remaining += 15;
          while (level < maxLevel && remaining >= required) {
            remaining -= required;
            level += 1;
            required = level < maxLevel ? await getRequiredSkillXp(level) : 0;
          }
        }

        if (level >= maxLevel) {
          level = maxLevel;
          remaining = 0;
          required = 0;
        }

        const { error: grantError } = await (supabase as any).from("skill_progress").upsert({
          profile_id: studentProfileId,
          skill_slug: selectedSkill,
          current_xp: remaining,
          current_level: level,
          required_xp: required,
          last_practiced_at: new Date().toISOString(),
        }, { onConflict: "profile_id,skill_slug" });
        if (grantError) throw grantError;
      } catch (err) {
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
