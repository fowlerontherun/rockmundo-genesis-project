import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music2, MapPin } from "lucide-react";
import { useState } from "react";
import { GigOutcomeReport } from "@/components/gig/GigOutcomeReport";

interface GigWithDetails {
  id: string;
  band_id: string;
  venue_id: string;
  completed_at: string;
  bands: { name: string };
  venues: { name: string; city_id: string; capacity: number; cities: { name: string } };
  gig_outcomes: Array<any>;
}

export const LastNightGigs = () => {
  const [selectedGig, setSelectedGig] = useState<GigWithDetails | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = `${yesterday.toISOString().split('T')[0]}T00:00:00`;
  const yesterdayEnd = `${yesterday.toISOString().split('T')[0]}T23:59:59`;

  const { data: lastNightGigs, isLoading } = useQuery({
    queryKey: ["last-night-gigs", yesterdayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select(`
          id,
          band_id,
          venue_id,
          completed_at,
          bands!gigs_band_id_fkey(name),
          venues!gigs_venue_id_fkey(name, city_id, capacity, cities(name)),
          gig_outcomes(*)
        `)
        .eq("status", "completed")
        .gte("completed_at", yesterdayStart)
        .lte("completed_at", yesterdayEnd)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GigWithDetails[];
    },
  });

  const handleViewOutcome = async (gig: GigWithDetails) => {
    setSelectedGig(gig);
    setShowOutcome(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Last Night's Gigs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!lastNightGigs || lastNightGigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Last Night's Gigs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No gigs were performed last night.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Last Night's Gigs ({lastNightGigs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lastNightGigs.map((gig) => (
              <div
                key={gig.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Music2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{gig.bands?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {gig.venues?.name}, {gig.venues?.cities?.name}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewOutcome(gig)}
                  disabled={!gig.gig_outcomes || gig.gig_outcomes.length === 0}
                >
                  View Outcome
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedGig && selectedGig.gig_outcomes?.[0] && (
        <GigOutcomeReport
          isOpen={showOutcome}
          onClose={() => {
            setShowOutcome(false);
            setSelectedGig(null);
          }}
          outcome={selectedGig.gig_outcomes[0]}
          venueName={selectedGig.venues?.name || "Unknown Venue"}
          venueCapacity={selectedGig.venues?.capacity || 0}
          chemistryLevel={selectedGig.gig_outcomes[0]?.band_chemistry_level || 50}
          chemistryChange={selectedGig.gig_outcomes[0]?.chemistry_change || 0}
        />
      )}
    </>
  );
};
