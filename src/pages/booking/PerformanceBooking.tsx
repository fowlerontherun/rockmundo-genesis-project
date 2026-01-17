import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Guitar, Music, Users, Mic, DollarSign } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { getRehearsalLevel, formatRehearsalTime } from "@/utils/rehearsalLevels";
import { Badge } from "@/components/ui/badge";

export default function PerformanceBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const scheduledDate = location.state?.scheduledDate;
  const scheduledHour = location.state?.scheduledHour;

  const [date, setDate] = useState<Date | undefined>(scheduledDate ? new Date(scheduledDate) : undefined);
  const [activityType, setActivityType] = useState<string>("rehearsal");
  const [timeSlot, setTimeSlot] = useState<string>(
    scheduledHour !== undefined ? `${scheduledHour.toString().padStart(2, "0")}:00` : ""
  );
  const [duration, setDuration] = useState<string>("2");
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [selectedBand, setSelectedBand] = useState<string>("");
  const [practiceType, setPracticeType] = useState<"song" | "setlist">("song");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [selectedSetlist, setSelectedSetlist] = useState<string>("");

  // Fetch user's bands
  const { data: bands = [] } = useQuery({
    queryKey: ["user-bands", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands(id, name, band_balance)")
        .eq("user_id", user.id)
        .eq("member_status", "active");
      if (error) throw error;
      return data?.map(bm => bm.bands).filter(Boolean) || [];
    },
    enabled: !!user?.id,
  });

  // Fetch songs for selected band
  const { data: bandSongs = [] } = useQuery({
    queryKey: ["band-songs", selectedBand, user?.id],
    queryFn: async () => {
      if (!selectedBand || !user?.id) return [];
      const { data, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          genre,
          band_song_familiarity!song_id(familiarity_minutes, band_id)
        `)
        .eq("user_id", user.id)
        .order("title");
      if (error) throw error;
      return data?.map(song => ({
        ...song,
        band_song_familiarity: song.band_song_familiarity?.filter((f: any) => f.band_id === selectedBand)
      })) || [];
    },
    enabled: !!selectedBand && !!user?.id,
  });

  // Fetch setlists for selected band
  const { data: setlists = [] } = useQuery({
    queryKey: ["band-setlists", selectedBand],
    queryFn: async () => {
      if (!selectedBand) return [];
      const { data, error } = await supabase
        .from("setlists")
        .select("id, name, setlist_songs(song_id)")
        .eq("band_id", selectedBand)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBand,
  });

  // Fetch available venues for gigs
  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, capacity, reputation")
        .order("reputation", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch available rehearsal rooms
  const { data: rehearsalRooms = [] } = useQuery({
    queryKey: ["rehearsal-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rehearsal_rooms")
        .select("id, name, quality_rating, hourly_rate")
        .order("quality_rating", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedRoomData = rehearsalRooms.find(r => r.id === selectedRoom);
  const selectedBandData = bands.find((b: any) => b.id === selectedBand);
  const totalCost = selectedRoomData ? selectedRoomData.hourly_rate * parseInt(duration) : 0;

  const handleBookRehearsal = async () => {
    if (!date || !timeSlot || !user || !selectedBand || !selectedRoom) {
      toast({
        title: "Missing Information",
        description: "Please select all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (practiceType === "song" && !selectedSong) {
      toast({
        title: "Select a Song",
        description: "Please choose a song to rehearse.",
        variant: "destructive",
      });
      return;
    }

    if (practiceType === "setlist" && !selectedSetlist) {
      toast({
        title: "Select a Setlist",
        description: "Please choose a setlist to rehearse.",
        variant: "destructive",
      });
      return;
    }

    // Check band balance
    if (selectedBandData && (selectedBandData as any).band_balance < totalCost) {
      toast({
        title: "Insufficient Funds",
        description: `Band balance is $${(selectedBandData as any).band_balance} but rehearsal costs $${totalCost}`,
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const durationHours = parseInt(duration);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationHours * 60 * 60 * 1000);

    try {
      // Create band_rehearsals record
      const { data: rehearsal, error: rehearsalError } = await supabase
        .from("band_rehearsals")
        .insert({
          band_id: selectedBand,
          rehearsal_room_id: selectedRoom,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          duration_hours: durationHours,
          total_cost: totalCost,
          status: "scheduled",
          selected_song_id: practiceType === "song" ? selectedSong : null,
          setlist_id: practiceType === "setlist" ? selectedSetlist : null,
        })
        .select()
        .single();

      if (rehearsalError) throw rehearsalError;

      // Deduct from band balance
      const { error: balanceError } = await supabase
        .from("bands")
        .update({ 
          band_balance: ((selectedBandData as any).band_balance || 0) - totalCost 
        })
        .eq("id", selectedBand);

      if (balanceError) throw balanceError;

      // Create scheduled activity - fetch profile_id first
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (userProfile) {
        await (supabase as any).from("player_scheduled_activities").insert({
          user_id: user.id,
          profile_id: userProfile.id,
          activity_type: "rehearsal",
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: "scheduled",
          title: "Band Rehearsal",
          metadata: {
            rehearsal_id: rehearsal.id,
            band_id: selectedBand,
            rehearsal_room_id: selectedRoom,
          },
        });
      }

      toast({
        title: "Rehearsal Booked!",
        description: `Successfully scheduled rehearsal for ${durationHours} hours.`,
      });

      navigate("/schedule");
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBookActivity = async () => {
    if (activityType === "rehearsal") {
      await handleBookRehearsal();
      return;
    }

    if (!date || !activityType || !timeSlot || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a date, activity type, and time slot.",
        variant: "destructive",
      });
      return;
    }

    if (activityType === "gig" && !selectedVenue) {
      toast({
        title: "Select a Venue",
        description: "Please choose a venue for your gig.",
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const durationHours = parseInt(duration);

    const metadata: any = {};
    if (activityType === "gig") metadata.venue_id = selectedVenue;

    // Fetch profile_id first
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    const { error } = await (supabase as any).from("player_scheduled_activities").insert({
      user_id: user.id,
      profile_id: userProfile?.id,
      activity_type: activityType,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: new Date(scheduledStart.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      title: `${activityType === "gig" ? "Gig" : activityType === "busking" ? "Busking" : "Songwriting"}`,
      metadata,
    });

    if (error) {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Activity Booked!",
      description: "Your performance session has been scheduled.",
    });

    navigate("/schedule");
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => ({
    value: `${i.toString().padStart(2, "0")}:00`,
    label: `${i.toString().padStart(2, "0")}:00`,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Book Performance Activity</h1>
        <p className="text-muted-foreground">Schedule your music sessions in advance</p>
      </div>

      <Tabs value={activityType} onValueChange={setActivityType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rehearsal">
            <Users className="h-4 w-4 mr-2" />
            Rehearsal
          </TabsTrigger>
          <TabsTrigger value="gig">
            <Guitar className="h-4 w-4 mr-2" />
            Gig
          </TabsTrigger>
          <TabsTrigger value="busking">
            <Mic className="h-4 w-4 mr-2" />
            Busking
          </TabsTrigger>
          <TabsTrigger value="songwriting">
            <Music className="h-4 w-4 mr-2" />
            Songwriting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rehearsal" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Choose when to rehearse</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                <div className="space-y-2">
                  <Label>Time Slot</Label>
                  <Select value={timeSlot} onValueChange={setTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(slot => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6].map(hrs => (
                        <SelectItem key={hrs} value={hrs.toString()}>
                          {hrs} hour{hrs > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Band & Room</CardTitle>
                <CardDescription>Select your band and rehearsal space</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Band</Label>
                  <Select value={selectedBand} onValueChange={setSelectedBand}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose band" />
                    </SelectTrigger>
                    <SelectContent>
                      {bands.map((band: any) => (
                        <SelectItem key={band.id} value={band.id}>
                          {band.name} (${band.band_balance})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rehearsal Room</Label>
                  <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rehearsalRooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} (${room.hourly_rate}/hr)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedRoomData && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Total Cost</span>
                    <span className="flex items-center gap-1 text-lg font-bold">
                      <DollarSign className="h-4 w-4" />
                      {totalCost}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedBand && (
            <Card>
              <CardHeader>
                <CardTitle>What to Practice</CardTitle>
                <CardDescription>Choose a song or setlist to rehearse</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={practiceType} onValueChange={(v: any) => setPracticeType(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="song" id="song" />
                    <Label htmlFor="song">Single Song</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="setlist" id="setlist" />
                    <Label htmlFor="setlist">Full Setlist</Label>
                  </div>
                </RadioGroup>

                {practiceType === "song" && (
                  <div className="space-y-2">
                    <Label>Select Song</Label>
                    <Select value={selectedSong} onValueChange={setSelectedSong}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a song" />
                      </SelectTrigger>
                      <SelectContent>
                        {bandSongs.map((song: any) => {
                          const familiarityMinutes = song.band_song_familiarity?.[0]?.familiarity_minutes || 0;
                          const rehearsalInfo = getRehearsalLevel(familiarityMinutes);
                          return (
                            <SelectItem key={song.id} value={song.id}>
                              {song.title} - {rehearsalInfo.name} ({formatRehearsalTime(familiarityMinutes)})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {practiceType === "setlist" && (
                  <div className="space-y-2">
                    <Label>Select Setlist</Label>
                    <Select value={selectedSetlist} onValueChange={setSelectedSetlist}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a setlist" />
                      </SelectTrigger>
                      <SelectContent>
                        {setlists.map((setlist: any) => (
                          <SelectItem key={setlist.id} value={setlist.id}>
                            {setlist.name} ({setlist.setlist_songs?.length || 0} songs)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gig" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Choose when to perform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                <div className="space-y-2">
                  <Label>Time Slot</Label>
                  <Select value={timeSlot} onValueChange={setTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(slot => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 8].map(hrs => (
                        <SelectItem key={hrs} value={hrs.toString()}>
                          {hrs} hour{hrs > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Venue</CardTitle>
                <CardDescription>Select performance venue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {venues.map(venue => (
                  <Button
                    key={venue.id}
                    variant={selectedVenue === venue.id ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => setSelectedVenue(venue.id)}
                  >
                    <span>{venue.name}</span>
                    <span className="text-xs">Rep: {venue.reputation}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="busking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule busking session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(hrs => (
                      <SelectItem key={hrs} value={hrs.toString()}>
                        {hrs} hour{hrs > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="songwriting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule songwriting session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6].map(hrs => (
                      <SelectItem key={hrs} value={hrs.toString()}>
                        {hrs} hour{hrs > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-4">
        <Button onClick={handleBookActivity} size="lg" className="flex-1">
          Book Activity
        </Button>
        <Button onClick={() => navigate("/schedule")} variant="outline" size="lg">
          View Schedule
        </Button>
      </div>
    </div>
  );
}
