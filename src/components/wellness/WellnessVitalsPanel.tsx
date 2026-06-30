import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Battery, Smile, Activity } from "lucide-react";
import type { WellnessVitals as Vitals } from "@/lib/api/wellnessActivities";

const Tile = ({
  icon,
  label,
  value,
  color,
  invert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  invert?: boolean;
}) => (
  <Card className="overflow-hidden">
    <CardContent className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span className={color}>{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="font-display text-3xl font-bold tabular-nums">
          {value}
        </span>
        <span className="pb-1 text-xs text-muted-foreground">/100</span>
      </div>
      <Progress value={invert ? 100 - value : value} className="h-1.5" />
    </CardContent>
  </Card>
);

export const WellnessVitalsPanel = ({ vitals }: { vitals: Vitals | null }) => {
  const v = vitals ?? { health: 0, energy: 0, mood: 0, stress: 0 };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<Heart className="h-4 w-4" />}
        label="Health"
        value={v.health}
        color="text-rose-500"
      />
      <Tile
        icon={<Battery className="h-4 w-4" />}
        label="Energy"
        value={v.energy}
        color="text-emerald-500"
      />
      <Tile
        icon={<Smile className="h-4 w-4" />}
        label="Mood"
        value={v.mood}
        color="text-amber-500"
      />
      <Tile
        icon={<Activity className="h-4 w-4" />}
        label="Stress"
        value={v.stress}
        color="text-indigo-500"
        invert
      />
    </div>
  );
};

export default WellnessVitalsPanel;
