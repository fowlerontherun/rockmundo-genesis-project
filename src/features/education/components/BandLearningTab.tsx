import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useEducationBandLearningTracks } from "../hooks/useEducationBandLearningTracks";

export const BandLearningTab = () => {
  const tracks = useEducationBandLearningTracks();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band Learning Lab</CardTitle>
        <CardDescription>
          Align your entire crew with immersive intensives, monthly focus cycles, and actionable feedback loops.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tracks.map((track) => (
          <Card key={track.title} className="border-dashed">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{track.title}</CardTitle>
              <CardDescription>{track.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {track.sessions.map((session) => (
                <div key={session.name} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{session.name}</p>
                      <p className="text-xs text-muted-foreground">{session.focus}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.deliverable}
                    </Badge>
                  </div>
                </div>
              ))}
              {track.action ? (
                <Button asChild variant="secondary" className="w-full">
                  <a href={track.action.href} target="_blank" rel="noreferrer">
                    {track.action.label}
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
