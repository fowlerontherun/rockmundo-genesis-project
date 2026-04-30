import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown, ArrowRight, Lock, UserPlus } from "lucide-react";
import { useConvertChildToPlayable, useComingOfAgeAvailability } from "@/hooks/useComingOfAge";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { useNavigate } from "react-router-dom";

interface Props {
  child: {
    id: string;
    name: string;
    surname: string;
    current_age?: number;
    child_profile_id?: string | null;
    inherited_potentials?: Record<string, number>;
    bond_parent_a?: number;
    bond_parent_b?: number;
  };
  trigger?: React.ReactNode;
  /** When true, dialog opens automatically once on mount if eligible. */
  autoPrompt?: boolean;
}

export function ComingOfAgeDialog({ child, trigger, autoPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const navigate = useNavigate();
  const convert = useConvertChildToPlayable();
  const { switchCharacter } = useCharacterSlots();
  const { eligible, canConvertNow, needsSlot, slots } = useComingOfAgeAvailability(child);

  // Auto-prompt once per session
  if (autoPrompt && eligible && !autoOpened) {
    const seenKey = `coming-of-age-prompt-${child.id}`;
    if (typeof window !== "undefined" && !window.sessionStorage.getItem(seenKey)) {
      window.sessionStorage.setItem(seenKey, "1");
      setAutoOpened(true);
      setOpen(true);
    } else if (!autoOpened) {
      setAutoOpened(true);
    }
  }

  if (!eligible && !child.child_profile_id) return null;

  const topPotentials = Object.entries(child.inherited_potentials ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  const avgBond = Math.round(((child.bond_parent_a ?? 50) + (child.bond_parent_b ?? 50)) / 2);

  const handleConvert = async () => {
    const newProfileId = await convert.mutateAsync(child.id);
    setOpen(false);
    // Offer to switch immediately
    try {
      await switchCharacter.mutateAsync(newProfileId);
      navigate("/dashboard");
    } catch {
      // Stay in current character; user can switch from character menu
    }
  };

  const fullName = `${child.name} ${child.surname}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5 bg-gradient-to-r from-social-loyalty to-social-chemistry text-primary-foreground">
            <Crown className="h-3.5 w-3.5" /> Coming of Age
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5 text-social-chemistry" />
            {fullName} has come of age
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Your child is now 18. You can convert them into a playable character — they'll occupy a
            character slot and start their own legacy with bonuses earned from their upbringing.
          </p>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Legacy bonuses</span>
              <Sparkles className="h-3.5 w-3.5 text-social-chemistry" />
            </div>
            {topPotentials.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {topPotentials.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px] gap-1">
                    <span className="capitalize">{k}</span>
                    <span className="text-social-chemistry">+{v}</span>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Average bond {avgBond} → bonus {Math.max(0, avgBond - 50)} carried into starter SXP/AP.
            </p>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Character slots</p>
            {slots ? (
              <p className="text-xs">
                {slots.usedSlots} of {slots.maxSlots} used
                {needsSlot && (
                  <span className="ml-2 text-destructive inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> No free slot
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {needsSlot && (
              <p className="text-[10px] text-muted-foreground">
                Purchase an extra slot or retire an existing character to make room.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={!canConvertNow || convert.isPending}
            className="gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {convert.isPending ? "Creating…" : "Create playable heir"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
