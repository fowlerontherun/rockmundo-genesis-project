import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Tables } from "@/lib/supabase-types";
import { useAuth } from "@/hooks/use-auth-context";
import {
  fetchAcceptedFriendsForProfile,
  fetchPrimaryProfileForUser,
  type AcceptedFriendProfile,
} from "@/integrations/supabase/friends";
import {
  acknowledgeInventoryTransfer,
  extractInventorySummary,
  fetchInventoryTransfersForProfile,
  transferInventoryItems,
  type InventoryTransferWithRelations,
} from "@/integrations/supabase/inventory";
import { supabase } from "@/integrations/supabase/client";

type SkillBookRow = Tables<"skill_books">;
type PlayerSkillBookRow = Tables<"player_skill_books">;

const InventoryManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [bookInventory, setBookInventory] = useState<
    (PlayerSkillBookRow & { skill_books: SkillBookRow | null })[]
  >([]);
  const [isBookInventorySupported, setIsBookInventorySupported] = useState(true);
  const [friends, setFriends] = useState<AcceptedFriendProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isTransferringItems, setIsTransferringItems] = useState(false);
  const [transfers, setTransfers] = useState<InventoryTransferWithRelations[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(false);
  const [acknowledgingTransfers, setAcknowledgingTransfers] = useState<Record<string, boolean>>({});
  const [salePrice, setSalePrice] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.partnerProfileId === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );
  const selectedBooks = useMemo(
    () => bookInventory.filter((entry) => selectedItems.has(entry.id)),
    [bookInventory, selectedItems],
  );
  const incomingTransfers = useMemo(
    () =>
      transfers.filter(
        (transfer) => profileId && transfer.recipient_profile_id === profileId,
      ),
    [profileId, transfers],
  );
  const outgoingTransfers = useMemo(
    () =>
      transfers.filter(
        (transfer) => profileId && transfer.sender_profile_id === profileId,
      ),
    [profileId, transfers],
  );

  const loadBookInventory = useCallback(
    async (currentProfileId: string) => {
      setIsLoadingBooks(true);
      setIsBookInventorySupported(true);
      try {
        const { data, error } = await supabase
          .from("player_skill_books")
          .select("*, skill_books:skill_books(*)")
          .eq("profile_id", currentProfileId)
          .order("acquired_at", { ascending: false });

        if (error) {
          if (typeof error === "object" && error && "code" in error && error.code === "PGRST205") {
            console.info("Book inventory table is not available yet; falling back to empty inventory.");
            setIsBookInventorySupported(false);
            setBookInventory([]);
            return;
          }
          throw error;
        }

        setIsBookInventorySupported(true);
        setBookInventory((data as (PlayerSkillBookRow & { skill_books: SkillBookRow | null })[] | null) ?? []);
      } catch (error) {
        console.error("Failed to load book inventory", error);
        toast({
          variant: "destructive",
          title: "Unable to load books",
          description: "We could not retrieve your book inventory. Please try again later.",
        });
      } finally {
        setIsLoadingBooks(false);
      }
    },
    [toast],
  );

  const loadFriends = useCallback(
    async (currentProfileId: string) => {
      setIsLoadingFriends(true);
      try {
        const friendRows = await fetchAcceptedFriendsForProfile(currentProfileId);
        setFriends(friendRows);
      } catch (error) {
        console.error("Failed to load friends", error);
        toast({
          variant: "destructive",
          title: "Unable to load friends",
          description: "We couldn't retrieve your Rockmundo friends. Please try again soon.",
        });
      } finally {
        setIsLoadingFriends(false);
      }
    },
    [toast],
  );

  const loadTransfers = useCallback(
    async (currentProfileId: string) => {
      setIsLoadingTransfers(true);
      try {
        const transferRows = await fetchInventoryTransfersForProfile(currentProfileId);
        setTransfers(transferRows);
      } catch (error) {
        console.error("Failed to load inventory transfers", error);
        toast({
          variant: "destructive",
          title: "Unable to load trades",
          description: "We couldn't sync your trade history. Please try again later.",
        });
      } finally {
        setIsLoadingTransfers(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!user) {
      setProfileId(null);
      setBookInventory([]);
      setIsBookInventorySupported(true);
      setFriends([]);
      setTransfers([]);
      setSelectedItems(new Set());
      setSelectedFriendId("");
      return;
    }

    let isCurrent = true;
    setIsLoadingProfile(true);

    const fetchProfile = async () => {
      try {
        const profile = await fetchPrimaryProfileForUser(user.id);
        if (!isCurrent) return;
        setProfileId(profile?.id ?? null);
        if (profile?.id) {
          await Promise.all([
            loadBookInventory(profile.id),
            loadFriends(profile.id),
            loadTransfers(profile.id),
          ]);
        }
      } catch (error) {
        console.error("Failed to load active profile", error);
        if (isCurrent) {
          toast({
            variant: "destructive",
            title: "Unable to load your character",
            description: "Create a character to start tracking inventory.",
          });
        }
        setProfileId(null);
      } finally {
        if (isCurrent) {
          setIsLoadingProfile(false);
        }
      }
    };

    void fetchProfile();

    return () => {
      isCurrent = false;
    };
  }, [loadBookInventory, loadFriends, loadTransfers, toast, user]);

  useEffect(() => {
    if (!profileId) {
      setBookInventory([]);
      setFriends([]);
      setTransfers([]);
      setSelectedItems(new Set());
      setSelectedFriendId("");
      return;
    }

    void loadBookInventory(profileId);
    void loadFriends(profileId);
    void loadTransfers(profileId);
  }, [loadBookInventory, loadFriends, loadTransfers, profileId]);

  useEffect(() => {
    if (!selectedFriendId && friends.length > 0) {
      setSelectedFriendId(friends[0].partnerProfileId);
    } else if (friends.length === 0 && selectedFriendId) {
      setSelectedFriendId("");
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    setSelectedItems((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validIds = new Set(bookInventory.map((entry) => entry.id));
      const updated = new Set<string>();

      previous.forEach((id) => {
        if (validIds.has(id)) {
          updated.add(id);
        }
      });

      if (updated.size === previous.size) {
        return previous;
      }

      return updated;
    });
  }, [bookInventory]);

  const toggleItemSelection = useCallback((itemId: string, isChecked: boolean | string) => {
    setSelectedItems((previous) => {
      const updated = new Set(previous);
      if (isChecked === true) {
        updated.add(itemId);
      } else {
        updated.delete(itemId);
      }
      return updated;
    });
  }, []);

  const handleSendSelectedItems = useCallback(async () => {
    if (!profileId) {
      return;
    }

    if (!selectedFriendId) {
      toast({
        title: "Choose a friend",
        description: "Select a friend to send your items to before starting a transfer.",
      });
      return;
    }

    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Pick at least one item from your library to trade.",
      });
      return;
    }

    setIsTransferringItems(true);
    const friendName =
      selectedFriend?.partnerProfile?.display_name ??
      selectedFriend?.partnerProfile?.username ??
      "your friend";

    try {
      const itemIds = Array.from(selectedItems);
      const transferredIds = await transferInventoryItems({
        senderProfileId: profileId,
        recipientProfileId: selectedFriendId,
        itemIds,
      });

      setSelectedItems(new Set());
      await Promise.all([loadBookInventory(profileId), loadTransfers(profileId)]);

      toast({
        title: "Items sent",
        description: `Delivered ${transferredIds.length} item${transferredIds.length === 1 ? "" : "s"} to ${friendName}.`,
      });
    } catch (error) {
      console.error("Failed to transfer inventory", error);
      toast({
        variant: "destructive",
        title: "Transfer failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't send your items. Please try again in a moment.",
      });
    } finally {
      setIsTransferringItems(false);
    }
  }, [
    loadBookInventory,
    loadTransfers,
    profileId,
    selectedFriend,
    selectedFriendId,
    selectedItems,
    toast,
  ]);

  const handleAcknowledgeTransfer = useCallback(
    async (transferId: string) => {
      if (!profileId) {
        return;
      }

      const targetTransfer = transfers.find((transfer) => transfer.id === transferId) ?? null;
      setAcknowledgingTransfers((previous) => ({ ...previous, [transferId]: true }));

      try {
        await acknowledgeInventoryTransfer(transferId, profileId);
        await Promise.all([loadTransfers(profileId), loadBookInventory(profileId)]);

        toast({
          title: "Transfer acknowledged",
          description: targetTransfer
            ? `Marked ${extractInventorySummary(targetTransfer)} as received.`
            : "Transfer marked as received.",
        });
      } catch (error) {
        console.error("Failed to acknowledge transfer", error);
        toast({
          variant: "destructive",
          title: "Unable to acknowledge",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't update the transfer. Please try again later.",
        });
      } finally {
        setAcknowledgingTransfers((previous) => {
          const updated = { ...previous };
          delete updated[transferId];
          return updated;
        });
      }
    },
    [loadBookInventory, loadTransfers, profileId, toast, transfers],
  );

  const handleShareListing = useCallback(() => {
    if (selectedBooks.length === 0) {
      toast({
        title: "Highlight at least one item",
        description: "Select the books you want to feature in your listing before sharing it.",
      });
      return;
    }

    if (!selectedFriend) {
      toast({
        title: "Choose a friend",
        description: "Pick a friend to receive your marketplace listing.",
      });
      return;
    }

    const priceValue = Number.parseFloat(salePrice);

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      toast({
        title: "Enter a valid price",
        description: "Set a positive price so your friend knows what you're asking for.",
      });
      return;
    }

    const friendName =
      selectedFriend.partnerProfile?.display_name ??
      selectedFriend.partnerProfile?.username ??
      "your friend";

    toast({
      title: "Listing shared",
      description: `We'll ping ${friendName} about ${selectedBooks.length} item${
        selectedBooks.length === 1 ? "" : "s"
      } for ${priceValue.toLocaleString()} credits${
        saleNotes ? " with your note attached." : "."
      }`,
    });

    setSalePrice("");
    setSaleNotes("");
  }, [selectedBooks, selectedFriend, saleNotes, salePrice, toast]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Manager</h1>
        <p className="text-muted-foreground">Manage your equipment, wardrobe, and learning resources.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory System Preview</CardTitle>
          <CardDescription>
            Equipment and wardrobe management tools are in development. Track your education books below while we finish the rest of
            the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Future updates will introduce equipment loadouts, wardrobe customization, and detailed inventory analytics. Stay tuned!
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Book Library</CardTitle>
          <CardDescription>Review the education books you've purchased and their completion status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to view your book inventory.</p>
          ) : isLoadingProfile ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your character...
            </div>
          ) : !profileId ? (
            <p className="text-sm text-muted-foreground">Create a character profile to start collecting books.</p>
          ) : !isBookInventorySupported ? (
            <p className="text-sm text-muted-foreground">
              Book tracking is being rolled out. Check back soon to see your purchased education books here.
            </p>
          ) : isLoadingBooks ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading books...
            </div>
          ) : bookInventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven't purchased any books yet. Visit the Education hub to unlock new skills.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-sm text-muted-foreground">
                <span>
                  Select books to include in trades or marketplace listings.{" "}
                  {selectedItems.size > 0
                    ? `${selectedItems.size} item${selectedItems.size === 1 ? "" : "s"} ready to send.`
                    : "No items selected yet."}
                </span>
              </div>
              {bookInventory.map((entry) => {
                const book = entry.skill_books;
                const checkboxId = `book-${entry.id}`;
                return (
                  <div key={entry.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <Checkbox
                          id={checkboxId}
                          checked={selectedItems.has(entry.id)}
                          onCheckedChange={(checked) => toggleItemSelection(entry.id, checked)}
                        />
                        <Label htmlFor={checkboxId} className="sr-only">
                          Select {book?.title ?? "book"}
                        </Label>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{book?.title ?? "Unknown Book"}</p>
                            {book?.author ? <p className="text-xs text-muted-foreground">by {book.author}</p> : null}
                          </div>
                          <Badge variant={entry.xp_awarded_at ? "default" : "secondary"}>
                            {entry.xp_awarded_at ? "Completed" : "Owned"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {book?.skill_slug ? <Badge variant="outline">{book.skill_slug}</Badge> : null}
                          {book?.xp_reward ? <Badge variant="outline">+{book.xp_reward} XP</Badge> : null}
                          {entry.acquired_at ? (
                            <Badge variant="outline">
                              Purchased {new Date(entry.acquired_at).toLocaleDateString()}
                            </Badge>
                          ) : null}
                        </div>
                        {entry.consumed_at ? (
                          <p className="text-xs text-muted-foreground">
                            Completed on {new Date(entry.consumed_at).toLocaleDateString()} and XP applied.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Friend Trading Hub</CardTitle>
          <CardDescription>
            Send selected items to friends, confirm incoming deliveries, and share marketplace listings for quick trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Choose a friend</h3>
              {isLoadingFriends ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Syncing friends…
                </div>
              ) : null}
            </div>
            {!user ? (
              <p className="text-sm text-muted-foreground">Sign in to manage trades with your friends.</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add friends from the social hub to start sharing books and other inventory items.
              </p>
            ) : (
              <RadioGroup
                value={selectedFriendId}
                onValueChange={setSelectedFriendId}
                className="grid gap-3 md:grid-cols-2"
              >
                {friends.map((friend) => {
                  const displayName =
                    friend.partnerProfile?.display_name ?? friend.partnerProfile?.username ?? "Rockmundo friend";
                  const level = friend.partnerProfile?.level;
                  return (
                    <div
                      key={friend.friendshipId}
                      className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <RadioGroupItem value={friend.partnerProfileId} id={`friend-${friend.partnerProfileId}`} />
                      <Label htmlFor={`friend-${friend.partnerProfileId}`} className="flex-1 cursor-pointer space-y-1">
                        <p className="text-sm font-semibold">{displayName}</p>
                        {friend.partnerProfile?.bio ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {friend.partnerProfile.bio}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Level {level ?? "—"} · Fame {friend.partnerProfile?.fame ?? "—"}
                        </p>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleSendSelectedItems()}
              disabled={!profileId || !selectedFriendId || selectedItems.size === 0 || isTransferringItems}
            >
              {isTransferringItems ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending items…
                </span>
              ) : (
                `Send ${selectedItems.size || "0"} item${selectedItems.size === 1 ? "" : "s"}`
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              {selectedItems.size > 0
                ? `${selectedItems.size} item${selectedItems.size === 1 ? "" : "s"} queued for transfer.`
                : "Select items from your library to trade."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">Incoming transfers</h3>
                {isLoadingTransfers ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
                  </div>
                ) : null}
              </div>
              {incomingTransfers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No new deliveries waiting for acknowledgement.</p>
              ) : (
                <div className="space-y-3">
                  {incomingTransfers.map((transfer) => {
                    const senderName =
                      transfer.sender_profile?.display_name ??
                      transfer.sender_profile?.username ??
                      "Unknown sender";
                    const createdAt = transfer.created_at
                      ? new Date(transfer.created_at).toLocaleString()
                      : null;
                    const isPending = transfer.status === "completed";
                    return (
                      <div key={transfer.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {extractInventorySummary(transfer)}
                            </p>
                            <p className="text-xs text-muted-foreground">From {senderName}</p>
                            {createdAt ? (
                              <p className="text-[11px] text-muted-foreground">Sent {createdAt}</p>
                            ) : null}
                          </div>
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => void handleAcknowledgeTransfer(transfer.id)}
                              disabled={Boolean(acknowledgingTransfers[transfer.id])}
                            >
                              {acknowledgingTransfers[transfer.id] ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Working…
                                </span>
                              ) : (
                                "Acknowledge"
                              )}
                            </Button>
                          ) : (
                            <Badge variant="outline">Acknowledged</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight">Sent history</h3>
              {outgoingTransfers.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven't shared any items with friends yet.</p>
              ) : (
                <div className="space-y-3">
                  {outgoingTransfers.map((transfer) => {
                    const recipientName =
                      transfer.recipient_profile?.display_name ??
                      transfer.recipient_profile?.username ??
                      "Unknown recipient";
                    const createdAt = transfer.created_at
                      ? new Date(transfer.created_at).toLocaleString()
                      : null;
                    return (
                      <div key={transfer.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {extractInventorySummary(transfer)}
                            </p>
                            <p className="text-xs text-muted-foreground">To {recipientName}</p>
                            {createdAt ? (
                              <p className="text-[11px] text-muted-foreground">Sent {createdAt}</p>
                            ) : null}
                          </div>
                          <Badge variant={transfer.status === "acknowledged" ? "default" : "secondary"}>
                            {transfer.status === "acknowledged" ? "Received" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold tracking-tight">Marketplace preview</h3>
              <p className="text-sm text-muted-foreground">
                Share a quick listing to negotiate a sale with your chosen friend. This keeps negotiations visible in your chat history.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="listing-price">Price (credits)</Label>
                <Input
                  id="listing-price"
                  type="number"
                  min="1"
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  placeholder="e.g. 250"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="listing-notes">Message to friend</Label>
                <Textarea
                  id="listing-notes"
                  value={saleNotes}
                  onChange={(event) => setSaleNotes(event.target.value)}
                  placeholder="Outline your offer, bundle details, or pickup ideas."
                  rows={3}
                />
              </div>
            </div>
            {selectedBooks.length > 0 ? (
              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3">
                <p className="text-sm font-semibold">Included items</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {selectedBooks.map((entry) => (
                    <li key={`listing-${entry.id}`}>
                      {entry.skill_books?.title ?? "Unknown book"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={handleShareListing}
              disabled={!selectedFriendId || selectedBooks.length === 0}
            >
              Share listing with{" "}
              {selectedFriend?.partnerProfile?.display_name ??
                selectedFriend?.partnerProfile?.username ??
                "your friend"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryManager;
