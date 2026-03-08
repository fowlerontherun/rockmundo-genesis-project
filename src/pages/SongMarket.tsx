import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <PageLayout wide>
      <PageHeader
        title="Song Marketplace"
        subtitle="Buy, sell, and auction original songs. Purchased songs cannot be resold."
        icon={ShoppingBag}
        backTo="/hub/music"
        backLabel="Back to Music Hub"
        actions={<CreateListingTab userId={userId} />}
      />

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
