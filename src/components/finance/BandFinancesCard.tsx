import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import type { BandFinance } from "@/hooks/useFinances";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface BandFinancesCardProps {
  bands: BandFinance[];
}

export const BandFinancesCard = ({ bands }: BandFinancesCardProps) => {
  const totalBandEquity = bands.reduce((sum, b) => sum + b.playerShare, 0);

  if (bands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Band Finances</CardTitle>
          <CardDescription>Your share of band funds</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Join or create a band to track shared finances
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band Finances</CardTitle>
        <CardDescription>
          Your equity: {currencyFormatter.format(totalBandEquity)} across {bands.length} band{bands.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Band</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Your Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bands.map((band) => (
              <TableRow key={band.id}>
                <TableCell className="font-medium">{band.name}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {currencyFormatter.format(band.balance)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{band.memberCount}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-500">
                  {currencyFormatter.format(band.playerShare)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
