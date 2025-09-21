import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useEducationVideoPlaylists } from "../hooks/useEducationVideoPlaylists";

export const VideosTab = () => {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useEducationVideoPlaylists();

  const playlists = data ?? [];
  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "We couldn't load playlists. Please try again later."
        : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream Your Lessons</CardTitle>
        <CardDescription>
          Mix binge-worthy channels with structured playlists so every practice session has purpose.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading playlists...
          </div>
        ) : isError ? (
          <div className="col-span-full">
            <Alert variant="destructive">
              <AlertTitle>Unable to load playlists</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          </div>
        ) : playlists.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
            No playlists are available yet. Add resources from the admin panel to surface recommendations.
          </div>
        ) : (
          playlists.map((playlist) => (
            <Card key={playlist.key} className="border-dashed">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">{playlist.title}</CardTitle>
                <CardDescription>{playlist.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {playlist.resources.map((resource) => (
                  <div key={resource.id} className="space-y-3 rounded-lg border bg-muted/30 p-4">
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
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        Watch now
                      </a>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};
