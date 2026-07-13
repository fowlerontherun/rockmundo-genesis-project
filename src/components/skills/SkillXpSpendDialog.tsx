import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { previewSkillXpSpend } from "@/utils/skillXpSpending";

const telemetry = (name: string, payload: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent("progression:telemetry", { detail: { name, ...payload } }));

type Props = { open: boolean; onOpenChange: (open: boolean) => void; skill: { slug: string; name: string; currentLevel: number; xpIntoLevel: number; xpRequiredForNextLevel: number | null; maxLevel: number; unlocked: boolean; active?: boolean; }; availableSkillXp: number; onSpent?: () => Promise<void> | void; };

export function SkillXpSpendDialog({ open, onOpenChange, skill, availableSkillXp, onSpent }: Props) {
  const { spendSkillXp } = useGameData();
  const { toast } = useToast();
  const [amount, setAmount] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => previewSkillXpSpend({ currentLevel: skill.currentLevel, xpIntoLevel: skill.xpIntoLevel, xpRequiredForNextLevel: skill.xpRequiredForNextLevel, maxLevel: skill.maxLevel }, availableSkillXp, amount), [skill, availableSkillXp, amount]);
  const disabledReason = !skill.unlocked ? "Skill is locked" : skill.active === false ? "Skill is inactive" : preview.isMaxLevel ? "Maximum level reached" : availableSkillXp <= 0 ? "No Skill XP is available" : null;
  useEffect(() => { if (open) { setAmount(Math.min(preview.xpRequiredForNextLevel ?? 0, preview.maximumSpend)); setError(null); telemetry("skill_xp_dialog_opened", { skill: skill.slug }); } }, [open, skill.slug]);
  const setClampedAmount = (value: number, source: string) => { const next = Math.max(0, Math.min(Math.floor(value || 0), preview.maximumSpend)); setAmount(next); telemetry("skill_xp_amount_changed", { skill: skill.slug, source, amount: next }); };
  const chooseNext = () => { const needed = preview.xpRequiredForNextLevel ? Math.max(0, preview.xpRequiredForNextLevel - preview.xpIntoLevel) : 0; setClampedAmount(Math.min(needed, preview.maximumSpend), "next_level"); telemetry("skill_xp_next_level_selected", { skill: skill.slug }); };
  const chooseMax = () => { setClampedAmount(preview.maximumSpend, "max"); telemetry("skill_xp_max_selected", { skill: skill.slug }); };
  const confirm = async () => {
    if (disabledReason || preview.usefulSpend <= 0 || pending) return;
    setPending(true); setError(null); telemetry("skill_xp_spend_confirmed", { skill: skill.slug, amount: preview.usefulSpend });
    try {
      await spendSkillXp({ skillSlug: skill.slug, amount: preview.usefulSpend, uniqueEventId: crypto.randomUUID(), metadata: { source: "skill_xp_spend_dialog" } });
      await onSpent?.();
      telemetry("skill_xp_spend_completed", { skill: skill.slug, amount: preview.usefulSpend, levels_gained: preview.levelsGained });
      if (preview.levelsGained > 1) telemetry("skill_xp_multiple_levels_gained", { skill: skill.slug, levels_gained: preview.levelsGained });
      if (preview.afterLevel >= skill.maxLevel) telemetry("skill_xp_max_level_reached", { skill: skill.slug });
      toast({ title: "Spend successful", description: `${preview.usefulSpend.toLocaleString()} Skill XP invested. ${skill.name} is now level ${preview.afterLevel}.` });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Progression service unavailable";
      setError(message); telemetry("skill_xp_spend_failed", { skill: skill.slug, message });
    } finally { setPending(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Spend Skill XP on {skill.name}</DialogTitle><DialogDescription>Invest available Skill XP directly into this unlocked skill. Practice limits do not block XP spending.</DialogDescription></DialogHeader><div className="space-y-4" aria-live="polite"><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">Available Skill XP</span><p className="font-semibold">{availableSkillXp.toLocaleString()}</p></div><div><span className="text-muted-foreground">Maximum level</span><p className="font-semibold">{skill.maxLevel}</p></div><div><span className="text-muted-foreground">Invested XP</span><p className="font-semibold">Level {preview.currentLevel} — {preview.xpIntoLevel}/{preview.xpRequiredForNextLevel ?? "Max"}</p></div><div><span className="text-muted-foreground">XP to maximum</span><p className="font-semibold">{preview.xpToMaxLevel.toLocaleString()}</p></div></div>{disabledReason && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive" role="status">{disabledReason}</p>}<label className="block"><span className="text-sm font-medium">Amount to spend</span><div className="mt-1 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" aria-label="Decrease Skill XP amount" disabled={!!disabledReason || pending || amount <= 0} onClick={() => setClampedAmount(amount - 1, "decrement")}>−</Button><input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" inputMode="numeric" aria-label="Amount to spend" value={amount} disabled={!!disabledReason || pending} onChange={(e) => setClampedAmount(Number(e.target.value), "input")} /><Button type="button" variant="outline" size="sm" aria-label="Increase Skill XP amount" disabled={!!disabledReason || pending || amount >= preview.maximumSpend} onClick={() => setClampedAmount(amount + 1, "increment")}>+</Button></div></label><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" aria-label="Select XP to reach next level" disabled={!!disabledReason || pending || preview.maximumSpend <= 0} onClick={chooseNext}>Next Level</Button><Button type="button" variant="secondary" aria-label="Select maximum useful Skill XP" disabled={!!disabledReason || pending || preview.maximumSpend <= 0} onClick={chooseMax}>Max</Button></div><div className="rounded-lg border p-3 text-sm"><p className="font-medium">Preview</p><p>Spend {preview.usefulSpend.toLocaleString()} Skill XP on {skill.name}</p><p>Current: Level {preview.currentLevel} — {preview.xpIntoLevel}/{preview.xpRequiredForNextLevel ?? "Max"} XP</p><Progress className="my-2" value={preview.xpRequiredForNextLevel ? (preview.xpIntoLevel / preview.xpRequiredForNextLevel) * 100 : 100} /><p>After: Level {preview.afterLevel} — {preview.afterXpIntoLevel}/{preview.afterXpRequiredForNextLevel ?? "Max"} XP</p><p>Levels gained: <Badge variant="outline">{preview.levelsGained}</Badge></p><p>Wallet after spending: {preview.walletAfterSpend.toLocaleString()} Skill XP</p><p className="mt-2 text-muted-foreground">This action cannot be freely reversed.</p></div>{error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive" role="alert">{error}</p>}</div><DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="button" onClick={confirm} disabled={!!disabledReason || preview.usefulSpend <= 0 || pending}>{pending ? "Spending…" : "Confirm Spend"}</Button></DialogFooter></DialogContent></Dialog>;
}
