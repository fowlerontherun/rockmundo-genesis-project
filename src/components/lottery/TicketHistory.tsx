import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

interface TicketHistoryProps {
  draws: any[];
}

export const TicketHistory = ({ draws }: TicketHistoryProps) => {
  if (!draws || draws.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No past draw results available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Past Draws
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Winning Numbers</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Jackpot</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draws.map((draw: any) => (
              <TableRow key={draw.id}>
                <TableCell className="font-mono text-xs">{draw.week_start}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(draw.winning_numbers || []).map((n: number, i: number) => (
                      <span key={i} className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {n}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-warning/20 text-warning text-xs font-bold">
                    {draw.bonus_number}
                  </span>
                </TableCell>
                <TableCell>${(draw.jackpot_amount || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={draw.status === "paid_out" ? "secondary" : "outline"}>
                    {draw.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
