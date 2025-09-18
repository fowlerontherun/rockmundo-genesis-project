import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Music, Calendar, DollarSign, Star, Users } from "lucide-react";
import type { Venue, Gig } from "@/types/database";

export default function SimpleAdvancedGigSystem() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load venues
      const { data: venuesData } = await supabase
        .from("venues")
        .select("*")
        .order("prestige_level", { ascending: true });

      if (venuesData) {
        setVenues(venuesData);
      }

      // Load upcoming gigs for user's band
      if (user?.id) {
        const { data: bandsData } = await supabase
          .from("bands")
          .select("id")
          .eq("leader_id", user.id);

        if (bandsData && bandsData.length > 0) {
          const { data: gigsData } = await supabase
            .from("gigs")
            .select("*")
            .eq("band_id", bandsData[0].id)
            .gte("scheduled_date", new Date().toISOString())
            .order("scheduled_date", { ascending: true });

          if (gigsData) {
            setUpcomingGigs(gigsData);
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const bookGig = async (venue: Venue) => {
    if (!user?.id) {
      toast.error("Please log in to book gigs");
      return;
    }

    try {
      // Check if user has a band
      const { data: bandData } = await supabase
        .from("bands")
        .select("id")
        .eq("leader_id", user.id)
        .single();

      if (!bandData) {
        toast.error("You need to create a band first");
        return;
      }

      // Schedule gig for next week
      const gigDate = new Date();
      gigDate.setDate(gigDate.getDate() + 7);

      const { error } = await supabase
        .from("gigs")
        .insert({
          band_id: bandData.id,
          venue_id: venue.id,
          scheduled_date: gigDate.toISOString(),
          status: "scheduled",
          payment: venue.base_payment,
          attendance: 0,
          fan_gain: 0
        });

      if (error) throw error;

      toast.success(`Gig booked at ${venue.name}!`);
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error booking gig:", error);
      toast.error("Failed to book gig");
    }
  };

  const performGig = async (gig: Gig) => {
    try {
      // Simple performance calculation
      const venue = venues.find(v => v.id === gig.venue_id);
      if (!venue) return;

      const attendanceRate = Math.random() * 0.8 + 0.2; // 20-100% attendance
      const attendance = Math.floor(venue.capacity * attendanceRate);
      const performanceScore = Math.floor(Math.random() * 50) + 50; // 50-100 score
      const fanGain = Math.floor(attendance * 0.1 * (performanceScore / 100));

      const { error } = await supabase
        .from("gigs")
        .update({
          status: "completed",
          attendance: attendance,
          fan_gain: fanGain
        })
        .eq("id", gig.id);

      if (error) throw error;

      // Update user's fame/fans
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          fans: supabase.sql`fans + ${fanGain}`,
          fame: supabase.sql`fame + ${Math.floor(fanGain * 0.5)}`
        })
        .eq("user_id", user?.id);

      if (profileError) throw profileError;

      toast.success(`Great performance! Gained ${fanGain} fans!`);
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error performing gig:", error);
      toast.error("Failed to perform gig");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gig System</h1>
          <p className="text-muted-foreground">Book and perform at venues</p>
        </div>
      </div>

      {upcomingGigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Gigs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingGigs.map((gig) => {
                const venue = venues.find(v => v.id === gig.venue_id);
                return (
                  <div
                    key={gig.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{venue?.name || "Unknown Venue"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(gig.scheduled_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Payment: ${gig.payment}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={gig.status === "scheduled" ? "secondary" : "default"}>
                        {gig.status}
                      </Badge>
                      {gig.status === "scheduled" && (
                        <Button
                          size="sm"
                          onClick={() => performGig(gig)}
                        >
                          Perform
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Available Venues
          </CardTitle>
          <CardDescription>
            Choose a venue to book your next gig
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <Card key={venue.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{venue.name}</CardTitle>
                      <CardDescription>{venue.location}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      Level {venue.prestige_level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Capacity
                    </span>
                    <span>{venue.capacity}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Base Pay
                    </span>
                    <span>${venue.base_payment}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Type</span>
                    <span className="capitalize">{venue.venue_type || "Standard"}</span>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => bookGig(venue)}
                  >
                    Book Gig
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {venues.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No venues available at the moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}