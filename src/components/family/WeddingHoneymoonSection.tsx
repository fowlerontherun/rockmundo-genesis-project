import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Plane, Sparkles } from "lucide-react";
import { useWedding, useTriggerWedding } from "@/hooks/useWeddings";
import { useHoneymoon } from "@/hooks/useHoneymoons";
import { WeddingPlannerDialog } from "./WeddingPlannerDialog";
import { HoneymoonDialog } from "./HoneymoonDialog";
import { formatDistanceToNow } from "date-fns";

interface Props { marriageId: string }

export function WeddingHoneymoonSection({ marriageId }: Props) {
  const { data: wedding } = useWedding(marriageId);
  const { data: honeymoon } = useHoneymoon(marriageId);
  const trigger = useTriggerWedding();
  const [weddingOpen, setWeddingOpen] = useState(false);
  const [honeymoonOpen, setHoneymoonOpen] = useState(false);

  const weddingReady = wedding && wedding.status === "planned" && new Date(wedding.ceremony_at) <= new Date();

  return (
    <Card className="border-social-love/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4 text-social-love" /> Wedding & Honeymoon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!wedding && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">No wedding planned yet.</div>
            <Button size="sm" onClick={() => setWeddingOpen(true)} className="bg-social-love text-white hover:bg-social-love/90">
              Plan wedding
            </Button>
          </div>
        )}
        {wedding && wedding.status === "planned" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize">{wedding.tier}</span>
              <Badge variant="outline">
                {weddingReady ? "Ready" : `In ${formatDistanceToNow(new Date(wedding.ceremony_at))}`}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {wedding.guest_count} guests · ${(wedding.cost_cents / 100).toLocaleString()}
            </div>
            {weddingReady && (
              <Button size="sm" className="w-full" onClick={() => trigger.mutate(wedding.id)} disabled={trigger.isPending}>
                <Sparkles className="h-3 w-3 mr-1" /> Hold ceremony now
              </Button>
            )}
          </div>
        )}
        {wedding && wedding.status === "completed" && (
          <div className="text-xs text-muted-foreground">
            💒 Married · {wedding.actual_attendance} guests · +{wedding.fame_gained} fame
          </div>
        )}

        {wedding?.status === "completed" && !honeymoon && (
          <div className="flex items-center justify-between border-t border-border/40 pt-2">
            <div className="text-xs text-muted-foreground">No honeymoon booked.</div>
            <Button size="sm" variant="secondary" onClick={() => setHoneymoonOpen(true)}>
              <Plane className="h-3 w-3 mr-1" /> Book honeymoon
            </Button>
          </div>
        )}
        {honeymoon && honeymoon.status !== "completed" && (
          <div className="border-t border-border/40 pt-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="capitalize font-medium">{honeymoon.package_tier}</span>
              <Badge variant="outline">
                {honeymoon.status === "planned"
                  ? `Departs ${formatDistanceToNow(new Date(honeymoon.starts_at), { addSuffix: true })}`
                  : `Returns ${formatDistanceToNow(new Date(honeymoon.ends_at), { addSuffix: true })}`}
              </Badge>
            </div>
            <div className="text-muted-foreground">{honeymoon.destination_name ?? "Destination TBD"} · {honeymoon.duration_days}d</div>
          </div>
        )}
        {honeymoon?.status === "completed" && (
          <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
            🏝️ Honeymoon complete · +{honeymoon.fame_gained} fame · +{honeymoon.health_gained} health
          </div>
        )}
      </CardContent>

      <WeddingPlannerDialog open={weddingOpen} onOpenChange={setWeddingOpen} marriageId={marriageId} />
      <HoneymoonDialog open={honeymoonOpen} onOpenChange={setHoneymoonOpen} marriageId={marriageId} />
    </Card>
  );
}
