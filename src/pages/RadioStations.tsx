import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRadioStations } from "@/hooks/useRadioStations";
import { Radio, TrendingUp, Users, Music, Signal, Award } from "lucide-react";

const RadioStations = () => {
  const { stations, topAirplay, isLoading } = useRadioStations();
  const [activeTab, setActiveTab] = useState<"stations" | "charts">("stations");

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Radio Stations</h1>
          <p className="text-muted-foreground">Track radio airplay and station performance</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Total Listeners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stations.reduce((sum, s) => sum + s.listener_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Songs on Air</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topAirplay.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Plays</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topAirplay.reduce((sum, a) => sum + a.play_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="charts">Radio Charts</TabsTrigger>
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
                <Card key={station.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{station.station_name}</CardTitle>
                          {station.frequency && (
                            <CardDescription className="flex items-center gap-1">
                              <Signal className="h-3 w-3" />
                              {station.frequency} FM
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge variant={station.reputation >= 80 ? "default" : "secondary"}>
                        {station.reputation}/100
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {station.genre_focus && (
                      <Badge variant="outline">{station.genre_focus}</Badge>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Listeners</p>
                        <p className="font-medium flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {station.listener_count.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hourly Rate</p>
                        <p className="font-medium">${station.hourly_rate}</p>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" className="w-full">
                      Submit Song
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading charts...
              </CardContent>
            </Card>
          ) : topAirplay.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No songs on rotation yet
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Radio Airplay Charts</CardTitle>
                <CardDescription>Top songs across all stations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topAirplay.slice(0, 20).map((airplay, index) => (
                    <div
                      key={airplay.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Badge
                          variant={index < 3 ? "default" : "secondary"}
                          className="w-8 h-8 flex items-center justify-center rounded-full"
                        >
                          {index + 1}
                        </Badge>

                        <div className="flex-1">
                          <div className="font-medium">
                            {(airplay.song as any)?.title || "Unknown"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(airplay.band as any)?.name || "Independent"} •{" "}
                            {(airplay.station as any)?.station_name}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Plays</p>
                            <p className="font-medium">{airplay.play_count}</p>
                          </div>

                          {airplay.weeks_on_rotation > 0 && (
                            <div>
                              <p className="text-muted-foreground">Weeks</p>
                              <p className="font-medium">{airplay.weeks_on_rotation}</p>
                            </div>
                          )}

                          {airplay.peak_position && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              #{airplay.peak_position}
                            </Badge>
                          )}

                          {airplay.listener_response > 0 && (
                            <div>
                              <p className="text-muted-foreground">Response</p>
                              <p className="font-medium">{(airplay.listener_response * 100).toFixed(0)}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RadioStations;
