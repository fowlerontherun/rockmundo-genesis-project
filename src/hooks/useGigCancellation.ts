import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Refund percentages based on days until gig
const CANCELLATION_REFUND_SCALE: Record<number, number> = {
  14: 1.0,   // 100% refund if cancelled 14+ days before
  7: 0.75,  // 75% refund 7-13 days before
  3: 0.50,  // 50% refund 3-6 days before
  1: 0.25,  // 25% refund 1-2 days before
  0: 0.0,   // No refund on day of
};

// Fame penalty is inverse of refund - earlier cancellation means less penalty
const FAME_PENALTY_SCALE: Record<number, number> = {
  14: 0,    // No penalty if cancelled 14+ days before
  7: 5,     // 5 fame penalty 7-13 days before
  3: 15,   // 15 fame penalty 3-6 days before
  1: 30,   // 30 fame penalty 1-2 days before
  0: 50,   // 50 fame penalty on day of
};

interface CancellationDetails {
  gigId: string;
  bandId: string;
  bookingFee: number;
  daysUntilGig: number;
  refundAmount: number;
  refundPercentage: number;
  famePenalty: number;
}

export function useGigCancellation() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const getRefundPercentage = (daysUntil: number): number => {
    if (daysUntil >= 14) return CANCELLATION_REFUND_SCALE[14];
    if (daysUntil >= 7) return CANCELLATION_REFUND_SCALE[7];
    if (daysUntil >= 3) return CANCELLATION_REFUND_SCALE[3];
    if (daysUntil >= 1) return CANCELLATION_REFUND_SCALE[1];
    return CANCELLATION_REFUND_SCALE[0];
  };

  const getFamePenalty = (daysUntil: number): number => {
    if (daysUntil >= 14) return FAME_PENALTY_SCALE[14];
    if (daysUntil >= 7) return FAME_PENALTY_SCALE[7];
    if (daysUntil >= 3) return FAME_PENALTY_SCALE[3];
    if (daysUntil >= 1) return FAME_PENALTY_SCALE[1];
    return FAME_PENALTY_SCALE[0];
  };

  const calculateCancellationDetails = (
    gigId: string,
    bandId: string,
    scheduledDate: string,
    bookingFee: number
  ): CancellationDetails => {
    const now = new Date();
    const gigDate = new Date(scheduledDate);
    const daysUntilGig = Math.max(0, Math.ceil((gigDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const refundPercentage = getRefundPercentage(daysUntilGig);
    const refundAmount = Math.floor(bookingFee * refundPercentage);
    const famePenalty = getFamePenalty(daysUntilGig);

    return {
      gigId,
      bandId,
      bookingFee,
      daysUntilGig,
      refundAmount,
      refundPercentage,
      famePenalty,
    };
  };

  const cancelGig = async (details: CancellationDetails): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Update gig status to cancelled
      const { error: gigError } = await supabase
        .from('gigs')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', details.gigId);

      if (gigError) throw gigError;

      // Get current band stats
      const { data: band, error: bandFetchError } = await supabase
        .from('bands')
        .select('band_balance, fame')
        .eq('id', details.bandId)
        .single();

      if (bandFetchError) throw bandFetchError;

      // Apply refund to band balance and fame penalty
      const newBalance = (band.band_balance || 0) + details.refundAmount;
      const newFame = Math.max(0, (band.fame || 0) - details.famePenalty);

      const { error: bandError } = await supabase
        .from('bands')
        .update({ 
          band_balance: newBalance,
          fame: newFame
        })
        .eq('id', details.bandId);

      if (bandError) throw bandError;

      // Log the cancellation in band_earnings (negative for refund)
      if (details.refundAmount > 0) {
        await supabase
          .from('band_earnings')
          .insert({
            band_id: details.bandId,
            source: 'gig_cancellation_refund',
            amount: details.refundAmount,
            description: `Gig cancellation refund (${Math.round(details.refundPercentage * 100)}%)`,
            metadata: { gig_id: details.gigId, days_until_gig: details.daysUntilGig }
          });
      }

      // Log fame penalty event if any
      if (details.famePenalty > 0) {
        await supabase
          .from('band_fame_events')
          .insert({
            band_id: details.bandId,
            event_type: 'gig_cancellation',
            fame_gained: -details.famePenalty,
            event_data: { gig_id: details.gigId, days_until_gig: details.daysUntilGig }
          });
      }

      toast({
        title: 'Gig Cancelled',
        description: details.refundAmount > 0 
          ? `Refunded $${details.refundAmount.toLocaleString()} (${Math.round(details.refundPercentage * 100)}%)${details.famePenalty > 0 ? `. Lost ${details.famePenalty} fame.` : ''}`
          : `Gig cancelled. Lost ${details.famePenalty} fame.`,
        variant: details.famePenalty > 0 ? 'destructive' : 'default',
      });

      return true;
    } catch (error) {
      console.error('Error cancelling gig:', error);
      toast({
        title: 'Cancellation Failed',
        description: 'Unable to cancel the gig. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    calculateCancellationDetails,
    cancelGig,
  };
}
