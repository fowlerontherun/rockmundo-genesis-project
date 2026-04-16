import { Crown, Lock, Wine, Clock, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVipPackages, useActiveVipBooking, useBookVip, meetsMinTier, type VipPackage } from "@/hooks/useNightclubVip";
import { useClubReputation } from "@/hooks/useClubReputation";

interface VipLoungeSectionProps {
  clubId: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const VipLoungeSection = ({ clubId }: VipLoungeSectionProps) => {
  const { data: packages = [], isLoading } = useVipPackages(clubId);
  const { data: activeBooking } = useActiveVipBooking(clubId);
  const { data: reputation } = useClubReputation(clubId);
  const bookVip = useBookVip();

  if (isLoading || packages.length === 0) return null;

  const playerTier = reputation?.reputation_tier ?? "newcomer";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5 text-yellow-400" /> VIP Lounge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active Booking Banner */}
        {activeBooking && (
          <div className="rounded-lg border-2 border-yellow-400/50 bg-yellow-400/5 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">VIP Active</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Expires {new Date(activeBooking.expires_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Packages */}
        {packages.map((pkg) => {
          const unlocked = meetsMinTier(playerTier, pkg.min_reputation_tier);
          const isActive = activeBooking?.package_id === pkg.id;

          return (
            <div
              key={pkg.id}
              className={`rounded-lg border p-3 space-y-2 ${
                isActive ? "border-yellow-400/50 bg-yellow-400/5" :
                !unlocked ? "border-border/40 opacity-60" :
                "border-border/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!unlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="font-medium text-sm">{pkg.package_name}</span>
                  <span className="text-sm font-bold text-primary">{currencyFormatter.format(pkg.price)}</span>
                </div>
                {isActive ? (
                  <Badge className="text-[10px] bg-yellow-400/20 text-yellow-400 border-yellow-400/30">
                    <Check className="h-2.5 w-2.5 mr-0.5" /> Active
                  </Badge>
                ) : !unlocked ? (
                  <Badge variant="outline" className="text-[10px]">
                    Requires {pkg.min_reputation_tier}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bookVip.isPending || !!activeBooking}
                    onClick={() => bookVip.mutate({ clubId, pkg })}
                  >
                    {bookVip.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Book"}
                  </Button>
                )}
              </div>

              {/* Perks */}
              <div className="flex flex-wrap gap-1">
                {pkg.perks.skip_cover && (
                  <Badge variant="secondary" className="text-[10px]">Skip Cover</Badge>
                )}
                {pkg.perks.free_drinks && (
                  <Badge variant="secondary" className="text-[10px]">{pkg.perks.free_drinks} Free Drinks</Badge>
                )}
                {pkg.perks.fame_boost_pct && (
                  <Badge variant="secondary" className="text-[10px] text-yellow-400">+{pkg.perks.fame_boost_pct}% Fame</Badge>
                )}
                {pkg.perks.drink_discount_pct && (
                  <Badge variant="secondary" className="text-[10px]">{pkg.perks.drink_discount_pct}% Drink Discount</Badge>
                )}
                {pkg.perks.exclusive_npc_access && (
                  <Badge variant="secondary" className="text-[10px]">Exclusive NPC Access</Badge>
                )}
              </div>

              <div className="text-[10px] text-muted-foreground">
                Up to {pkg.max_guests} guests • Lasts 24 game hours
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
