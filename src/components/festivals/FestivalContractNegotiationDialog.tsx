import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Percent, Package, Hotel, Car, AlertTriangle, Check } from "lucide-react";

interface FestivalContractNegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  festivalName: string;
  slotType: string;
  basePayment: number;
  onNegotiate: (terms: NegotiatedTerms) => void;
  isSubmitting?: boolean;
}

export interface NegotiatedTerms {
  offerId: string;
  counterPayment: number;
  merchCutPercent: number;
  requestBackstage: boolean;
  requestHotel: boolean;
  requestTransport: boolean;
  requestSoundcheck: boolean;
}

const SLOT_LEVERAGE: Record<string, number> = {
  headliner: 1.5,
  main: 1.25,
  support: 1.0,
  opening: 0.75,
};

export function FestivalContractNegotiationDialog({
  open,
  onOpenChange,
  offerId,
  festivalName,
  slotType,
  basePayment,
  onNegotiate,
  isSubmitting,
}: FestivalContractNegotiationDialogProps) {
  const leverage = SLOT_LEVERAGE[slotType] || 1.0;
  const maxPayment = Math.round(basePayment * leverage * 1.5);
  const minPayment = Math.round(basePayment * 0.8);

  const [counterPayment, setCounterPayment] = useState(basePayment);
  const [merchCutPercent, setMerchCutPercent] = useState(0);
  const [requestBackstage, setRequestBackstage] = useState(false);
  const [requestHotel, setRequestHotel] = useState(false);
  const [requestTransport, setRequestTransport] = useState(false);
  const [requestSoundcheck, setRequestSoundcheck] = useState(false);

  // Calculate acceptance probability based on demands
  const calculateAcceptanceProbability = () => {
    let probability = 90;

    // Payment demands reduce probability
    const paymentRatio = counterPayment / basePayment;
    if (paymentRatio > 1.0) {
      probability -= (paymentRatio - 1) * 30;
    }

    // Merch cut demands
    probability -= merchCutPercent * 1.5;

    // Perks reduce probability slightly
    if (requestBackstage) probability -= 5;
    if (requestHotel) probability -= 10;
    if (requestTransport) probability -= 8;
    if (requestSoundcheck) probability -= 3;

    // Leverage bonus
    probability += (leverage - 1) * 20;

    return Math.max(10, Math.min(95, Math.round(probability)));
  };

  const acceptanceProbability = calculateAcceptanceProbability();

  const handleSubmit = () => {
    onNegotiate({
      offerId,
      counterPayment,
      merchCutPercent,
      requestBackstage,
      requestHotel,
      requestTransport,
      requestSoundcheck,
    });
  };

  const totalPerksValue = 
    (requestBackstage ? 200 : 0) +
    (requestHotel ? 500 : 0) +
    (requestTransport ? 300 : 0) +
    (requestSoundcheck ? 100 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Negotiate Contract Terms</DialogTitle>
          <DialogDescription>
            Counter-offer for {festivalName} ({slotType} slot)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Acceptance Probability */}
          <Card className={acceptanceProbability < 50 ? "border-destructive/50" : "border-primary/50"}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Acceptance Probability</span>
                <div className="flex items-center gap-2">
                  {acceptanceProbability < 50 ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  <Badge variant={acceptanceProbability >= 70 ? "default" : acceptanceProbability >= 50 ? "secondary" : "destructive"}>
                    {acceptanceProbability}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Negotiation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Performance Payment
              </Label>
              <span className="font-bold text-lg">${counterPayment.toLocaleString()}</span>
            </div>
            <Slider
              value={[counterPayment]}
              onValueChange={([val]) => setCounterPayment(val)}
              min={minPayment}
              max={maxPayment}
              step={100}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${minPayment.toLocaleString()}</span>
              <span>Base: ${basePayment.toLocaleString()}</span>
              <span>${maxPayment.toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          {/* Merch Cut */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Merch Revenue Cut
              </Label>
              <span className="font-bold">{merchCutPercent}%</span>
            </div>
            <Slider
              value={[merchCutPercent]}
              onValueChange={([val]) => setMerchCutPercent(val)}
              min={0}
              max={30}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Request a percentage of your merch sales at the festival
            </p>
          </div>

          <Separator />

          {/* Perks */}
          <div className="space-y-4">
            <Label>Additional Perks</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Backstage Pass</span>
                </div>
                <Switch checked={requestBackstage} onCheckedChange={setRequestBackstage} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Hotel</span>
                </div>
                <Switch checked={requestHotel} onCheckedChange={setRequestHotel} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Transport</span>
                </div>
                <Switch checked={requestTransport} onCheckedChange={setRequestTransport} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">🎤</span>
                  <span className="text-sm">Soundcheck</span>
                </div>
                <Switch checked={requestSoundcheck} onCheckedChange={setRequestSoundcheck} />
              </div>
            </div>
          </div>

          {/* Summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-medium mb-2">Counter-Offer Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment</span>
                  <span className={counterPayment > basePayment ? "text-primary" : ""}>
                    ${counterPayment.toLocaleString()}
                    {counterPayment !== basePayment && (
                      <span className="text-xs ml-1">
                        ({counterPayment > basePayment ? "+" : ""}
                        {Math.round((counterPayment / basePayment - 1) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
                {merchCutPercent > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Merch Cut</span>
                    <span>{merchCutPercent}%</span>
                  </div>
                )}
                {totalPerksValue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perks Value</span>
                    <span>~${totalPerksValue}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total Value</span>
                  <span className="text-primary">
                    ${(counterPayment + totalPerksValue).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Counter-Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
