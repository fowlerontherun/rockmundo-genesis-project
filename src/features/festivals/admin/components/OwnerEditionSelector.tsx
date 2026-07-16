import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOwnerFestivalEditions } from "../hooks";

type Props = { festivalId: string; selectedEditionId?: string };

export function OwnerEditionSelector({ festivalId, selectedEditionId }: Props) {
  const { data, isLoading, error } = useOwnerFestivalEditions(festivalId);
  const params = useParams();
  if (isLoading) return <Card><CardContent className="p-6">Loading editions…</CardContent></Card>;
  if (error) return <Card><CardContent className="p-6 text-destructive">Unable to load editions: {(error as Error).message}</CardContent></Card>;
  const editions = data ?? [];
  return <Card>
    <CardHeader><CardTitle>Select an edition to manage</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {editions.length === 0 && <p className="text-sm text-muted-foreground">No authorised editions are available. Create the first canonical edition from the admin catalogue or brand workspace.</p>}
      {editions.map((edition) => <div key={edition.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <p className="font-medium">{edition.title}</p>
          <p className="text-sm text-muted-foreground">Edition #{edition.editionNumber} · {edition.cityName ?? "No city"} · {edition.startAt ? new Date(edition.startAt).toLocaleDateString() : "Unscheduled"}</p>
        </div>
        <div className="flex items-center gap-2"><Badge>{edition.status}</Badge><Button asChild variant={selectedEditionId === edition.id ? "default" : "outline"} size="sm"><Link to={`/festivals/${params.festivalId ?? festivalId}/manage/editions/${edition.id}`}>{selectedEditionId === edition.id ? "Selected" : "Manage"}</Link></Button></div>
      </div>)}
    </CardContent>
  </Card>;
}
