import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Landmark, Receipt } from "lucide-react";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface CityTreasury {
  id: string;
  city_id: string;
  balance: number;
  total_tax_collected: number;
  total_spent: number;
  tax_rate_pct: number;
}

interface LedgerEntry {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export const CityTreasuryCard = () => {
  const { profileId } = useActiveProfile();

  // Get player's current city
  const { data: profile } = useQuery({
    queryKey: ["profile-city", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("current_city_id")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const cityId = profile?.current_city_id;

  const { data: treasury } = useQuery({
    queryKey: ["city-treasury", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("city_treasury")
        .select("*")
        .eq("city_id", cityId)
        .single();
      if (error) throw error;
      return data as CityTreasury;
    },
    enabled: !!cityId,
  });

  const { data: cityName } = useQuery({
    queryKey: ["city-name", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("cities")
        .select("name, country")
        .eq("id", cityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["city-treasury-ledger", cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const { data, error } = await supabase
        .from("city_treasury_ledger")
        .select("*")
        .eq("city_id", cityId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!cityId,
  });

  if (!treasury) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>City Treasury</CardTitle>
          <CardDescription>Your city's financial status</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center">
          <div className="text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Move to a city to view its treasury</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {cityName?.name || "City"} Treasury
          </CardTitle>
          <CardDescription>{cityName?.country}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-xl font-bold text-emerald-500">{fmt.format(treasury.balance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tax Collected</p>
              <p className="text-xl font-bold text-primary">{fmt.format(treasury.total_tax_collected)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tax Rate</p>
              <p className="text-xl font-bold">{treasury.tax_rate_pct}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      {ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.description || "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${entry.amount >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {fmt.format(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
