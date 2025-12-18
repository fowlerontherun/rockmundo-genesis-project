import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Music, DollarSign, ArrowLeft, Plus } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useTours } from "@/hooks/useTours";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { TourWizard } from "@/components/tours/TourWizard";

const APP_VERSION = "1.0.220";

export default function TourManagerNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tours, tourGigs, venues } = useTours(undefined);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  // Fetch user's bands
  const { data: userBands } = useQuery({
    queryKey: ['user-bands-for-tour', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('band_members')
        .select('band_id, bands!band_members_band_id_fkey(id, name, fame, total_fans, band_balance)')
        .eq('user_id', user.id)
        .eq('role', 'leader');
      if (error) throw error;
      return data?.map(d => d.bands).filter(Boolean) || [];
    },
    enabled: !!user?.id,
  });

  const activeTours = tours?.filter(t => new Date(t.end_date) >= new Date() && !t.cancelled) || [];
  const pastTours = tours?.filter(t => new Date(t.end_date) < new Date() || t.cancelled) || [];

  const handleOpenWizard = () => {
    if (userBands && userBands.length === 1) {
      setSelectedBandId(userBands[0]?.id || null);
    }
    setCreateDialogOpen(true);
  };

  const handleWizardComplete = () => {
    setCreateDialogOpen(false);
    setSelectedBandId(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/music-hub")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Music Hub
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Tour Manager</h1>
            <p className="text-muted-foreground">Plan and manage your band's tours</p>
          </div>
        </div>
        
        <Button size="lg" onClick={handleOpenWizard} disabled={!userBands || userBands.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Plan New Tour
        </Button>
      </div>

      <Badge variant="outline" className="text-xs">v{APP_VERSION}</Badge>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Tours ({activeTours.length})</TabsTrigger>
          <TabsTrigger value="past">Past Tours ({pastTours.length})</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeTours.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Active Tours</h3>
                <p className="text-muted-foreground mb-4">Plan your first tour to hit the road</p>
                <Button onClick={handleOpenWizard} disabled={!userBands || userBands.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Plan New Tour
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeTours.map((tour) => {
                const gigs = tourGigs?.filter((g: any) => g.tour_id === tour.id) || [];
                const totalRevenue = tour.total_revenue || 0;

                return (
                  <Card key={tour.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{tour.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(tour.start_date), "MMM d")} - {format(new Date(tour.end_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{tour.scope || 'country'}</Badge>
                          <Badge>Active</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Shows</p>
                          <p className="text-2xl font-bold">{tour.target_show_count || gigs.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="text-2xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Upfront Cost</p>
                          <p className="text-2xl font-bold">${(tour.total_upfront_cost || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Travel Mode</p>
                          <p className="text-lg font-semibold capitalize">{tour.travel_mode || 'auto'}</p>
                        </div>
                      </div>

                      {gigs.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Upcoming Shows</h4>
                          {gigs.slice(0, 3).map((gig: any) => (
                            <div key={gig.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span className="text-sm">{format(new Date(gig.scheduled_date), "MMM d")}</span>
                                <MapPin className="h-4 w-4 ml-2" />
                                <span className="text-sm">{gig.venue?.name || 'TBD'}</span>
                              </div>
                              <Badge variant="outline">{gig.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {pastTours.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <p className="text-muted-foreground">No past tours yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pastTours.map((tour) => (
                <Card key={tour.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{tour.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tour.start_date), "MMM d")} - {format(new Date(tour.end_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant={tour.cancelled ? "destructive" : "secondary"}>
                        {tour.cancelled ? 'Cancelled' : 'Completed'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Shows</p>
                        <p className="text-xl font-bold">{tour.target_show_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-xl font-bold text-green-500">${(tour.total_revenue || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Costs</p>
                        <p className="text-xl font-bold">${(tour.total_upfront_cost || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="venues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues?.slice(0, 12).map((venue) => (
              <Card key={venue.id}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{venue.name}</h3>
                  <p className="text-sm text-muted-foreground">{venue.city?.name}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-semibold">{venue.capacity?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline">{venue.venue_type}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tour Wizard Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {!selectedBandId && userBands && userBands.length > 1 ? (
            <div className="space-y-4 p-4">
              <h2 className="text-xl font-bold">Select Band for Tour</h2>
              <Select value={selectedBandId || ''} onValueChange={setSelectedBandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a band" />
                </SelectTrigger>
                <SelectContent>
                  {userBands.map((band: any) => (
                    <SelectItem key={band.id} value={band.id}>
                      {band.name} ({band.fame?.toLocaleString() || 0} fame, ${band.band_balance?.toLocaleString() || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : selectedBandId ? (
            <TourWizard
              bandId={selectedBandId}
              onComplete={handleWizardComplete}
              onCancel={() => {
                setCreateDialogOpen(false);
                setSelectedBandId(null);
              }}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              You must be a band leader to create a tour.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
