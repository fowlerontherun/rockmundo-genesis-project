import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, TrendingUp, Users, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Database } from "@/lib/supabase-types";

type VenueRow = Database['public']['Tables']['venues']['Row'];
type BandRow = Database['public']['Tables']['bands']['Row'];

interface Setlist {
  id: string;
  name: string;
  song_count: number;
}

interface GigBookingDialogProps {
  venue: VenueRow | null;
  band: BandRow;
  setlists: Setlist[];
  onConfirm: (setlistId: string, ticketPrice: number) => void;
  onClose: () => void;
  isBooking: boolean;
}

export const GigBookingDialog = ({
  venue,
  band,
  setlists,
  onConfirm,
  onClose,
  isBooking,
}: GigBookingDialogProps) => {
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>("");
  const [ticketPrice, setTicketPrice] = useState<number>(20);

  const validSetlists = setlists.filter((s) => s.song_count >= 6);

  const { estimatedAttendance, estimatedRevenue, suggestedPrice, priceRating } = useMemo(() => {
    if (!venue) return { estimatedAttendance: 0, estimatedRevenue: 0, suggestedPrice: 20, priceRating: "good" };

    const prestigeMultiplier = 1 + (venue.prestige_level || 1) * 0.15;
    const fameMultiplier = 1 + (band.fame || 0) / 1000;
    const popularityMultiplier = 1 + (band.popularity || 0) / 500;

    const baseAttendance = Math.min(
      venue.capacity || 100,
      ((band.fame || 0) * 2 + (band.popularity || 0) * 3)
    );

    const suggested = Math.round(10 + (venue.prestige_level || 1) * 5 + (band.fame || 0) / 100);

    let priceMultiplier = 1.0;
    let rating = "good";

    if (ticketPrice < suggested * 0.5) {
      priceMultiplier = 1.2;
      rating = "too-low";
    } else if (ticketPrice > suggested * 1.5) {
      priceMultiplier = 0.6;
      rating = "too-high";
    } else if (ticketPrice >= suggested * 0.8 && ticketPrice <= suggested * 1.2) {
      priceMultiplier = 1.0;
      rating = "perfect";
    } else {
      priceMultiplier = 0.9;
      rating = "good";
    }

    const attendance = Math.floor(
      baseAttendance * prestigeMultiplier * fameMultiplier * popularityMultiplier * priceMultiplier * (0.7 + Math.random() * 0.3)
    );

    const revenue = attendance * ticketPrice;

    return {
      estimatedAttendance: Math.max(0, Math.min(attendance, venue.capacity || 100)),
      estimatedRevenue: revenue,
      suggestedPrice: suggested,
      priceRating: rating,
    };
  }, [venue, band, ticketPrice]);

  const canBook = selectedSetlistId && ticketPrice > 0;

  const handleConfirm = () => {
    if (canBook) {
      onConfirm(selectedSetlistId, ticketPrice);
    }
  };

  if (!venue) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Book Gig at {venue.name}</DialogTitle>
          <DialogDescription>
            Configure your performance and set ticket prices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Venue Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{venue.location || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Capacity</p>
                  <p className="font-medium">{venue.capacity || "N/A"} people</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prestige Level</p>
                  <Badge>{venue.prestige_level || 1}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Payment</p>
                  <p className="font-medium">${venue.base_payment || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Setlist Selection */}
          <div className="space-y-2">
            <Label htmlFor="setlist">Select Setlist *</Label>
            <Select value={selectedSetlistId} onValueChange={setSelectedSetlistId}>
              <SelectTrigger id="setlist">
                <SelectValue placeholder="Choose a setlist..." />
              </SelectTrigger>
              <SelectContent>
                {validSetlists.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No valid setlists (minimum 6 songs required)
                  </div>
                ) : (
                  validSetlists.map((setlist) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      {setlist.name} ({setlist.song_count} songs)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!selectedSetlistId && validSetlists.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Select a setlist to continue
              </p>
            )}
            {validSetlists.length === 0 && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Create a setlist with at least 6 songs to book gigs
              </p>
            )}
          </div>

          <Separator />

          {/* Ticket Pricing */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="price">Ticket Price *</Label>
                <span className="text-sm text-muted-foreground">
                  Suggested: ${suggestedPrice}
                </span>
              </div>
              <Input
                id="price"
                type="number"
                min="1"
                max="1000"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className="flex items-center gap-2 text-sm">
                {priceRating === "perfect" && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Perfect pricing
                  </Badge>
                )}
                {priceRating === "good" && (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Good pricing
                  </Badge>
                )}
                {priceRating === "too-low" && (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Price too low - leaving money on table
                  </Badge>
                )}
                {priceRating === "too-high" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Price too high - may reduce attendance
                  </Badge>
                )}
              </div>
            </div>

            {/* Revenue Estimation */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revenue Forecast
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Estimated Attendance
                    </span>
                    <span className="font-bold text-lg">
                      {estimatedAttendance} / {venue.capacity}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ticket Revenue</span>
                    <span className="font-semibold">${estimatedRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Venue Payment</span>
                    <span className="font-semibold text-green-600">
                      +${(venue.base_payment || 0).toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Total Earnings</span>
                    <span className="font-bold text-primary">
                      ${(estimatedRevenue + (venue.base_payment || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  * Estimates based on band stats, venue prestige, and ticket pricing. Actual results may vary by ±20%.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBooking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canBook || isBooking}>
            {isBooking ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
