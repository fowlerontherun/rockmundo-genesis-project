import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Radio, MapPin, Music, Users, Clock, Star } from "lucide-react";
import { useState } from "react";
import { SubmitSongDialog } from "@/components/radio/SubmitSongDialog";
import type { RadioStation } from "@/hooks/useRadioStations";

const RadioStationDetail = () => {
  const { stationId } = useParams();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  const { data: station, isLoading } = useQuery({
    queryKey: ["radio-station", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_stations")
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq("id", stationId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!stationId,
  });

  const { data: shows = [] } = useQuery({
    queryKey: ["radio-shows", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_shows")
        .select("*")
        .eq("station_id", stationId)
        .order("time_slot");

      if (error) throw error;
      return data;
    },
    enabled: !!stationId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading station...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Station not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/radio">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            {station.name}
          </h1>
          <p className="text-muted-foreground">Radio Station Details</p>
        </div>
      </div>

      {/* Station Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Station Information
                <Badge variant="outline" className="capitalize">
                  {station.station_type}
                </Badge>
              </CardTitle>
              <CardDescription>
                {(station.city as any)?.name}, {(station.city as any)?.country}
              </CardDescription>
            </div>
            {station.is_active && station.accepts_submissions && (
              <Button onClick={() => setShowSubmitDialog(true)}>
                Submit Song
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Quality</p>
                <p className="font-medium">{station.quality_level}/10</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Listeners</p>
                <p className="font-medium">{station.listener_base.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium capitalize">{station.country}</p>
              </div>
            </div>
          </div>

          {station.accepted_genres && station.accepted_genres.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Genres Played</p>
              <div className="flex flex-wrap gap-2">
                {station.accepted_genres.map((genre) => (
                  <Badge key={genre} variant="secondary">
                    <Music className="h-3 w-3 mr-1" />
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shows Schedule */}
      {shows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Show Schedule</CardTitle>
            <CardDescription>Regular programming and hosts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shows.map((show) => (
                <div
                  key={show.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-accent/50"
                >
                  <div>
                    <p className="font-medium">{show.show_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Host: {show.host_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{show.time_slot}</p>
                    {show.show_genres && show.show_genres.length > 0 && (
                      <Badge variant="outline" className="mt-1">
                        {show.show_genres[0]}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {station && (
        <SubmitSongDialog
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
          station={station}
        />
      )}
    </div>
  );
};

export default RadioStationDetail;
