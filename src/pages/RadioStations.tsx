import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRadioStations } from "@/hooks/useRadioStations";
import { Radio, Users, MapPin, Star, Music } from "lucide-react";
import { SubmitSongDialog } from "@/components/radio/SubmitSongDialog";
import { MyRadioSubmissions } from "@/components/radio/MyRadioSubmissions";
import type { RadioStation } from "@/hooks/useRadioStations";

const RadioStations = () => {
  const navigate = useNavigate();
  const { stations, mySubmissions, isLoading } = useRadioStations();
  const [activeTab, setActiveTab] = useState<"stations" | "submissions">("stations");
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Radio Stations</h1>
          <p className="text-muted-foreground">Track radio airplay and station performance</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stations.reduce((sum, s) => sum + (s.listener_base || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Submissions</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mySubmissions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
        </TabsList>

        {/* Stations Tab */}
        <TabsContent value="stations" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading stations...
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stations.map((station) => (
                <Card key={station.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{station.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 capitalize">
                            {station.station_type}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {station.quality_level}/10
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {station.accepted_genres && station.accepted_genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {station.accepted_genres.slice(0, 3).map((genre) => (
                          <Badge key={genre} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {station.accepted_genres.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{station.accepted_genres.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Listeners</p>
                        <p className="font-medium flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {(station.listener_base || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Range</p>
                        <p className="font-medium flex items-center gap-1 capitalize">
                          <MapPin className="h-4 w-4" />
                          {station.country}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/radio/${station.id}`)}
                      >
                        View Details
                      </Button>
                      {station.accepts_submissions && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedStation(station);
                            setShowSubmitDialog(true);
                          }}
                        >
                          Submit Song
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Submissions Tab */}
        <TabsContent value="submissions" className="mt-6">
          <MyRadioSubmissions />
        </TabsContent>
      </Tabs>

      {selectedStation && (
        <SubmitSongDialog
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
          station={selectedStation}
        />
      )}
    </div>
  );
};

export default RadioStations;
