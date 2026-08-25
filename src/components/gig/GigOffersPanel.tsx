import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Clock, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { acceptGigOffer, rejectGigOffer } from '@/utils/gigOfferGenerator';
import { SupportMarketplacePanel } from '@/features/support-bands/SupportMarketplacePanel';
import { SupportHistoryPanel } from '@/features/support-bands/SupportHistoryPanel';

interface GigOffer {
  id: string;
  venue_id: string;
  promoter_id: string;
  offered_date: string;
  slot_type: string;
  base_payout: number;
  ticket_price: number;
  expires_at: string;
  offer_reason: string;
  metadata: any;
}

export function GigOffersPanel({ bandId }: { bandId: string }) {
  const [offers, setOffers] = useState<GigOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    void loadOffers();

    const channel = supabase
      .channel('gig-offers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gig_offers',
          filter: `band_id=eq.${bandId}`,
        },
        () => void loadOffers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId]);

  const loadOffers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gig_offers')
      .select('*')
      .eq('band_id', bandId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (!error && data) setOffers(data);
    setLoading(false);
  };

  const handleAccept = async (offerId: string) => {
    const { error } = await acceptGigOffer(offerId);
    if (error) {
      toast({ title: 'Failed to Accept', description: error, variant: 'destructive' });
    } else {
      toast({ title: '🎸 Gig Booked!', description: 'The gig has been added to your schedule' });
      void loadOffers();
    }
  };

  const handleReject = async (offerId: string) => {
    await rejectGigOffer(offerId);
    toast({ title: 'Offer Rejected', description: 'The booking offer has been declined' });
    void loadOffers();
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Booking Offers{!loading ? ` (${offers.length})` : ''}</h3>
          <p className="text-sm text-muted-foreground">Promoter offers and support-band opportunities for your band.</p>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading offers...</div>
        ) : offers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Pending Promoter Offers</CardTitle>
              <CardDescription>Keep building your fame and promoters will start reaching out with gig opportunities.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          offers.map((offer) => {
            const expiresIn = Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const slotColor = {
              kids: 'secondary',
              opening: 'default',
              support: 'default',
              headline: 'destructive',
            }[offer.slot_type] || 'default';

            return (
              <Card key={offer.id} className="border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{offer.metadata?.venue_name || 'Venue'}</CardTitle>
                      <CardDescription>{offer.offer_reason}</CardDescription>
                    </div>
                    <Badge variant={slotColor as any}>{offer.slot_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{new Date(offer.offered_date).toLocaleDateString()}</span></div>
                    <div className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /><span>{offer.metadata?.promoter_name || 'Promoter'}</span></div>
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>Base: ${offer.base_payout}</span></div>
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>Tickets: ${offer.ticket_price}</span></div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleReject(offer.id)}>Decline</Button>
                      <Button size="sm" onClick={() => handleAccept(offer.id)}>Accept Gig</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <SupportMarketplacePanel bandId={bandId} />
      <SupportHistoryPanel bandId={bandId} />
    </div>
  );
}
