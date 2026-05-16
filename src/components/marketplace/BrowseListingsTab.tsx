import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, DollarSign, TrendingUp, Clock, Package, Gift, PenLine } from "lucide-react";

interface BrowseListingsTabProps {
  userId: string;
}

type SourceFilter = "all" | "written" | "blind_box" | "gift";

const SOURCE_META: Record<Exclude<SourceFilter, "all">, { label: string; icon: any; className: string }> = {
  written: { label: "Original", icon: PenLine, className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  blind_box: { label: "Blind Box", icon: Package, className: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  gift: { label: "Gifted", icon: Gift, className: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
};

export const BrowseListingsTab = ({ userId }: BrowseListingsTabProps) => {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          songs (
            title,
            genre,
            quality_score,
            duration_display,
            acquisition_source,
            ownership_type
          )
        `)
        .eq("listing_status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!listings) return [];
    if (sourceFilter === "all") return listings;
    return listings.filter((l: any) => (l.songs?.acquisition_source ?? "written") === sourceFilter);
  }, [listings, sourceFilter]);

  if (isLoading) {
    return <div className="text-center py-8">Loading listings...</div>;
  }

  if (!listings || listings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No Listings Available</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later for songs to purchase
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Source filter */}
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-xs text-muted-foreground mr-1">Source:</span>
        {(["all", "written", "blind_box", "gift"] as SourceFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={sourceFilter === s ? "default" : "outline"}
            onClick={() => setSourceFilter(s)}
            className="text-xs h-7"
          >
            {s === "all" ? "All" : SOURCE_META[s].label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} listings</span>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((listing: any) => {
          const source = (listing.songs?.acquisition_source ?? "written") as keyof typeof SOURCE_META;
          const meta = SOURCE_META[source] ?? SOURCE_META.written;
          const Icon = meta.icon;
          return (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {listing.songs?.title || "Unknown Song"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {listing.songs?.genre}
                    </p>
                  </div>
                  <Music className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge>Quality: {listing.songs?.quality_score || 0}</Badge>
                  <Badge variant="outline">
                    {listing.listing_type === "fixed_price" ? "Fixed Price" :
                     listing.listing_type === "auction" ? "Auction" : "Negotiable"}
                  </Badge>
                  <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                    <Icon className="h-3 w-3" />{meta.label}
                  </Badge>
                </div>

                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {listing.listing_type === "auction" ? "Current Bid" : "Price"}
                    </span>
                    <span className="text-2xl font-bold text-primary flex items-center">
                      <DollarSign className="h-5 w-5" />
                      {(listing.current_bid || listing.asking_price).toLocaleString()}
                    </span>
                  </div>
                  {listing.royalty_percentage > 0 && (
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Seller keeps {listing.royalty_percentage}% royalties
                    </div>
                  )}
                </div>

                {listing.expires_at && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Ends {new Date(listing.expires_at).toLocaleDateString()}
                  </div>
                )}

                {listing.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {listing.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" size="sm">
                    {listing.listing_type === "auction" ? "Place Bid" : "Buy Now"}
                  </Button>
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
