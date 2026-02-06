import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { BrowseAuctionsTab } from "@/components/marketplace/BrowseAuctionsTab";
import { MyAuctionListingsTab } from "@/components/marketplace/MyAuctionListingsTab";
import { PurchasedSongsTab } from "@/components/marketplace/PurchasedSongsTab";
import { CreateListingTab } from "@/components/marketplace/CreateListingTab";

export default function SongMarket() {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const userId = profile?.user_id;

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access the marketplace.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-4 mb-8">
        <Button variant="ghost" onClick={() => navigate("/music")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Music Hub
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold">Song Marketplace</h1>
              <p className="text-muted-foreground">
                Buy, sell, and auction original songs. Purchased songs cannot be resold.
              </p>
            </div>
          </div>
          <CreateListingTab userId={userId} />
        </div>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse">Browse Auctions</TabsTrigger>
          <TabsTrigger value="my-listings">My Listings</TabsTrigger>
          <TabsTrigger value="purchased">Purchased Songs</TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          <BrowseAuctionsTab userId={userId} />
        </TabsContent>

        <TabsContent value="my-listings">
          <MyAuctionListingsTab userId={userId} />
        </TabsContent>

        <TabsContent value="purchased">
          <PurchasedSongsTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
