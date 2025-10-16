import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { BrowseListingsTab } from "@/components/marketplace/BrowseListingsTab";
import { MyListingsTab } from "@/components/marketplace/MyListingsTab";
import { MyPurchasesTab } from "@/components/marketplace/MyPurchasesTab";
import { RoyaltiesTab } from "@/components/marketplace/RoyaltiesTab";

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
        <Button
          variant="ghost"
          onClick={() => navigate("/music")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Music Hub
        </Button>

        <div className="flex items-center gap-3">
          <ShoppingBag className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Song Marketplace</h1>
            <p className="text-muted-foreground">
              Buy, sell, and auction original songs from talented songwriters
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Listings</TabsTrigger>
          <TabsTrigger value="my-listings">My Listings</TabsTrigger>
          <TabsTrigger value="purchases">My Purchases</TabsTrigger>
          <TabsTrigger value="royalties">Royalties</TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          <BrowseListingsTab userId={userId} />
        </TabsContent>

        <TabsContent value="my-listings">
          <MyListingsTab userId={userId} />
        </TabsContent>

        <TabsContent value="purchases">
          <MyPurchasesTab userId={userId} />
        </TabsContent>

        <TabsContent value="royalties">
          <RoyaltiesTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
