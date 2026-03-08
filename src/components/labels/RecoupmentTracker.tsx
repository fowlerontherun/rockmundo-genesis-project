import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecoupmentTrackerProps {
  advanceAmount: number;
  recoupedAmount: number;
  royaltyArtistPct: number;
  royaltyLabelPct: number;
  labelName?: string;
  compact?: boolean;
}

export function RecoupmentTracker({
  advanceAmount,
  recoupedAmount,
  royaltyArtistPct,
  royaltyLabelPct,
  labelName,
  compact = false,
}: RecoupmentTrackerProps) {
  const progress = advanceAmount > 0 ? Math.min((recoupedAmount / advanceAmount) * 100, 100) : 100;
  const isFullyRecouped = progress >= 100;
  const remaining = Math.max(0, advanceAmount - recoupedAmount);

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Advance Recoupment</span>
          <span className={isFullyRecouped ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
            {isFullyRecouped ? "Fully Recouped" : `${progress.toFixed(0)}%`}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
        {!isFullyRecouped && (
          <p className="text-[10px] text-muted-foreground">
            ${remaining.toLocaleString()} remaining — label keeps {royaltyLabelPct}% until recouped
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Advance Recoupment
          {labelName && <span className="text-muted-foreground font-normal">· {labelName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            {isFullyRecouped ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Fully Recouped
              </Badge>
            ) : (
              <span className="font-medium">{progress.toFixed(1)}%</span>
            )}
          </div>
          <Progress value={progress} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>${recoupedAmount.toLocaleString()} recouped</span>
            <span>${advanceAmount.toLocaleString()} advance</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-md border p-2">
            <p className="text-lg font-bold text-primary">{royaltyArtistPct}%</p>
            <p className="text-[10px] text-muted-foreground">Your Royalty</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-lg font-bold text-muted-foreground">{royaltyLabelPct}%</p>
            <p className="text-[10px] text-muted-foreground">Label Share</p>
          </div>
        </div>

        {!isFullyRecouped && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/5 rounded-md p-2 border border-amber-500/20">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            <span>
              The label's {royaltyLabelPct}% share goes toward recouping your ${advanceAmount.toLocaleString()} advance.
              Once recouped, you'll earn your full {royaltyArtistPct}% on all future sales.
            </span>
          </div>
        )}

        {isFullyRecouped && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 rounded-md p-2 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              Your advance is fully recouped! You now earn {royaltyArtistPct}% of all revenue.
              The label receives {royaltyLabelPct}% as their ongoing royalty share.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
