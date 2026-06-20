import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Stethoscope } from "lucide-react";
import type { PlayerAilment, WellnessCatalogEntry } from "@/lib/api/wellnessActivities";

interface Props {
  ailments: PlayerAilment[];
  catalog: WellnessCatalogEntry[];
  onTreat: (slug: string) => void;
}

const sevLabel = (s: number) => (s >= 3 ? "Critical" : s === 2 ? "Moderate" : "Mild");
const sevColor = (s: number) => (s >= 3 ? "destructive" : s === 2 ? "default" : "secondary") as const;

export const AilmentsPanel = ({ ailments, catalog, onTreat }: Props) => {
  if (!ailments.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          You're in good shape — no active ailments.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Active Ailments
          <Badge variant="secondary" className="ml-auto">{ailments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {ailments.map(a => {
          const treatment = catalog.find(c => c.slug === a.treatment_required_slug);
          return (
            <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant={sevColor(a.severity)} className="text-[10px]">{sevLabel(a.severity)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
                {a.blocks_activity_types.length > 0 && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    Blocks: {a.blocks_activity_types.join(", ")}
                  </p>
                )}
              </div>
              {treatment && (
                <Button size="sm" variant="outline" onClick={() => onTreat(treatment.slug)}>
                  <Stethoscope className="mr-1 h-3.5 w-3.5" />
                  {treatment.name}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AilmentsPanel;
