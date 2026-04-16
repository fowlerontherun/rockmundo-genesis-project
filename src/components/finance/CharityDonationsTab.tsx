import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Heart, Star, Shield, Leaf, Music, Palette } from "lucide-react";
import { toast } from "sonner";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const categoryIcons: Record<string, typeof Heart> = {
  music_education: Music,
  health: Shield,
  environment: Leaf,
  humanitarian: Heart,
  arts: Palette,
};

const categoryColors: Record<string, string> = {
  music_education: "bg-blue-500/10 text-blue-500",
  health: "bg-red-500/10 text-red-500",
  environment: "bg-green-500/10 text-green-500",
  humanitarian: "bg-pink-500/10 text-pink-500",
  arts: "bg-purple-500/10 text-purple-500",
};

interface CharityOrg {
  id: string;
  name: string;
  category: string;
  description: string | null;
  fame_bonus_pct: number;
  reputation_boost: number;
  tax_deduction_pct: number;
}

interface CharityDonation {
  id: string;
  charity_id: string;
  amount: number;
  fame_gained: number;
  reputation_gained: number;
  created_at: string;
}

export const CharityDonationsTab = ({ cash }: { cash: number }) => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [selectedCharity, setSelectedCharity] = useState<CharityOrg | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: charities = [] } = useQuery({
    queryKey: ["charities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charity_organizations")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CharityOrg[];
    },
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["charity-donations", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("charity_donations")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as CharityDonation[];
    },
    enabled: !!profileId,
  });

  const donateMutation = useMutation({
    mutationFn: async ({ charityId, amount, fameGained, repGained }: { charityId: string; amount: number; fameGained: number; repGained: number }) => {
      if (!profileId) throw new Error("No profile");

      // Deduct cash
      const { error: cashErr } = await supabase
        .from("profiles")
        .update({ cash: cash - amount })
        .eq("id", profileId);
      if (cashErr) throw cashErr;

      // Record donation
      const { error: donErr } = await supabase
        .from("charity_donations")
        .insert({ profile_id: profileId, charity_id: charityId, amount, fame_gained: fameGained, reputation_gained: repGained });
      if (donErr) throw donErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
      queryClient.invalidateQueries({ queryKey: ["charity-donations"] });
      toast.success("Donation made! You gained fame and reputation.");
      setDialogOpen(false);
      setDonationAmount("");
    },
    onError: () => toast.error("Failed to process donation"),
  });

  const handleDonate = () => {
    if (!selectedCharity) return;
    const amount = parseInt(donationAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid amount");
    if (amount > cash) return toast.error("Not enough cash");
    const fameGained = Math.floor(amount * (selectedCharity.fame_bonus_pct / 100));
    const repGained = Math.floor((amount / 100) * selectedCharity.reputation_boost);
    donateMutation.mutate({ charityId: selectedCharity.id, amount, fameGained, repGained });
  };

  const categories = [...new Set(charities.map((c) => c.category))];
  const filtered = categoryFilter ? charities.filter((c) => c.category === categoryFilter) : charities;
  const totalDonated = donations.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Donated</p>
            <p className="text-2xl font-bold text-pink-500">{fmt.format(totalDonated)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Donations Made</p>
            <p className="text-2xl font-bold text-primary">{donations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Fame Earned</p>
            <p className="text-2xl font-bold text-amber-500">
              <Star className="inline h-5 w-5 mr-1" />
              {donations.reduce((s, d) => s + d.fame_gained, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={categoryFilter === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setCategoryFilter(null)}
        >
          All
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={categoryFilter === cat ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
          >
            {cat.replace("_", " ")}
          </Badge>
        ))}
      </div>

      {/* Charity grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((charity) => {
          const Icon = categoryIcons[charity.category] || Heart;
          const color = categoryColors[charity.category] || "bg-muted text-muted-foreground";
          return (
            <Card key={charity.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-2 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {charity.category.replace("_", " ")}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{charity.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{charity.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Fame +{charity.fame_bonus_pct}%</Badge>
                  <Badge variant="secondary">Rep +{charity.reputation_boost}</Badge>
                  <Badge variant="secondary">Tax -{charity.tax_deduction_pct}%</Badge>
                </div>
                <Dialog open={dialogOpen && selectedCharity?.id === charity.id} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (open) setSelectedCharity(charity);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full" variant="outline">
                      <Heart className="h-3 w-3 mr-1" /> Donate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Donate to {charity.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">Available: {fmt.format(cash)}</p>
                      <Input
                        type="number"
                        placeholder="Amount ($)"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        min={1}
                        max={cash}
                      />
                      {donationAmount && parseInt(donationAmount) > 0 && (
                        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                          <p>Fame gained: <span className="font-semibold text-amber-500">+{Math.floor(parseInt(donationAmount) * (charity.fame_bonus_pct / 100))}</span></p>
                          <p>Reputation: <span className="font-semibold text-blue-500">+{Math.floor((parseInt(donationAmount) / 100) * charity.reputation_boost)}</span></p>
                        </div>
                      )}
                      <Button onClick={handleDonate} disabled={donateMutation.isPending} className="w-full">
                        {donateMutation.isPending ? "Processing..." : "Confirm Donation"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Donation history */}
      {donations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Donation History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charity</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fame</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map((d) => {
                  const charity = charities.find((c) => c.id === d.charity_id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{charity?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right text-pink-500">{fmt.format(d.amount)}</TableCell>
                      <TableCell className="text-right text-amber-500">+{d.fame_gained}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
