import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  DollarSign, 
  Calendar, 
  Disc3, 
  Album, 
  Percent, 
  Factory, 
  CheckCircle2, 
  XCircle,
  Music,
  Clock,
  AlertTriangle,
  FileText
} from "lucide-react";
import { format, addMonths, differenceInDays, differenceInHours } from "date-fns";

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
  expires_at?: string | null;
}

interface ContractOfferCardProps {
  offer: ContractOffer;
  entityName: string;
}

function getExpiryInfo(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysLeft = differenceInDays(expiry, now);
  const hoursLeft = differenceInHours(expiry, now);
  const isExpired = expiry <= now;
  const isUrgent = daysLeft <= 2 && !isExpired;

  return { daysLeft, hoursLeft, isExpired, isUrgent, expiry };
}

export function ContractOfferCard({ offer, entityName }: ContractOfferCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const expiryInfo = getExpiryInfo(offer.expires_at);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      // Band accepts → status becomes "accepted_by_artist"
      // The label must then activate it to make it "active"
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({
          status: "accepted_by_artist",
        })
        .eq("id", offer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Contract accepted!",
        description: `You've agreed to the terms from ${offer.label_name}. The label will finalize and activate the contract.`,
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

  const isExpired = expiryInfo?.isExpired;

  return (
    <Card className={`border-2 ${isExpired ? 'border-muted opacity-60' : expiryInfo?.isUrgent ? 'border-destructive/70 animate-pulse' : 'border-primary/50'} bg-gradient-to-br from-primary/5 to-transparent`}>
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
          <div className="flex flex-col items-end gap-1">
            {isExpired ? (
              <Badge variant="destructive">EXPIRED</Badge>
            ) : (
              <Badge variant="default" className="text-lg px-3 py-1">
                ACTION REQUIRED
              </Badge>
            )}
            {expiryInfo && !isExpired && (
              <div className={`flex items-center gap-1 text-xs ${expiryInfo.isUrgent ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                <Clock className="h-3 w-3" />
                {expiryInfo.daysLeft > 0 
                  ? `${expiryInfo.daysLeft} day${expiryInfo.daysLeft !== 1 ? 's' : ''} left to decide`
                  : `${expiryInfo.hoursLeft} hours left`}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Your Obligations Summary - Plain English */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Your Obligations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong>You must deliver</strong> {offer.single_quota} single{offer.single_quota !== 1 ? 's' : ''} 
              {offer.album_quota > 0 && ` and ${offer.album_quota} album${offer.album_quota !== 1 ? 's' : ''}`} within{' '}
              <strong>{offer.term_months} months</strong>.
            </p>
            <p>
              <strong>You'll receive</strong> ${offer.advance_amount.toLocaleString()} upfront as an advance.
              {offer.advance_amount > 0 && ' This must be recouped from royalties before you earn beyond your split.'}
            </p>
            <p>
              <strong>You keep</strong> {offer.royalty_artist_pct}% of royalties. The label takes {offer.royalty_label_pct}%.
            </p>
            {offer.manufacturing_covered && (
              <p><strong>Manufacturing costs</strong> are covered by the label.</p>
            )}
            {offer.termination_fee_pct > 0 && (
              <p className="text-muted-foreground text-xs">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Early termination costs {offer.termination_fee_pct}% of remaining contract value.
              </p>
            )}
          </CardContent>
        </Card>

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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1"
              disabled={rejectMutation.isPending || acceptMutation.isPending || isExpired}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to decline the contract offer from {offer.label_name}? 
                You can always submit another demo later, but this specific offer will be gone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Offer</AlertDialogCancel>
              <AlertDialogAction onClick={() => rejectMutation.mutate()}>
                Yes, Decline
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="flex-1"
              disabled={acceptMutation.isPending || rejectMutation.isPending || isExpired}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {acceptMutation.isPending ? "Accepting..." : "Accept Terms"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept these contract terms?</AlertDialogTitle>
              <AlertDialogDescription>
                You're agreeing to a {offer.term_months}-month deal with {offer.label_name}. 
                You'll need to deliver {offer.single_quota} single{offer.single_quota !== 1 ? 's' : ''}
                {offer.album_quota > 0 ? ` and ${offer.album_quota} album${offer.album_quota !== 1 ? 's' : ''}` : ''}.
                The label will finalize and activate the contract, at which point you'll receive your ${offer.advance_amount.toLocaleString()} advance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Review Again</AlertDialogCancel>
              <AlertDialogAction onClick={() => acceptMutation.mutate()}>
                Sign the Deal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}