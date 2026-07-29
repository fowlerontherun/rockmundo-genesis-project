import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Leaf, Music, Palette, Shield, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { makeCharityDonation } from "@/lib/api/charityDonations";
import { formatMinorMoney, formatMoney } from "@/lib/financeFormatting";

const categoryIcons: Record<string, typeof Heart> = {
  music_education: Music,
  health: Shield,
  environment: Leaf,
  humanitarian: Heart,
  arts: Palette,
};

const categoryColours: Record<string, string> = {
  music_education: "bg-blue-500/10 text-blue-500",
  health: "bg-red-500/10 text-red-500",
  environment: "bg-green-500/10 text-green-500",
  humanitarian: "bg-pink-500/10 text-pink-500",
  arts: "bg-purple-500/10 text-purple-500",
};

interface CharityOrganisation {
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
  amount_minor: number;
  currency_code: string;
  fame_gained: number;
  reputation_gained: number;
  created_at: string;
}

interface CharityDonationsTabProps {
  cash: number;
  currencyCode: string;
}

export const CharityDonationsTab = ({ cash, currencyCode }: CharityDonationsTabProps) => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [selectedCharity, setSelectedCharity] = useState<CharityOrganisation | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: charities = [] } = useQuery({
    queryKey: ["charities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charity_organizations")
        .select("id, name, category, description, fame_bonus_pct, reputation_boost, tax_deduction_pct")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CharityOrganisation[];
    },
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["charity-donations", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("charity_donations")
        .select("id, charity_id, amount, amount_minor, currency_code, fame_gained, reputation_gained, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CharityDonation[];
    },
    enabled: !!profileId,
  });

  const donateMutation = useMutation({
    mutationFn: ({ charityId, amountMinor, idempotencyKey }: { charityId: string; amountMinor: number; idempotencyKey: string }) =>
      makeCharityDonation(charityId, amountMinor, idempotencyKey),
    onSuccess: (result) => {
      for (const queryKey of [
        ["charity-donations", profileId],
        ["finance-command-center", profileId],
        ["financial-ledger-history"],
        ["profile"],
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(
        `Donated ${formatMinorMoney(result.amountMinor, result.currencyCode)} · +${result.fameGained} fame · +${result.reputationGained} attitude`,
      );
      setDialogOpen(false);
      setDonationAmount("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const amountMajor = Number.parseInt(donationAmount, 10);
  const validAmount = Number.isInteger(amountMajor) && amountMajor > 0;

  const handleDonate = () => {
    if (!selectedCharity || !validAmount) {
      toast.error("Enter a whole-number donation amount");
      return;
    }
    if (amountMajor > cash) {
      toast.error("Not enough available wallet funds");
      return;
    }

    donateMutation.mutate({
      charityId: selectedCharity.id,
      amountMinor: amountMajor * 100,
      idempotencyKey: `charity:${profileId ?? "unknown"}:${crypto.randomUUID()}`,
    });
  };

  const categories = [...new Set(charities.map((charity) => charity.category))];
  const filtered = categoryFilter
    ? charities.filter((charity) => charity.category === categoryFilter)
    : charities;
  const currentCurrencyDonatedMinor = donations
    .filter((donation) => donation.currency_code === currencyCode)
    .reduce((sum, donation) => sum + donation.amount_minor, 0);
  const previewFame = selectedCharity && validAmount
    ? Math.floor((amountMajor * selectedCharity.fame_bonus_pct) / 100)
    : 0;
  const previewReputation = selectedCharity && validAmount
    ? Math.floor((amountMajor * selectedCharity.reputation_boost) / 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Donated in {currencyCode}</p>
            <p className="text-2xl font-bold text-pink-500">
              {formatMinorMoney(currentCurrencyDonatedMinor, currencyCode)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Donations made</p>
            <p className="text-2xl font-bold text-primary">{donations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Fame earned</p>
            <p className="text-2xl font-bold text-amber-500">
              <Star className="mr-1 inline h-5 w-5" />
              {donations.reduce((sum, donation) => sum + donation.fame_gained, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={categoryFilter === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setCategoryFilter(null)}
        >
          All
        </Badge>
        {categories.map((category) => (
          <Badge
            key={category}
            variant={categoryFilter === category ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => setCategoryFilter(category === categoryFilter ? null : category)}
          >
            {category.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((charity) => {
          const Icon = categoryIcons[charity.category] || Heart;
          const colour = categoryColours[charity.category] || "bg-muted text-muted-foreground";
          return (
            <Card key={charity.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-2 ${colour}`}><Icon className="h-5 w-5" /></div>
                  <Badge variant="outline" className="text-xs capitalize">{charity.category.replaceAll("_", " ")}</Badge>
                </div>
                <CardTitle className="mt-2 text-base">{charity.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">{charity.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Fame rate {charity.fame_bonus_pct}%</Badge>
                  <Badge variant="secondary">Attitude rate {charity.reputation_boost}%</Badge>
                  <Badge variant="secondary">Tax record {charity.tax_deduction_pct}%</Badge>
                </div>
                <Dialog
                  open={dialogOpen && selectedCharity?.id === charity.id}
                  onOpenChange={(open) => {
                    setDialogOpen(open);
                    setSelectedCharity(open ? charity : null);
                    if (!open) setDonationAmount("");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full" variant="outline" disabled={cash < 1}>
                      <Heart className="mr-1 h-3 w-3" /> Donate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Donate to {charity.name}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">Wallet available: {formatMoney(cash, currencyCode)}</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder={`Amount (${currencyCode})`}
                        value={donationAmount}
                        onChange={(event) => setDonationAmount(event.target.value)}
                        min={1}
                        max={Math.floor(cash)}
                        step={1}
                      />
                      {validAmount && (
                        <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
                          <p>Estimated fame: <span className="font-semibold text-amber-500">+{previewFame}</span></p>
                          <p>Estimated attitude reputation: <span className="font-semibold text-blue-500">+{previewReputation}</span></p>
                          <p className="text-xs text-muted-foreground">The server calculates the final rewards and caps attitude at 100.</p>
                        </div>
                      )}
                      <Button onClick={handleDonate} disabled={donateMutation.isPending || !validAmount} className="w-full">
                        {donateMutation.isPending ? "Processing…" : `Donate ${validAmount ? formatMoney(amountMajor, currencyCode) : ""}`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {donations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Donation history</CardTitle>
            <CardDescription>Each completed donation is linked to an immutable ledger transaction.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Charity</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Fame</TableHead><TableHead className="text-right">Attitude</TableHead><TableHead className="text-right">Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {donations.map((donation) => {
                  const charity = charities.find((item) => item.id === donation.charity_id);
                  return (
                    <TableRow key={donation.id}>
                      <TableCell className="font-medium">{charity?.name || "Unknown charity"}</TableCell>
                      <TableCell className="text-right text-pink-500">{formatMinorMoney(donation.amount_minor, donation.currency_code)}</TableCell>
                      <TableCell className="text-right text-amber-500">+{donation.fame_gained}</TableCell>
                      <TableCell className="text-right text-blue-500">+{donation.reputation_gained}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{new Date(donation.created_at).toLocaleDateString("en-GB")}</TableCell>
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
