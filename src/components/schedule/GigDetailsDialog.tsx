import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { MapPin, Clock, Users, Ticket, Music, DollarSign, Calendar, TrendingDown, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GigSetlistDisplay } from "@/components/gig/GigSetlistDisplay";
import { TicketPriceAdjuster } from "@/components/gig/TicketPriceAdjuster";
import { TicketSalesDisplay } from "@/components/gig/TicketSalesDisplay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateDailySalesRate } from "@/utils/ticketSalesSimulation";
import { useNavigate } from "react-router-dom";

interface GigDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gigId: string;
  bandId: string;
}

export function GigDetailsDialog({ open, onOpenChange, gigId, bandId }: GigDetailsDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch gig details
  const { data: gig, isLoading: gigLoading, refetch: refetchGig } = useQuery({
    queryKey: ['gig-details', gigId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gigs')
        .select(`
          *,
          venues!gigs_venue_id_fkey(id, name, location, capacity, prestige_level, city_id),
          bands!gigs_band_id_fkey(id, name, fame, total_fans)
        `)
        .eq('id', gigId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!gigId,
  });

  // Fetch band setlists with song count
  const { data: setlists = [] } = useQuery({
    queryKey: ['band-setlists-for-gig', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setlists')
        .select('id, name')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get song counts for each setlist
      const setlistsWithCounts = await Promise.all((data || []).map(async (setlist) => {
        const { count } = await supabase
          .from('setlist_songs')
          .select('*', { count: 'exact', head: true })
          .eq('setlist_id', setlist.id);
        return { ...setlist, song_count: count || 0 };
      }));
      
      return setlistsWithCounts;
    },
    enabled: open && !!bandId,
  });

  // Fetch current setlist name
  const { data: currentSetlist } = useQuery({
    queryKey: ['setlist-name', gig?.setlist_id],
    queryFn: async () => {
      if (!gig?.setlist_id) return null;
      const { data, error } = await supabase
        .from('setlists')
        .select('name')
        .eq('id', gig.setlist_id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!gig?.setlist_id,
  });

  if (!open) return null;

  const venue = gig?.venues;
  const band = gig?.bands;
  const scheduledDate = gig?.scheduled_date ? new Date(gig.scheduled_date) : new Date();
  const daysUntilGig = differenceInDays(scheduledDate, new Date());
  const hoursUntilGig = differenceInHours(scheduledDate, new Date());
  const ticketsSold = gig?.tickets_sold || 0;
  const venueCapacity = venue?.capacity || 100;

  // Calculate predicted sales
  let predictedSales = 0;
  if (band && venue) {
    const salesResult = calculateDailySalesRate({
      bandFame: band.fame || 0,
      bandTotalFans: band.total_fans || 0,
      venueCapacity: venueCapacity,
      daysUntilGig: Math.max(1, daysUntilGig),
      daysBooked: 14, // Assume 2 weeks advance booking
      ticketPrice: gig?.ticket_price || 20,
    });
    predictedSales = salesResult.expectedTotalSales;
  }

  // Check if price adjustment is available
  const salesPercentage = predictedSales > 0 ? (ticketsSold / predictedSales) * 100 : 0;
  const canAdjustPrice = daysUntilGig >= 7 && salesPercentage < 50 && !gig?.price_adjusted_at;

  const handleSetlistChanged = () => {
    refetchGig();
    queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
  };

  const handlePriceAdjusted = () => {
    refetchGig();
  };

  const handleGoToPerform = () => {
    onOpenChange(false);
    navigate(`/perform/${gigId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Gig Details
          </DialogTitle>
          <DialogDescription>
            {venue?.name || 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        {gigLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : gig ? (
          <div className="space-y-4">
            {/* Venue & Date Info */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{venue?.name}</span>
                  {venue?.location && (
                    <span className="text-muted-foreground">• {venue.location}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(scheduledDate, 'h:mm a')}</span>
                  {daysUntilGig > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {daysUntilGig} days away
                    </Badge>
                  )}
                  {daysUntilGig === 0 && hoursUntilGig > 0 && (
                    <Badge variant="default" className="ml-2">
                      {hoursUntilGig} hours away
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Capacity: {venueCapacity?.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Ticket Sales */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Ticket Sales
              </h4>
              <TicketSalesDisplay
                ticketsSold={ticketsSold}
                predictedTickets={predictedSales}
                venueCapacity={venueCapacity}
              />
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Ticket Price: ${gig.ticket_price || 0}</span>
                {gig.original_ticket_price && gig.original_ticket_price !== gig.ticket_price && (
                  <Badge variant="outline" className="text-xs">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Reduced from ${gig.original_ticket_price}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price Adjustment (if eligible) */}
            {canAdjustPrice && (
              <>
                <Separator />
                <TicketPriceAdjuster
                  gigId={gigId}
                  currentPrice={gig.ticket_price || 20}
                  ticketsSold={ticketsSold}
                  predictedSales={predictedSales}
                  onPriceAdjusted={handlePriceAdjusted}
                />
              </>
            )}

            <Separator />

            {/* Setlist */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Music className="h-4 w-4" />
                Setlist
              </h4>
              <GigSetlistDisplay
                gigId={gigId}
                bandId={bandId}
                currentSetlistId={gig.setlist_id}
                currentSetlistName={currentSetlist?.name}
                scheduledDate={gig.scheduled_date}
                setlists={setlists}
                onSetlistChanged={handleSetlistChanged}
              />
            </div>

            {/* Action Button */}
            {hoursUntilGig <= 1 && hoursUntilGig > 0 && (
              <>
                <Separator />
                <Button className="w-full" onClick={handleGoToPerform}>
                  <Music className="h-4 w-4 mr-2" />
                  Go to Performance
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Could not load gig details</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
