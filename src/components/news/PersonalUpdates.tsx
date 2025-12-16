import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Gift, Calendar } from "lucide-react";
import { format } from "date-fns";

export function PersonalUpdates() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const { data: updates } = useQuery({
    queryKey: ["personal-updates", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      const results: Array<{ type: string; title: string; detail: string; time: string }> = [];

      // Band invitations
      const { data: invites } = await supabase
        .from("band_invitations")
        .select("created_at, status, bands(name)")
        .eq("invited_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);

      invites?.forEach((invite: any) => {
        if (invite.bands) {
          results.push({
            type: "invite",
            title: `Invited to join ${invite.bands.name}`,
            detail: "Band invitation pending",
            time: format(new Date(invite.created_at), "HH:mm"),
          });
        }
      });

      // Gig offers
      const { data: offers } = await supabase
        .from("gig_offers")
        .select("created_at, status, venues(name)")
        .eq("status", "pending")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(3);

      offers?.forEach((offer: any) => {
        if (offer.venues) {
          results.push({
            type: "offer",
            title: `Gig offer at ${offer.venues.name}`,
            detail: "Awaiting response",
            time: format(new Date(offer.created_at), "HH:mm"),
          });
        }
      });

      // Upcoming scheduled activities
      const { data: activities } = await supabase
        .from("player_scheduled_activities")
        .select("activity_type, scheduled_start")
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("scheduled_start", new Date().toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(3);

      activities?.forEach((activity) => {
        results.push({
          type: "activity",
          title: `Upcoming: ${activity.activity_type.replace(/_/g, " ")}`,
          detail: format(new Date(activity.scheduled_start), "MMM d, HH:mm"),
          time: "",
        });
      });

      return results.slice(0, 6);
    },
    enabled: !!user?.id,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "invite": return <Mail className="h-4 w-4 text-blue-500" />;
      case "offer": return <Gift className="h-4 w-4 text-green-500" />;
      case "activity": return <Calendar className="h-4 w-4 text-purple-500" />;
      default: return <Bell className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (!user) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Your Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {updates && updates.length > 0 ? (
          updates.map((update, index) => (
            <div key={index} className="flex items-start gap-2 py-1">
              {getIcon(update.type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{update.title}</p>
                <p className="text-xs text-muted-foreground">{update.detail}</p>
              </div>
              {update.time && <Badge variant="outline" className="shrink-0">{update.time}</Badge>}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">No pending updates</p>
        )}
      </CardContent>
    </Card>
  );
}
