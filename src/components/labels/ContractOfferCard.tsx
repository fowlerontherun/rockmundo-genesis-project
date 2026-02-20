import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  FileText,
  MessageSquare,
  TrendingDown
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";

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
  counter_count?: number;
  last_action_by?: string;
  original_advance?: number | null;
  original_royalty_pct?: number | null;
  original_single_quota?: number | null;
  original_album_quota?: number | null;
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

function calculateAcceptanceLikelihood(
  counterCount: number,
  counterOffer: { advance_amount: number; royalty_artist_pct: number; single_quota: number; album_quota: number },
  original: { advance: number; royalty_pct: number; single_quota: number; album_quota: number }
): number {
  // Base likelihood decreases with each counter round
  let likelihood = 75 - (counterCount * 20); // 75%, 55%, 35%

  // Factor in how aggressive the ask is
  if (original.advance > 0) {
    const advanceDelta = (counterOffer.advance_amount - original.advance) / original.advance;
    likelihood -= Math.max(0, advanceDelta * 30); // Asking for much more advance hurts
  }

  if (original.royalty_pct > 0) {
    const royaltyDelta = (counterOffer.royalty_artist_pct - original.royalty_pct) / original.royalty_pct;
    likelihood -= Math.max(0, royaltyDelta * 25);
  }

  // Lower quotas are favorable to the artist (less work), hurts likelihood
  if (original.single_quota > 0) {
    const quotaDelta = (original.single_quota - counterOffer.single_quota) / original.single_quota;
    likelihood -= Math.max(0, quotaDelta * 15);
  }

  return Math.max(5, Math.min(95, Math.round(likelihood)));
}

function getLikelihoodColor(likelihood: number): string {
  if (likelihood >= 60) return "bg-green-500";
  if (likelihood >= 30) return "bg-amber-500";
  return "bg-destructive";
}

function getLikelihoodLabel(likelihood: number): string {
  if (likelihood >= 60) return "Label likely to accept";
  if (likelihood >= 30) return "Getting risky";
  return "Label may walk away";
}

