import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Music, DollarSign, Clock, Gavel, Tag } from "lucide-react";
import { useSongAuctions } from "@/hooks/useSongAuctions";
import { formatTimeRemaining } from "@/utils/songMarketplace";
import { cn } from "@/lib/utils";

interface CreateListingTabProps {
  userId: string;
}

export const CreateListingTab = ({ userId }: CreateListingTabProps) => {
  const { sellableSongs, sellableLoading, createListing } = useSongAuctions(userId);
  const [open, setOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [listingType, setListingType] = useState<"fixed_price" | "auction">("auction");
  const [askingPrice, setAskingPrice] = useState(1000);
  const [buyoutPrice, setBuyoutPrice] = useState(0);
  const [durationDays, setDurationDays] = useState(3);
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!selectedSongId || askingPrice <= 0) return;
    createListing.mutate({
      songId: selectedSongId,
      listingType,
      askingPrice,
      buyoutPrice: listingType === "auction" && buyoutPrice > 0 ? buyoutPrice : undefined,
      durationDays,
      description: description || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setSelectedSongId("");
        setAskingPrice(1000);
        setBuyoutPrice(0);
        setDescription("");
      },
    });
  };

  const selectedSong = sellableSongs.find(s => s.id === selectedSongId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          List a Song
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>List a Song for Sale</DialogTitle>
          <DialogDescription>
            Choose a song and set your price. A 10% marketplace fee applies on sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Song Selection */}
          <div className="space-y-2">
            <Label>Song *</Label>
            <Select value={selectedSongId} onValueChange={setSelectedSongId}>
              <SelectTrigger>
                <SelectValue placeholder={sellableLoading ? "Loading songs..." : "Select a song..."} />
              </SelectTrigger>
              <SelectContent>
                {sellableSongs.map(song => (
                  <SelectItem key={song.id} value={song.id}>
                    <span className="flex items-center gap-2">
                      <Music className="h-3 w-3" />
                      {song.title}
                      <Badge variant="outline" className="text-xs">{song.genre}</Badge>
                      <Badge variant="secondary" className="text-xs">Q: {song.quality_score}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sellableSongs.length === 0 && !sellableLoading && (
              <p className="text-sm text-muted-foreground">
                No eligible songs. Only unrecorded draft songs that haven't been added to a setlist or rehearsed can be sold.
              </p>
            )}
          </div>

          {/* Listing Type */}
          <div className="space-y-2">
            <Label>Listing Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={listingType === "auction" ? "default" : "outline"}
                onClick={() => setListingType("auction")}
                className="gap-2"
                type="button"
              >
                <Gavel className="h-4 w-4" />
                Auction
              </Button>
              <Button
                variant={listingType === "fixed_price" ? "default" : "outline"}
                onClick={() => setListingType("fixed_price")}
                className="gap-2"
                type="button"
              >
                <Tag className="h-4 w-4" />
                Fixed Price
              </Button>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label>{listingType === "auction" ? "Starting Bid *" : "Price *"}</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={100}
                value={askingPrice}
                onChange={(e) => setAskingPrice(Math.max(100, parseInt(e.target.value) || 100))}
                className="pl-9"
              />
            </div>
          </div>

          {/* Buyout Price (auction only) */}
          {listingType === "auction" && (
            <div className="space-y-2">
              <Label>Buy Now Price (optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={buyoutPrice}
                  onChange={(e) => setBuyoutPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="pl-9"
                  placeholder="0 = no buyout"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Set a price for instant purchase. Leave at 0 for bid-only.
              </p>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label>Listing Duration</Label>
            <Select value={String(durationDays)} onValueChange={(v) => setDurationDays(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your song to attract buyers..."
              rows={2}
            />
          </div>

          {/* Fee notice */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Marketplace Fee</span>
              <span>10%</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>You receive (min)</span>
              <span className="text-success">${Math.round(askingPrice * 0.9).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedSongId || askingPrice <= 0 || createListing.isPending}
          >
            {createListing.isPending ? "Listing..." : "Create Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
