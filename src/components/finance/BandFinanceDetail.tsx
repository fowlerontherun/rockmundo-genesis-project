import { useMemo, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FMFilterBar } from "@/components/fm/FMFilterBar";
import type { BandFinance } from "@/hooks/useFinances";
import { formatMoney } from "@/lib/financeFormatting";

interface BandFinanceDetailProps {
  bands: BandFinance[];
}

export const BandFinanceDetail = ({ bands }: BandFinanceDetailProps) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? bands.filter((band) => band.name.toLowerCase().includes(query)) : bands;
  }, [bands, search]);

  const treasuryCount = bands.reduce((sum, band) => sum + band.treasuries.length, 0);

  if (!bands.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Band Treasuries</CardTitle><CardDescription>Shared funds remain separate from personal wealth.</CardDescription></CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center">
          <div className="text-center"><Users className="mx-auto h-8 w-8 text-fm-fg-muted/50" /><p className="mt-2 text-xs text-fm-fg-muted">Join or create a band to see its treasury.</p></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band Treasuries</CardTitle>
        <CardDescription>{treasuryCount} canonical treasury account{treasuryCount === 1 ? "" : "s"} across {bands.length} band{bands.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FMFilterBar label="Bands" search={search} onSearchChange={setSearch} searchPlaceholder="Search band name…" />
        <Table>
          <TableHeader><TableRow><TableHead>Band</TableHead><TableHead>Members</TableHead><TableHead>Currency</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Available</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.flatMap((band) =>
              band.treasuries.length
                ? band.treasuries.map((treasury, index) => (
                    <TableRow key={`${band.id}-${treasury.accountId}`}>
                      <TableCell className="font-medium">{index === 0 ? band.name : ""}</TableCell>
                      <TableCell>{index === 0 ? band.memberCount : ""}</TableCell>
                      <TableCell><Badge variant="outline">{treasury.currencyCode}</Badge></TableCell>
                      <TableCell className="text-right">{formatMoney(treasury.balance, treasury.currencyCode)}</TableCell>
                      <TableCell className="text-right text-fm-good">{formatMoney(treasury.availableBalance, treasury.currencyCode)}</TableCell>
                    </TableRow>
                  ))
                : [
                    <TableRow key={`${band.id}-empty`}>
                      <TableCell className="font-medium">{band.name}</TableCell><TableCell>{band.memberCount}</TableCell><TableCell colSpan={3} className="text-muted-foreground">No canonical treasury account found.</TableCell>
                    </TableRow>,
                  ],
            )}
          </TableBody>
        </Table>
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground"><ShieldCheck className="h-4 w-4" /> Shared ownership</span>{" "}
          Treasury funds are controlled by band finance roles and are not divided into a fictional personal share.
        </div>
      </CardContent>
    </Card>
  );
};
