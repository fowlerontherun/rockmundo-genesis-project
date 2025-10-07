import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, TrendingUp, DollarSign, Gift } from "lucide-react";

export default function SongMarket() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎵 Song Marketplace</h1>
        <p className="text-muted-foreground">
          Buy, sell, and auction original songs from talented songwriters
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Listings</TabsTrigger>
          <TabsTrigger value="my-listings">My Listings</TabsTrigger>
          <TabsTrigger value="purchases">My Purchases</TabsTrigger>
          <TabsTrigger value="royalties">Royalties</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <Card className="p-6">
            <div className="flex gap-4 mb-6">
              <Input
                placeholder="Search songs by title, genre, or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button>Search</Button>
            </div>

            <div className="grid gap-4">
              <Card className="p-4 bg-muted/50">
                <div className="text-center text-muted-foreground py-12">
                  <Music className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No listings available yet</p>
                  <p className="text-sm mt-2">Be the first to list a song for sale!</p>
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="my-listings" className="space-y-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">My Active Listings</h2>
              <Button>
                <Music className="mr-2 h-4 w-4" />
                List New Song
              </Button>
            </div>

            <div className="text-center text-muted-foreground py-12">
              <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>You haven't listed any songs yet</p>
              <p className="text-sm mt-2">Complete a song and list it for sale or auction</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">Songs I've Purchased</h2>

            <div className="text-center text-muted-foreground py-12">
              <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>You haven't purchased any songs yet</p>
              <p className="text-sm mt-2">Browse the marketplace to find your next hit!</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="royalties" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">Streaming Royalties</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Earn 10% of streaming revenue from songs you've sold
            </p>

            <div className="text-center text-muted-foreground py-12">
              <Gift className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No sold songs tracking streams yet</p>
              <p className="text-sm mt-2">Your royalty earnings will appear here</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
