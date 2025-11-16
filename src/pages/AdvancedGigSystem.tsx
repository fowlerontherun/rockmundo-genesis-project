import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdvancedGigs } from "@/hooks/useAdvancedGigs";
import { Calendar, Clock, AlertTriangle, Lock, Music, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdvancedGigSystem() {
  const { bandId } = useParams<{ bandId: string }>();
  const [userBandId, setUserBandId] = useState<string | null>(null);

  useEffect(() => {
    if (bandId) {
      setUserBandId(bandId);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single()
        .then(({ data: member }) => {
          if (member) setUserBandId(member.band_id);
        });
    });
  }, [bandId]);

  const { offers, conflicts, lockouts, upcomingGigs, isLoading } = useAdvancedGigs(userBandId || undefined);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading gig system data...</p>
      </div>
    );
  }

  if (!userBandId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Advanced Gig System</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Join or create a band to manage gigs and offers.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Advanced Gig System</h1>
        <p className="text-muted-foreground">Manage offers, resolve conflicts, and track upcoming performances.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Offers</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{conflicts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Lockouts</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lockouts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Temporary restrictions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Gigs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingGigs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled & confirmed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="offers">Gig Offers</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="lockouts">Lockouts</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Gig Offers</CardTitle>
              <CardDescription>Review and respond to incoming performance opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              {offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending offers at the moment.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div key={offer.id} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{offer.venue?.name || "Unknown Venue"}</p>
                          <Badge variant="outline" className="capitalize">{offer.slot_type}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(offer.offered_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            <span>Payout: ${offer.base_payout}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Expires: {new Date(offer.expires_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="default">Accept</Button>
                          <Button size="sm" variant="outline">Counter</Button>
                          <Button size="sm" variant="ghost">Decline</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Conflicts</CardTitle>
              <CardDescription>Resolve double-bookings and timing issues</CardDescription>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conflicts detected. All clear!</p>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="flex items-start gap-3 p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-orange-600 dark:text-orange-400 capitalize">
                          {conflict.conflict_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Detected: {new Date(conflict.detected_at).toLocaleString()}
                        </p>
                        <Button size="sm" variant="outline">Resolve Conflict</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lockouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Lockouts</CardTitle>
              <CardDescription>Temporary restrictions on band activities</CardDescription>
            </CardHeader>
            <CardContent>
              {lockouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active lockouts. Full access to all activities!</p>
              ) : (
                <div className="space-y-3">
                  {lockouts.map((lockout) => (
                    <div key={lockout.id} className="flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                      <Lock className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-red-600 dark:text-red-400 capitalize">
                          {lockout.activity_type.replace(/_/g, " ")} Locked
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Until: {new Date(lockout.locked_until).toLocaleString()}
                        </p>
                        {lockout.reason && (
                          <p className="text-sm text-muted-foreground italic">{lockout.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Performances</CardTitle>
              <CardDescription>Scheduled and confirmed gigs</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingGigs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming gigs scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingGigs.map((gig: any) => (
                    <div key={gig.id} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{gig.venue?.name || "Unknown Venue"}</p>
                          <Badge variant={gig.status === "confirmed" ? "default" : "secondary"} className="capitalize">
                            {gig.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(gig.scheduled_date).toLocaleDateString()}</span>
                          </div>
                          {gig.ticket_price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>${gig.ticket_price} tickets</span>
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline">View Details</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
