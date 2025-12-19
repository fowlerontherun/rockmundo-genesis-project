import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { 
  DollarSign, 
  Calendar, 
  Disc3, 
  Album, 
  Percent, 
  Factory, 
  CheckCircle2, 
  XCircle,
  Music
} from "lucide-react";
import { format, addMonths } from "date-fns";

interface ContractOffer {
  id: string;
  label_id: string;
  label_name: string;
  label_reputation: number;
  advance_amount: number;
  royalty_artist_pct: number;
  royalty_label_pct: number;
  single_quota: number;
  album_quota: number;
  term_months: number;
  termination_fee_pct: number;
  manufacturing_covered: boolean;
  territories: string[];
  demo_song_title: string;
  demo_song_quality: number;
  created_at: string;
}

interface ContractOfferCardProps {
  offer: ContractOffer;
  entityName: string;
}

export function ContractOfferCard({ offer, entityName }: ContractOfferCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const startDate = new Date();
      const endDate = addMonths(startDate, offer.term_months);

      const { error } = await supabase
        .from("artist_label_contracts")
        .update({
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        })
        .eq("id", offer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Contract accepted!",
        description: `You've signed with ${offer.label_name}. Time to make some music!`,
      });
      queryClient.invalidateQueries({ queryKey: ["contract-offers"] });
      queryClient.invalidateQueries({ queryKey: ["label-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["demo-submissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept contract",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "rejected" })
        .eq("id", offer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Offer declined",
        description: "You can always submit another demo later.",
      });
      queryClient.invalidateQueries({ queryKey: ["contract-offers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject offer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const contractValue = offer.advance_amount + 
    (offer.single_quota * 5000) + 
    (offer.album_quota * 25000);

  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Contract Offer from {offer.label_name}
            </CardTitle>
            <CardDescription>
              For {entityName} · Based on demo: {offer.demo_song_title}
            </CardDescription>
          </div>
          <Badge variant="default" className="text-lg px-3 py-1">
            NEW OFFER
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Terms Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <DollarSign className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-xs text-muted-foreground">Advance</div>
              <div className="font-semibold">${offer.advance_amount.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Percent className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-xs text-muted-foreground">Royalty Split</div>
              <div className="font-semibold">
                {offer.royalty_artist_pct}% / {offer.royalty_label_pct}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Calendar className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-xs text-muted-foreground">Term Length</div>
              <div className="font-semibold">{offer.term_months} months</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Disc3 className="h-5 w-5 text-orange-500" />
            <div>
              <div className="text-xs text-muted-foreground">Single Quota</div>
              <div className="font-semibold">{offer.single_quota} singles</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Album className="h-5 w-5 text-pink-500" />
            <div>
              <div className="text-xs text-muted-foreground">Album Quota</div>
              <div className="font-semibold">{offer.album_quota} albums</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Factory className="h-5 w-5 text-cyan-500" />
            <div>
              <div className="text-xs text-muted-foreground">Manufacturing</div>
              <div className="font-semibold">
                {offer.manufacturing_covered ? "Label Pays" : "Self-Funded"}
              </div>
            </div>
          </div>
        </div>

        {/* Contract Value Estimate */}
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Estimated Contract Value</span>
            <span className="text-lg font-bold text-green-600">
              ${contractValue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Termination fee: {offer.termination_fee_pct}% of remaining value
          </p>
        </div>

        {/* Territories */}
        {offer.territories && offer.territories.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Territory Coverage</div>
            <div className="flex flex-wrap gap-1">
              {offer.territories.map((territory) => (
                <Badge key={territory} variant="secondary" className="text-xs">
                  {territory}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Label Reputation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Label Reputation</span>
            <span className="font-medium">{offer.label_reputation}/100</span>
          </div>
          <Progress value={offer.label_reputation} />
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => rejectMutation.mutate()}
          disabled={rejectMutation.isPending || acceptMutation.isPending}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Decline
        </Button>
        <Button
          className="flex-1"
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending || rejectMutation.isPending}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {acceptMutation.isPending ? "Signing..." : "Accept Contract"}
        </Button>
      </CardFooter>
    </Card>
  );
}