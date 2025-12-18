import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PlayerInvestment, InvestmentOption } from "@/hooks/useFinances";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface InvestmentsTabProps {
  investments: PlayerInvestment[];
  investmentOptions: InvestmentOption[];
  cash: number;
}

export const InvestmentsTab = ({ investments, investmentOptions, cash }: InvestmentsTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<InvestmentOption | null>(null);
  const [investAmount, setInvestAmount] = useState("");
  const [isInvesting, setIsInvesting] = useState(false);

  const totalInvested = investments.reduce((sum, i) => sum + i.invested_amount, 0);
  const totalValue = investments.reduce((sum, i) => sum + i.current_value, 0);
  const totalGain = totalValue - totalInvested;
  const overallRoi = totalInvested > 0 ? totalGain / totalInvested : 0;

  const handleInvest = async () => {
    if (!user?.id || !selectedOption) return;
    const amount = parseInt(investAmount);
    
    if (isNaN(amount) || amount < selectedOption.minInvestment) {
      toast.error(`Minimum investment is ${currencyFormatter.format(selectedOption.minInvestment)}`);
      return;
    }
    
    if (amount > cash) {
      toast.error("Insufficient funds");
      return;
    }

    setIsInvesting(true);
    try {
      // Create investment
      const { error: investError } = await supabase.from("player_investments").insert({
        user_id: user.id,
        investment_name: selectedOption.name,
        category: selectedOption.category,
        invested_amount: amount,
        current_value: amount,
        growth_rate: selectedOption.risk === "High" ? 0.0003 : selectedOption.risk === "Medium" ? 0.0002 : 0.0001,
      });

      if (investError) throw investError;

      // Deduct from cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: cash - amount })
        .eq("user_id", user.id);

      if (cashError) throw cashError;

      toast.success(`Invested ${currencyFormatter.format(amount)} in ${selectedOption.name}`);
      setSelectedOption(null);
      setInvestAmount("");
      queryClient.invalidateQueries({ queryKey: ["player-investments"] });
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
    } catch (error) {
      toast.error("Failed to make investment");
      console.error(error);
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Investment Portfolio
          </CardTitle>
          <CardDescription>
            {investments.length} position{investments.length !== 1 ? "s" : ""} • {currencyFormatter.format(totalValue)} total value
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No investments yet. Browse options below to get started.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Invested</p>
                  <p className="text-lg font-semibold">{currencyFormatter.format(totalInvested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="text-lg font-semibold text-primary">{currencyFormatter.format(totalValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Return</p>
                  <p className={`text-lg font-semibold ${totalGain >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {totalGain >= 0 ? "+" : ""}{currencyFormatter.format(totalGain)} ({percentFormatter.format(overallRoi)})
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investment</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => {
                    const gain = inv.current_value - inv.invested_amount;
                    const roi = inv.invested_amount > 0 ? gain / inv.invested_amount : 0;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.investment_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {currencyFormatter.format(inv.invested_amount)}
                        </TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(inv.current_value)}</TableCell>
                        <TableCell className={`text-right ${gain >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          {gain >= 0 ? "+" : ""}{percentFormatter.format(roi)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Investment Options */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Options</CardTitle>
          <CardDescription>Grow your wealth with these opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {investmentOptions.map((option) => (
              <Card key={option.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{option.name}</CardTitle>
                    <Badge
                      variant={option.risk === "High" ? "destructive" : option.risk === "Medium" ? "secondary" : "outline"}
                    >
                      {option.risk} Risk
                    </Badge>
                  </div>
                  <CardDescription>{option.category}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Min:</span>{" "}
                      <span className="font-medium">{currencyFormatter.format(option.minInvestment)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Expected:</span>{" "}
                      <span className="font-medium text-emerald-500">{option.expectedReturn}</span>
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        className="w-full" 
                        onClick={() => {
                          setSelectedOption(option);
                          setInvestAmount(option.minInvestment.toString());
                        }}
                        disabled={cash < option.minInvestment}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Invest
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invest in {selectedOption?.name}</DialogTitle>
                        <DialogDescription>
                          Enter the amount you want to invest. You have {currencyFormatter.format(cash)} available.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Investment Amount</Label>
                          <Input
                            id="amount"
                            type="number"
                            value={investAmount}
                            onChange={(e) => setInvestAmount(e.target.value)}
                            min={selectedOption?.minInvestment}
                            max={cash}
                          />
                          <p className="text-xs text-muted-foreground">
                            Minimum: {currencyFormatter.format(selectedOption?.minInvestment || 0)}
                          </p>
                        </div>
                        {selectedOption?.risk === "High" && (
                          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <p className="text-destructive">
                              High-risk investments can lose value. Only invest what you can afford to lose.
                            </p>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOption(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInvest} disabled={isInvesting}>
                          {isInvesting ? "Processing..." : `Invest ${currencyFormatter.format(parseInt(investAmount) || 0)}`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
