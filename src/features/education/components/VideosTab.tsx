import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useEducationVideoPlaylists } from "../hooks/useEducationVideoPlaylists";

export const VideosTab = () => {
  const playlists = useEducationVideoPlaylists();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream Your Lessons</CardTitle>
        <CardDescription>
          Mix binge-worthy channels with structured playlists so every practice session has purpose.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {playlists.map((playlist) => (
          <Card key={playlist.title} className="border-dashed">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{playlist.title}</CardTitle>
              <CardDescription>{playlist.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {playlist.resources.map((resource) => (
                <div key={resource.name} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{resource.name}</p>
                      <p className="text-xs text-muted-foreground">{resource.format}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {resource.focus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{resource.summary}</p>
                  <Button asChild variant="link" className="h-auto px-0 text-xs font-semibold">
                    <a href={resource.link} target="_blank" rel="noreferrer">
                      Watch now
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
