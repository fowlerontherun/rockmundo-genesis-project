import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInDays } from "date-fns";
import { MapPin, Clock, Music, DollarSign, Calendar, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TicketSalesDisplay } from "@/components/gig/TicketSalesDisplay";
import { useQuery } from "@tanstack/react-query";
import { calculateDailySalesRate } from "@/utils/ticketSalesSimulation";
import { useNavigate } from "react-router-dom";

interface GigDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gigId: string;
  bandId?: string; // Optional - will be fetched from gig if not provided
}

export function GigDetailsDialog({ open, onOpenChange, gigId }: GigDetailsDialogProps) {
  const navigate = useNavigate();

  // Fetch gig details
  const { data: gig, isLoading: gigLoading } = useQuery({
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

  if (!open) return null;

  const venue = gig?.venues;
  const band = gig?.bands;
  const scheduledDate = gig?.scheduled_date ? new Date(gig.scheduled_date) : new Date();
  const daysUntilGig = differenceInDays(scheduledDate, new Date());
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

  const handleGoToPerform = () => {
    onOpenChange(false);
    navigate(`/gigs/perform/${gigId}`);
  };

  const actionLabel = gig?.status === 'completed'
    ? 'View Performance'
    : gig?.status === 'in_progress' || gig?.status === 'ready_for_completion'
      ? 'Open Gig Viewer'
      : 'Open Gig Preparation';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            <Card>
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{venue?.name}</span>
                    {venue?.location ? <span className="text-muted-foreground"> · {venue.location}</span> : null}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{format(scheduledDate, 'EEE, MMM d, yyyy')}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{format(scheduledDate, 'h:mm a')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Badge variant="outline">{gig.status.replace(/_/g, ' ')}</Badge>
                  {daysUntilGig > 0 ? <span className="text-muted-foreground">{daysUntilGig} days away</span> : null}
                  <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    {gig.ticket_price || 0} per ticket
                  </span>
                </div>
              </CardContent>
            </Card>

            {gig.status === 'scheduled' ? (
              <TicketSalesDisplay
                ticketsSold={ticketsSold}
                predictedTickets={predictedSales}
                venueCapacity={venueCapacity}
              />
            ) : null}

            <Button className="w-full" onClick={handleGoToPerform}>
              <Music className="mr-2 h-4 w-4" />
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
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
