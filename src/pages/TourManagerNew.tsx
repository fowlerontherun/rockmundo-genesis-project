import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Music, DollarSign, ArrowLeft, Plus } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useTours } from "@/hooks/useTours";
import { useAuth } from "@/hooks/use-auth-context";
import { format } from "date-fns";

export default function TourManagerNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tours, tourGigs, venues, createTour, addGigToTour } = useTours(undefined);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tourName, setTourName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateTour = () => {
    if (!tourName || !startDate || !endDate || !user) return;

    createTour.mutate({
      name: tourName,
      bandId: null,
      userId: user.id,
      startDate,
      endDate,
    }, {
      onSuccess: () => {
        setCreateDialogOpen(false);
        setTourName("");
        setStartDate("");
        setEndDate("");
      },
    });
  };

  const activeTours = tours?.filter(t => new Date(t.end_date) >= new Date()) || [];
  const pastTours = tours?.filter(t => new Date(t.end_date) < new Date()) || [];

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
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Tour
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tour</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tour Name</Label>
                <Input
                  value={tourName}
                  onChange={(e) => setTourName(e.target.value)}
                  placeholder="Summer 2025 Tour"
                />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateTour} className="w-full">
                Create Tour
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Tours</TabsTrigger>
          <TabsTrigger value="past">Past Tours</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeTours.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Active Tours</h3>
                <p className="text-muted-foreground mb-4">Create your first tour to get started</p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tour
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeTours.map((tour) => {
                const gigs = tourGigs?.filter((g: any) => g.tour_id === tour.id) || [];
                const totalRevenue = gigs.reduce((sum: number, g: any) => sum + (g.estimated_revenue || 0), 0);

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
                        <Badge>Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Shows</p>
                          <p className="text-2xl font-bold">{gigs.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="text-2xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cities</p>
                          <p className="text-2xl font-bold">
                            {new Set(gigs.map((g: any) => g.venue?.city_id).filter(Boolean)).size}
                          </p>
                        </div>
                      </div>

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
                    <CardTitle>{tour.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tour.start_date), "MMM d")} - {format(new Date(tour.end_date), "MMM d, yyyy")}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="venues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues?.map((venue) => (
              <Card key={venue.id}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{venue.name}</h3>
                  <p className="text-sm text-muted-foreground">{venue.city?.name}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-semibold">{venue.capacity}</span>
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
    </div>
  );
}
