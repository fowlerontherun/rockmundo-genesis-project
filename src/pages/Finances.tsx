import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import {
  fetchAcceptedFriendsForProfile,
  fetchPrimaryProfileForUser,
  type AcceptedFriendProfile,
} from "@/integrations/supabase/friends";
import {
  fetchWalletForProfile,
  giftWalletFunds,
  type PlayerXpWalletRow,
} from "@/integrations/supabase/wallet";

const personalIncome = [
  { source: "Gig Payouts", amount: "$1,200", cadence: "Monthly" },
  { source: "Merch Sales", amount: "$450", cadence: "Bi-weekly" },
  { source: "Streaming Royalties", amount: "$220", cadence: "Monthly" },
];

const personalExpenses = [
  { category: "Rent", amount: "$850", cadence: "Monthly" },
  { category: "Equipment Upgrades", amount: "$300", cadence: "Quarterly" },
  { category: "Travel", amount: "$180", cadence: "Per trip" },
];

const bandIncome = [
  { source: "Tour Revenue", amount: "$8,500", cadence: "Per tour" },
  { source: "Sponsorships", amount: "$2,000", cadence: "Quarterly" },
  { source: "Crowdfunding", amount: "$1,100", cadence: "Campaign" },
];

const bandExpenses = [
  { category: "Rehearsal Space", amount: "$600", cadence: "Monthly" },
  { category: "Marketing", amount: "$750", cadence: "Campaign" },
  { category: "Logistics", amount: "$1,200", cadence: "Per tour" },
];

const investmentHoldings = [
  { name: "Music ETF", value: "$3,400", change: "+4.2%" },
  { name: "Creator Fund", value: "$1,850", change: "+1.3%" },
  { name: "Studio Co-op", value: "$2,200", change: "+6.1%" },
];

const loanOffer = {
  name: "Creative Expansion Loan",
  amount: "$15,000",
  rate: "6.5% APR",
  term: "36 months",
  perks: [
    "No payments for the first 60 days",
    "Flexible collateral (gear or future royalties)",
    "Includes quarterly financial coaching calls",
  ],
};

