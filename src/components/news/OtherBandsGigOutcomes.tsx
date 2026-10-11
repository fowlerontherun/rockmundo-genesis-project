import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic2, Star, Users, Flame, MapPin, Eye } from "lucide-react";
import { format } from "date-fns";
import { GigOutcomeReport } from "@/components/gig/GigOutcomeReport";

export const OtherBandsGigOutcomes = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedOutcome, setSelectedOutcome] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Get all bands' gig outcomes today
  const { data: allGigs, isError, refetch } = useQuery({
    queryKey: ["news-all-gigs-today", today, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gig_outcomes")
        .select(`
          *,
          gigs!inner(
            band_id,
            scheduled_date,
            bands(name, genre),
            venues(name, capacity, cities(name))
          )
        `)
        .gte("completed_at", `${today}T00:00:00`)
        .order("completed_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize);
      if (error) throw error;
      return data || [];
    },
  });

  if (isError) return <Card><CardContent role="alert" className="flex items-center justify-between gap-3 py-4"><p className="text-sm text-destructive">Gig results could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button></CardContent></Card>;

  if (!allGigs || (allGigs.length === 0 && page === 0)) {
    return null;
  }

  const renderStars = (rating: number | null) => {
    const stars = Math.round((rating || 0) / 20);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < stars ? "text-warning fill-warning" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  const handleViewOutcome = (gig: any) => {
    setSelectedOutcome(gig);
    setShowReport(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic2 className="h-5 w-5 text-primary" />
            Today's Gig Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allGigs.map((gig: any) => {
            const band = gig.gigs?.bands;
            const venue = gig.gigs?.venues;
            const city = venue?.cities;

            return (
              <div key={gig.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{band?.name || "Unknown Band"}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {gig.venue_name || venue?.name}
                      {city?.name && `, ${city.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(gig.overall_rating)}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleViewOutcome(gig)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {gig.actual_attendance != null && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{gig.actual_attendance.toLocaleString()} attended</span>
                    </div>
                  )}
                  {gig.fame_gained != null && gig.fame_gained > 0 && (
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <Badge variant="outline" className="text-xs">+{gig.fame_gained}</Badge>
                    </div>
                  )}
                  {band?.genre && (
                    <Badge variant="secondary" className="text-xs">{band.genre}</Badge>
                  )}
                </div>
              </div>
            );
          })}
          {allGigs.length === 0 && <p className="text-sm text-muted-foreground">No more gig results on this page.</p>}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" disabled={allGigs.length < pageSize} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>

      {selectedOutcome && (
        <GigOutcomeReport
          isOpen={showReport}
          onClose={() => {
            setShowReport(false);
            setSelectedOutcome(null);
          }}
          outcome={selectedOutcome}
          venueName={selectedOutcome.venue_name || selectedOutcome.gigs?.venues?.name || "Unknown Venue"}
          venueCapacity={selectedOutcome.gigs?.venues?.capacity || 0}
          chemistryLevel={selectedOutcome.band_chemistry_level || 50}
          chemistryChange={selectedOutcome.chemistry_change || 0}
        />
      )}
    </>
  );
};