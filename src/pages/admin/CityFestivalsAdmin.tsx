import { AdminFestivalCatalogue } from "@/features/festivals/admin/components/AdminFestivalCatalogue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CityFestivalsAdmin() {
  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-oswald">City Festival Coverage</h1>
      <p className="text-muted-foreground">Canonical city coverage and seeding are managed through festival brands and dated editions, not occurrence fields on permanent brand rows.</p>
    </div>
    <Card>
      <CardHeader><CardTitle>Read-only coverage dashboard</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Use the primary /admin/festivals workspace to create brands, create next editions, preview country seeding and archive inactive brands. The former direct table editor has been retired to prevent one-festival-per-city assumptions and browser-authored occurrence writes.</CardContent>
    </Card>
    <AdminFestivalCatalogue />
  </div>;
}
