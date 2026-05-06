import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Music, Sparkles, Star, Wrench, Zap } from "lucide-react";
import type { RevealResult } from "@/pages/BlindBoxStore";

const TIER_COLORS: Record<string, string> = {
  common: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  rare: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  epic: "bg-purple-500/20 text-purple-200 border-purple-500/40",
  legendary: "bg-amber-500/20 text-amber-200 border-amber-500/40",
};

interface Props {
  reveal: RevealResult | null;
  onClose: () => void;
}

export function BlindBoxRevealDialog({ reveal, onClose }: Props) {
  if (!reveal) return null;
  const tierClass = TIER_COLORS[reveal.tier] ?? TIER_COLORS.common;

  return (
    <Dialog open={!!reveal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Box opened!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className={`rounded-lg border p-3 text-center ${tierClass}`}>
            <p className="text-xs uppercase tracking-wider opacity-80">Tier</p>
            <p className="text-2xl font-bold capitalize">{reveal.tier}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat icon={Zap} label="XP" value={`+${reveal.xp.toLocaleString()}`} hint={reveal.skill_slug} />
            <Stat icon={Star} label="AP" value={`+${reveal.ap}`} />
          </div>

          <Separator />

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" /> Instrument
            </div>
            <p className="font-semibold">{reveal.instrument.name}</p>
            <p className="text-xs text-muted-foreground">
              {reveal.instrument.type} · Quality {reveal.instrument.quality}/100
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Music className="h-3 w-3" /> Song added to catalog
            </div>
            <p className="font-semibold">{reveal.song.title}</p>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-[10px]">{reveal.song.genre}</Badge>
              <Badge variant="outline" className="text-[10px]">Quality {reveal.song.quality}</Badge>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            New balance: {reveal.currency === "premium"
              ? `${reveal.new_balance} tokens`
              : `$${reveal.new_balance.toLocaleString()}`}
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">Awesome</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value, hint }: {
  icon: typeof Zap; label: string; value: string; hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
