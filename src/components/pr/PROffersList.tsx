import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tv,
  Radio,
  Mic2,
  Newspaper,
  BookOpen,
  Youtube,
  Film,
  Globe,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

interface PROffersListProps {
  bandId: string;
  bandFame: number;
}

const mediaTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  tv: { icon: Tv, label: "TV", color: "text-blue-500" },
  radio: { icon: Radio, label: "Radio", color: "text-amber-500" },
  podcast: { icon: Mic2, label: "Podcast", color: "text-purple-500" },
  newspaper: { icon: Newspaper, label: "Newspaper", color: "text-gray-500" },
  magazine: { icon: BookOpen, label: "Magazine", color: "text-pink-500" },
  youtube: { icon: Youtube, label: "YouTube", color: "text-red-500" },
  film: { icon: Film, label: "Film", color: "text-amber-600" },
  website: { icon: Globe, label: "Website", color: "text-cyan-500" },
};

const offerTypeLabels: Record<string, string> = {
  general_promo: "General Promotion",
  tour_promo: "Tour Promotion",
  release_promo: "Release Promotion",
  personal_promo: "Personal Promotion",
};

function getOfferDateTime(offer: any): Date | null {
  if (!offer?.proposed_date) return null;
  const timeSlot = /^\d{2}:\d{2}$/.test(offer.time_slot || "") ? offer.time_slot : "10:00";
  const parsed = parseISO(`${offer.proposed_date}T${timeSlot}:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function PROffersList({ bandId, bandFame }: PROffersListProps) {
  const queryClient = useQueryClient();

  const { data: offers, isLoading } = useQuery({
    queryKey: ["pr-offers", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pr_media_offers")
        .select("*")
        .eq("band_id", bandId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("proposed_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
    staleTime: 2 * 60 * 1000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ offerId, action }: { offerId: string; action: "accept" | "decline" }) => {
      const { data, error } = await supabase.functions.invoke("respond-pr-offer", {
        body: { offerId, action },
      });
      if (error) {
        throw new Error(
          await getEdgeFunctionErrorMessage(error, "This PR offer could not be processed."),
        );
      }
      if (!data?.success) throw new Error(data?.message || "This PR offer could not be processed.");
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pr-offers", bandId] });
      queryClient.invalidateQueries({ queryKey: ["pr-stats", bandId] });
      queryClient.invalidateQueries({ queryKey: ["pr-appearances", bandId] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      
      if (variables.action === "accept") {
        const scheduledFor = data?.scheduledFor ? new Date(data.scheduledFor) : null;
        toast.success("Offer accepted!", {
          description: scheduledFor && !Number.isNaN(scheduledFor.getTime())
            ? `Scheduled for ${format(scheduledFor, "MMM d, yyyy 'at' HH:mm 'UTC'")}`
            : "The appearance has been added to the band's schedule.",
        });
      } else {
        toast.info("Offer declined");
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to process offer", { description: error.message });
    },
  });

  const getOutletName = (offer: any): string => {
    return offer.outlet_name || offer.show_name || `${offer.media_type?.toUpperCase() || 'Media'} Outlet`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Tv className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No PR Offers</h3>
          <p className="text-sm text-muted-foreground">
            PR offers are generated based on your band's fame. Keep performing to attract more media attention!
          </p>
          <Badge variant="secondary" className="mt-4">
            Current Fame: {bandFame.toLocaleString()}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {offers.map((offer) => {
          const config = mediaTypeConfig[offer.media_type] || mediaTypeConfig.tv;
          const Icon = config.icon;
          const outletName = getOutletName(offer);
          const expiresAt = offer.expires_at ? parseISO(offer.expires_at) : null;
          const proposedDateTime = getOfferDateTime(offer);

          return (
            <Card key={offer.id} className="bg-card/80 backdrop-blur transition-all hover:bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className={`rounded-lg bg-muted p-2 ${config.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{outletName}</h3>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {offerTypeLabels[offer.offer_type] || offer.offer_type}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {proposedDateTime && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(proposedDateTime, "MMM d, yyyy 'at' HH:mm 'UTC'")}
                          </span>
                        )}
                        {expiresAt && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Clock className="h-3 w-3" />
                            Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      {offer.compensation > 0 && (
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                          <DollarSign className="mr-1 h-3 w-3" />
                          ${offer.compensation.toLocaleString()}
                        </Badge>
                      )}
                      {offer.fame_boost > 0 && (
                        <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          +{offer.fame_boost.toLocaleString()} Fame
                        </Badge>
                      )}
                      {offer.fan_boost > 0 && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                          <Users className="mr-1 h-3 w-3" />
                          +{offer.fan_boost.toLocaleString()} Fans
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondMutation.mutate({ offerId: offer.id, action: "decline" })}
                        disabled={respondMutation.isPending}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => respondMutation.mutate({ offerId: offer.id, action: "accept" })}
                        disabled={respondMutation.isPending}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
