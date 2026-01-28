import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Search, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkGigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (gigId: string, gigTitle: string, extra?: { venue?: string; city?: string }) => void;
}

export const LinkGigDialog = ({ open, onOpenChange, onSelect }: LinkGigDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: ["user-gigs-for-twaater", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's bands
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      const bandIds = memberships?.map((m) => m.band_id) || [];
      if (bandIds.length === 0) return [];

      // Fetch gigs
      const { data: gigs, error } = await supabase
        .from("gigs")
        .select(`
          id, status, scheduled_date, ticket_price,
          venue:venues(id, name, city:cities(name)),
          band:bands(id, name)
        `)
        .in("band_id", bandIds)
        .in("status", ["scheduled", "confirmed", "completed"])
        .order("scheduled_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return gigs || [];
    },
    enabled: open && !!user?.id,
  });

  const filteredGigs = gigs.filter((g: any) =>
    g.venue?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.band?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />
            Link a Gig
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search gigs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">Loading gigs...</div>
          ) : filteredGigs.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              {search ? "No gigs found" : "No gigs yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGigs.map((gig: any) => (
                <button
                  key={gig.id}
                  onClick={() => {
                    const title = `${gig.band?.name} @ ${gig.venue?.name}`;
                    const venueName = gig.venue?.name || '';
                    const cityName = gig.venue?.city?.name || '';
                    onSelect(gig.id, title, { venue: venueName, city: cityName });
                    onOpenChange(false);
                  }}
                  className="w-full p-3 rounded-lg text-left transition-colors hover:bg-[hsl(var(--twaater-hover))] border border-transparent hover:border-[hsl(var(--twaater-border))]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{gig.band?.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {gig.venue?.name}, {gig.venue?.city?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {gig.scheduled_date && format(new Date(gig.scheduled_date), "PPP 'at' p")}
                      </p>
                    </div>
                    <Badge 
                      variant={gig.status === "completed" ? "default" : "secondary"} 
                      className="text-xs capitalize"
                    >
                      {gig.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};