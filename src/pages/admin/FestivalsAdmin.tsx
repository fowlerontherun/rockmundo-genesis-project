import { AdminFestivalCatalogue } from "@/features/festivals/admin/components/AdminFestivalCatalogue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FestivalsAdminPage() {
  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-oswald">Festivals Administration</h1>
      <p className="text-muted-foreground">Canonical brand and edition management. Legacy game-event festival records are read-only and appear only through compatibility mappings.</p>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap gap-2">Workspace tabs <Badge>Brands</Badge><Badge>Editions</Badge><Badge>Lifecycle</Badge><Badge>Operations</Badge><Badge>Live</Badge><Badge>Outcomes</Badge><Badge>Legacy Records</Badge><Badge>Configuration</Badge></CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Use audited RPCs for creation, lifecycle overrides, edition operations, migration previews and data-health repair actions. This page no longer creates or mutates festival rows in game_events.</CardContent>
    </Card>
    <AdminFestivalCatalogue />
  </div>;
}