export function ContractOfferCard({ offer, entityName }: ContractOfferCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const expiryInfo = getExpiryInfo(offer.expires_at);
  const [showCounterDialog, setShowCounterDialog] = useState(false);
  const [counterOffer, setCounterOffer] = useState({
    advance_amount: offer.advance_amount,
    royalty_artist_pct: offer.royalty_artist_pct,
    single_quota: offer.single_quota,
    album_quota: offer.album_quota,
  });

  const counterCount = offer.counter_count ?? 0;
  const maxCounters = 3;
  const countersRemaining = maxCounters - counterCount;

  // Use originals if available, else current offer values are the originals
  const originals = {
    advance: offer.original_advance ?? offer.advance_amount,
    royalty_pct: offer.original_royalty_pct ?? offer.royalty_artist_pct,
    single_quota: offer.original_single_quota ?? offer.single_quota,
    album_quota: offer.original_album_quota ?? offer.album_quota,
  };

  const likelihood = calculateAcceptanceLikelihood(counterCount, counterOffer, originals);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["contract-offers"] });
    queryClient.invalidateQueries({ queryKey: ["label-contracts"] });
    queryClient.invalidateQueries({ queryKey: ["label-all-contracts"] });
    queryClient.invalidateQueries({ queryKey: ["demo-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
  };

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "accepted_by_artist" })
        .eq("id", offer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Contract accepted!",
        description: `You've agreed to the terms from ${offer.label_name}. The label will finalize and activate the contract.`,
      });
      invalidateAll();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to accept contract", description: error.message, variant: "destructive" });
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
      toast({ title: "Offer declined", description: "You can always submit another demo later." });
      invalidateAll();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject offer", description: error.message, variant: "destructive" });
    },
  });

  const counterOfferMutation = useMutation({
    mutationFn: async () => {
      const newCounterCount = counterCount + 1;

      // On first counter, store originals
      const updatePayload: Record<string, any> = {
        advance_amount: counterOffer.advance_amount,
        royalty_artist_pct: counterOffer.royalty_artist_pct,
        royalty_label_pct: 100 - counterOffer.royalty_artist_pct,
        single_quota: counterOffer.single_quota,
        album_quota: counterOffer.album_quota,
        status: "negotiating",
        counter_count: newCounterCount,
        last_action_by: "artist",
      };

      // Store originals on first counter
      if (counterCount === 0) {
        updatePayload.original_advance = offer.advance_amount;
        updatePayload.original_royalty_pct = offer.royalty_artist_pct;
        updatePayload.original_single_quota = offer.single_quota;
        updatePayload.original_album_quota = offer.album_quota;
      }

      const { error } = await supabase
        .from("artist_label_contracts")
        .update(updatePayload)
        .eq("id", offer.id);
      if (error) throw error;

      return newCounterCount;
    },
    onSuccess: async (newCounterCount) => {
      setShowCounterDialog(false);

      if (newCounterCount >= 3) {
        // 3rd counter — label auto-rejects
        toast({
          title: "Label walked away!",
          description: `${offer.label_name} rejected your counter-offer. You pushed too hard.`,
          variant: "destructive",
        });

        // Auto-reject after brief delay
        setTimeout(async () => {
          await supabase
            .from("artist_label_contracts")
            .update({ status: "rejected", last_action_by: "label" })
            .eq("id", offer.id);

          // Send inbox notification about rejection
          const { data: members } = await supabase
            .from("band_members")
            .select("user_id")
            .or(`band_id.eq.${offer.label_id}`)
            .limit(1);

          invalidateAll();
        }, 1500);
      } else {
        // Label auto-responds by meeting halfway
        toast({
          title: "Counter-offer sent!",
          description: `${offer.label_name} is reviewing your terms...`,
        });

        // Simulate label response after 2 seconds
        setTimeout(async () => {
          const origAdv = offer.original_advance ?? offer.advance_amount;
          const origRoy = offer.original_royalty_pct ?? offer.royalty_artist_pct;
          const origSingle = offer.original_single_quota ?? offer.single_quota;
          const origAlbum = offer.original_album_quota ?? offer.album_quota;

          // Label concedes 30-50% toward artist's ask (less each round)
          const concessionRate = newCounterCount === 1 ? 0.45 : 0.3;
          
          const labelAdvance = Math.round(origAdv + (counterOffer.advance_amount - origAdv) * concessionRate);
          const labelRoyalty = Math.round(origRoy + (counterOffer.royalty_artist_pct - origRoy) * concessionRate);
          const labelSingleQuota = Math.round(origSingle + (counterOffer.single_quota - origSingle) * concessionRate);
          const labelAlbumQuota = Math.round(origAlbum + (counterOffer.album_quota - origAlbum) * concessionRate);

          await supabase
            .from("artist_label_contracts")
            .update({
              advance_amount: labelAdvance,
              royalty_artist_pct: labelRoyalty,
              royalty_label_pct: 100 - labelRoyalty,
              single_quota: Math.max(1, labelSingleQuota),
              album_quota: Math.max(0, labelAlbumQuota),
              status: "offered",
              last_action_by: "label",
            })
            .eq("id", offer.id);

          toast({
            title: `${offer.label_name} countered!`,
            description: `They've revised their offer. ${countersRemaining - 1} counter${countersRemaining - 1 !== 1 ? 's' : ''} remaining before they walk away.`,
          });

          invalidateAll();
        }, 2500);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send counter-offer", description: error.message, variant: "destructive" });
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
              {counterCount > 0 ? `Revised Offer from ${offer.label_name}` : `Contract Offer from ${offer.label_name}`}
            </CardTitle>
            <CardDescription>
              For {entityName} · Based on demo: {offer.demo_song_title}
              {counterCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · Round {counterCount} of {maxCounters}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isExpired ? (
              <Badge variant="destructive">EXPIRED</Badge>
            ) : (
              <Badge variant="default" className="text-lg px-3 py-1">
                {counterCount > 0 ? "REVISED OFFER" : "ACTION REQUIRED"}
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
        {/* Counter Round Indicator */}
        {counterCount > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Negotiation Round {counterCount}/{maxCounters}
                </p>
                <p className="text-xs text-muted-foreground">
                  {countersRemaining > 0 
                    ? `${countersRemaining} counter-offer${countersRemaining !== 1 ? 's' : ''} remaining. The label revised their terms.`
                    : "Final offer — accept or reject."}
                </p>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: maxCounters }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${i < counterCount ? 'bg-amber-500' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Your Obligations Summary */}
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

            {/* Show changes from original if negotiating */}
            {counterCount > 0 && offer.original_advance != null && (
              <div className="mt-2 pt-2 border-t border-amber-500/20">
                <p className="text-xs font-medium text-amber-600 mb-1">Changes from original offer:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {offer.advance_amount !== offer.original_advance && (
                    <span>Advance: ${(offer.original_advance ?? 0).toLocaleString()} → ${offer.advance_amount.toLocaleString()}</span>
                  )}
                  {offer.royalty_artist_pct !== (offer.original_royalty_pct ?? 0) && (
                    <span>Royalty: {offer.original_royalty_pct}% → {offer.royalty_artist_pct}%</span>
                  )}
                  {offer.single_quota !== (offer.original_single_quota ?? 0) && (
                    <span>Singles: {offer.original_single_quota} → {offer.single_quota}</span>
                  )}
                  {offer.album_quota !== (offer.original_album_quota ?? 0) && (
                    <span>Albums: {offer.original_album_quota} → {offer.album_quota}</span>
                  )}
                </div>
              </div>
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
              <div className="font-semibold">{offer.royalty_artist_pct}% / {offer.royalty_label_pct}%</div>
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
              <div className="font-semibold">{offer.manufacturing_covered ? "Label Pays" : "Self-Funded"}</div>
            </div>
          </div>
        </div>

        {/* Contract Value Estimate */}
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Estimated Contract Value</span>
            <span className="text-lg font-bold text-green-600">${contractValue.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">Termination fee: {offer.termination_fee_pct}% of remaining value</p>
        </div>

        {/* Territories */}
        {offer.territories && offer.territories.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Territory Coverage</div>
            <div className="flex flex-wrap gap-1">
              {offer.territories.map((territory) => (
                <Badge key={territory} variant="secondary" className="text-xs">{territory}</Badge>
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

      <CardFooter className="flex gap-3 flex-wrap">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={rejectMutation.isPending || acceptMutation.isPending || isExpired}>
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
              <AlertDialogAction onClick={() => rejectMutation.mutate()}>Yes, Decline</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="secondary"
          className="flex-1"
          disabled={counterOfferMutation.isPending || isExpired || countersRemaining <= 0}
          onClick={() => setShowCounterDialog(true)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Counter-Offer {countersRemaining > 0 && `(${countersRemaining} left)`}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="flex-1" disabled={acceptMutation.isPending || rejectMutation.isPending || isExpired}>
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
              <AlertDialogAction onClick={() => acceptMutation.mutate()}>Sign the Deal</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>

      {/* Counter-Offer Dialog */}
      <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Counter-Offer to {offer.label_name}
            </DialogTitle>
            <DialogDescription>
              Propose different terms. {countersRemaining <= 1 
                ? "⚠️ This is your LAST counter — the label will walk away if you push again!" 
                : `You have ${countersRemaining} counter-offers remaining before the label walks away.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Acceptance Likelihood Bar */}
            <Card className="border-muted">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" />
                    Likelihood of Acceptance
                  </span>
                  <span className="font-bold">{likelihood}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getLikelihoodColor(likelihood)}`}
                    style={{ width: `${likelihood}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{getLikelihoodLabel(likelihood)}</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Advance Amount
              </Label>
              <Input
                type="number"
                value={counterOffer.advance_amount}
                onChange={(e) => setCounterOffer(prev => ({ ...prev, advance_amount: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Current: ${offer.advance_amount.toLocaleString()}
                {originals.advance !== offer.advance_amount && ` · Original: $${originals.advance.toLocaleString()}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" /> Your Royalty: {counterOffer.royalty_artist_pct}%
              </Label>
              <Slider
                value={[counterOffer.royalty_artist_pct]}
                onValueChange={([v]) => setCounterOffer(prev => ({ ...prev, royalty_artist_pct: v }))}
                min={10}
                max={90}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Label gets {100 - counterOffer.royalty_artist_pct}% (Current: {offer.royalty_artist_pct}% / {offer.royalty_label_pct}%)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Disc3 className="h-4 w-4" /> Single Quota
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={counterOffer.single_quota}
                  onChange={(e) => setCounterOffer(prev => ({ ...prev, single_quota: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Album className="h-4 w-4" /> Album Quota
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={counterOffer.album_quota}
                  onChange={(e) => setCounterOffer(prev => ({ ...prev, album_quota: Number(e.target.value) }))}
                />
              </div>
            </div>

            {countersRemaining <= 1 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium">
                  Warning: This is your final counter-offer. If you send this, the label WILL reject and walk away!
                </p>
              </div>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCounterDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => counterOfferMutation.mutate()}
                disabled={counterOfferMutation.isPending}
                variant={countersRemaining <= 1 ? "destructive" : "default"}
              >
                {counterOfferMutation.isPending ? "Sending..." : countersRemaining <= 1 ? "Send Final Counter" : "Send Counter-Offer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
