import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { executeGigPerformance } from "@/utils/gigExecution";

export const useAutoGigExecution = (bandId: string | null) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!bandId) return;

    const checkAndExecuteGigs = async () => {
      try {
        // Get scheduled gigs that should have been performed
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const { data: overdueGigs, error } = await supabase
          .from('gigs')
          .select('*, venues!gigs_venue_id_fkey(capacity)')
          .eq('band_id', bandId)
          .eq('status', 'scheduled')
          .lt('scheduled_date', oneHourAgo.toISOString())
          .not('setlist_id', 'is', null);

        if (error) throw error;

        if (overdueGigs && overdueGigs.length > 0) {
          console.log(`Found ${overdueGigs.length} overdue gig(s) to auto-execute`);

          for (const gig of overdueGigs) {
            try {
              await executeGigPerformance({
                gigId: gig.id,
                bandId: gig.band_id,
                setlistId: gig.setlist_id!,
                venueCapacity: gig.venues?.capacity || 100,
                ticketPrice: gig.ticket_price || 20
              });

              toast({
                title: "Gig Auto-Completed",
                description: `Your gig at ${new Date(gig.scheduled_date).toLocaleDateString()} has been performed!`,
              });
            } catch (execError) {
              console.error(`Failed to auto-execute gig ${gig.id}:`, execError);
              
              // Mark gig as failed
              await supabase
                .from('gigs')
                .update({ status: 'cancelled' })
                .eq('id', gig.id);
            }
          }
        }
      } catch (error) {
        console.error('Error checking for overdue gigs:', error);
      }
    };

    // Check on mount
    checkAndExecuteGigs();

    // Check every 5 minutes
    const interval = setInterval(checkAndExecuteGigs, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [bandId, toast]);
};