const Finances = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<PlayerXpWalletRow | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [friends, setFriends] = useState<AcceptedFriendProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [giftAmount, setGiftAmount] = useState<string>("");
  const [isProcessingGift, setIsProcessingGift] = useState(false);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.partnerProfileId === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );
  const walletBalance = useMemo(() => wallet?.xp_balance ?? 0, [wallet]);
  const formattedBalance = useMemo(
    () => walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }),
    [walletBalance],
  );

  const refreshWallet = useCallback(
    async (currentProfileId: string) => {
      setIsLoadingWallet(true);
      try {
        const walletRow = await fetchWalletForProfile(currentProfileId);
        setWallet(walletRow);
      } catch (error) {
        console.error("Failed to load wallet", error);
        toast({
          variant: "destructive",
          title: "Unable to load wallet",
          description: "We couldn't retrieve your wallet balance. Please try again later.",
        });
      } finally {
        setIsLoadingWallet(false);
      }
    },
    [toast],
  );

  const refreshFriends = useCallback(
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
          description: "We couldn't fetch your friend list. Please try again later.",
        });
      } finally {
        setIsLoadingFriends(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!user) {
      setProfileId(null);
      setWallet(null);
      setFriends([]);
      setSelectedFriendId("");
      return;
    }

    let active = true;

    const loadProfile = async () => {
      try {
        const profile = await fetchPrimaryProfileForUser(user.id);
        if (!active) return;
        setProfileId(profile?.id ?? null);
        if (!profile?.id) {
          setWallet(null);
          setFriends([]);
        }
      } catch (error) {
        console.error("Failed to load finance profile", error);
        if (active) {
          toast({
            variant: "destructive",
            title: "Unable to load profile",
            description: "Sign in again or refresh the page to access gifting tools.",
          });
          setProfileId(null);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [toast, user]);

  useEffect(() => {
    if (!profileId) {
      setWallet(null);
      setFriends([]);
      setSelectedFriendId("");
      return;
    }

    void refreshWallet(profileId);
    void refreshFriends(profileId);
  }, [profileId, refreshFriends, refreshWallet]);

  useEffect(() => {
    if (!selectedFriendId && friends.length > 0) {
      setSelectedFriendId(friends[0].partnerProfileId);
    } else if (friends.length === 0 && selectedFriendId) {
      setSelectedFriendId("");
    }
  }, [friends, selectedFriendId]);

  const handleGiftFunds = useCallback(async () => {
    if (!profileId) {
      return;
    }

    if (!selectedFriendId) {
      toast({
        title: "Choose a recipient",
        description: "Select a friend to gift funds to before sending.",
      });
      return;
    }

    const amountValue = Number.parseInt(giftAmount, 10);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast({
        title: "Enter a valid amount",
        description: "Gift amounts must be greater than zero.",
      });
      return;
    }

    const availableBalance = wallet?.xp_balance ?? 0;
    if (amountValue > availableBalance) {
      toast({
        variant: "destructive",
        title: "Insufficient balance",
        description: "You don't have enough funds to complete this gift.",
      });
      return;
    }

    setIsProcessingGift(true);
    const friendName =
      selectedFriend?.partnerProfile?.display_name ??
      selectedFriend?.partnerProfile?.username ??
      "your friend";

    try {
      const result = await giftWalletFunds({
        senderProfileId: profileId,
        recipientProfileId: selectedFriendId,
        amount: amountValue,
      });

      await refreshWallet(profileId);

      toast({
        title: "Gift sent",
        description: `Shared ${amountValue.toLocaleString()} credits with ${friendName}. New balance: ${result.sender_balance.toLocaleString()}.`,
      });

      setGiftAmount("");
    } catch (error) {
      console.error("Failed to gift funds", error);
      toast({
        variant: "destructive",
        title: "Gift failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't send your gift. Please try again later.",
      });
    } finally {
      setIsProcessingGift(false);
    }
  }, [
    giftAmount,
    profileId,
    refreshWallet,
    selectedFriend,
    selectedFriendId,
    toast,
    wallet?.xp_balance,
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
        <p className="text-muted-foreground">
          Monitor personal and band finances, track investments, and explore funding pathways to keep your music dreams
          funded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gift funds</CardTitle>
          <CardDescription>Send spare XP credits to help friends hit their next milestone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to start sending funds to your crew.</p>
          ) : !profileId ? (
            <p className="text-sm text-muted-foreground">
              Create a character profile to unlock wallet gifting and collaborative budgeting tools.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 rounded-lg border bg-muted/20 p-4 md:col-span-1">
                  <p className="text-sm font-medium text-muted-foreground">Wallet balance</p>
                  <div className="flex items-baseline gap-2">
                    {isLoadingWallet ? (
                      <span className="flex items-center gap-2 text-2xl font-semibold">
                        <Loader2 className="h-5 w-5 animate-spin" /> Syncing…
                      </span>
                    ) : wallet ? (
                      <>
                        <span className="text-2xl font-semibold">{formattedBalance}</span>
                        <span className="text-sm text-muted-foreground">credits</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Wallet not initialized yet—complete an activity to populate your balance.
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:col-span-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gift-recipient">Recipient</Label>
                    <Select
                      value={selectedFriendId}
                      onValueChange={setSelectedFriendId}
                      disabled={isLoadingFriends || friends.length === 0}
                    >
                      <SelectTrigger id="gift-recipient">
                        <SelectValue
                          placeholder={
                            isLoadingFriends
                              ? "Loading friends..."
                              : friends.length === 0
                              ? "Add an accepted friend to get started"
                              : "Choose a friend"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {friends.map((friend) => {
                          const displayName =
                            friend.partnerProfile?.display_name ??
                            friend.partnerProfile?.username ??
                            "Friend";
                          return (
                            <SelectItem key={friend.friendshipId} value={friend.partnerProfileId}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gift-amount">Amount</Label>
                    <Input
                      id="gift-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={giftAmount}
                      onChange={(event) => setGiftAmount(event.target.value)}
                      placeholder="Enter credits to send"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void handleGiftFunds()}
                  disabled={
                    !selectedFriendId ||
                    !giftAmount ||
                    isProcessingGift ||
                    wallet === null ||
                    isLoadingWallet ||
                    friends.length === 0 ||
                    Number.parseInt(giftAmount, 10) <= 0
                  }
                >
                  {isProcessingGift ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending gift…
                    </span>
                  ) : (
                    "Send gift"
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {selectedFriend
                    ? `Boosting ${
                        selectedFriend.partnerProfile?.display_name ??
                        selectedFriend.partnerProfile?.username ??
                        "a friend"
                      } with shared funds.`
                    : "Choose a friend and amount to share your wallet balance."}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="band">Band</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Income Streams</CardTitle>
                <CardDescription>Track every dollar supporting your solo career.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personalIncome.map((income) => (
                      <TableRow key={income.source}>
                        <TableCell className="font-medium">{income.source}</TableCell>
                        <TableCell>{income.cadence}</TableCell>
                        <TableCell className="text-right">{income.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>Prepare for upcoming costs before they hit your wallet.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personalExpenses.map((expense) => (
                      <TableRow key={expense.category}>
                        <TableCell className="font-medium">{expense.category}</TableCell>
                        <TableCell>{expense.cadence}</TableCell>
                        <TableCell className="text-right">{expense.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="band" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Band Income</CardTitle>
                <CardDescription>Group revenue from tours, merch, and supporters.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandIncome.map((income) => (
                      <TableRow key={income.source}>
                        <TableCell className="font-medium">{income.source}</TableCell>
                        <TableCell>{income.cadence}</TableCell>
                        <TableCell className="text-right">{income.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Band Expenses</CardTitle>
                <CardDescription>Shared obligations that keep the crew moving.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandExpenses.map((expense) => (
                      <TableRow key={expense.category}>
                        <TableCell className="font-medium">{expense.category}</TableCell>
                        <TableCell>{expense.cadence}</TableCell>
                        <TableCell className="text-right">{expense.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Investments</CardTitle>
            <CardDescription>Diversify your earnings and watch your net worth grow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holding</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investmentHoldings.map((holding) => (
                  <TableRow key={holding.name}>
                    <TableCell className="font-medium">{holding.name}</TableCell>
                    <TableCell>{holding.value}</TableCell>
                    <TableCell className="text-right text-emerald-500">{holding.change}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Check Investments</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Options</CardTitle>
            <CardDescription>Explore financing to accelerate your next big move.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{loanOffer.name}</p>
              <p className="text-sm text-muted-foreground">Up to {loanOffer.amount}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Rate</p>
                <p className="font-semibold">{loanOffer.rate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Term</p>
                <p className="font-semibold">{loanOffer.term}</p>
              </div>
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              {loanOffer.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Apply for Loan</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Finances;
