import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useEducationUniversityTracks } from "../hooks/useEducationUniversityTracks";

export const UniversityTab = () => {
  const tracks = useEducationUniversityTracks();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Pathways</CardTitle>
        <CardDescription>
          Blend formal study with real-world experience using programs designed for modern performers.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        {tracks.map((track) => (
          <Card key={track.title} className="border-dashed">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{track.title}</CardTitle>
              <CardDescription>{track.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {track.highlights.map((highlight) => (
                  <div key={highlight.name} className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{highlight.name}</p>
                        <p className="text-xs text-muted-foreground">{highlight.school}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {highlight.focus}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{highlight.details}</p>
                  </div>
                ))}
              </div>
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
