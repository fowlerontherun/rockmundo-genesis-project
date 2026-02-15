import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Gift } from "lucide-react";

interface DrawResultsProps {
  draw: any;
  tickets: any[];
  onClaim: (ticketId: string) => void;
  claimLoading: boolean;
}

const LotteryBall = ({ number, isBonus, isMatched }: { number: number; isBonus?: boolean; isMatched?: boolean }) => (
  <div
    className={`inline-flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold
      ${isBonus
        ? "bg-warning text-warning-foreground"
        : isMatched
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
  >
    {number}
  </div>
);

export const DrawResults = ({ draw, tickets, onClaim, claimLoading }: DrawResultsProps) => {
  if (!draw || draw.status === "pending") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No draw results yet. The draw happens every Monday at 00:00 UTC.
        </CardContent>
      </Card>
    );
  }

  const winningNumbers: number[] = draw.winning_numbers || [];
  const bonusNumber: number = draw.bonus_number;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            Winning Numbers — Week of {draw.week_start}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {winningNumbers.map((n: number, i: number) => (
              <LotteryBall key={i} number={n} />
            ))}
            <span className="text-muted-foreground mx-1">+</span>
            <LotteryBall number={bonusNumber} isBonus />
          </div>
        </CardContent>
      </Card>

      {tickets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket: any) => {
              const ticketNumbers: number[] = ticket.selected_numbers || [];
              const hasPrize = ticket.prize_cash > 0 || ticket.prize_xp > 0 || ticket.prize_fame > 0;

              return (
                <div key={ticket.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {ticketNumbers.map((n: number, i: number) => (
                      <LotteryBall
                        key={i}
                        number={n}
                        isMatched={winningNumbers.includes(n)}
                      />
                    ))}
                    <span className="text-muted-foreground mx-1">+</span>
                    <LotteryBall
                      number={ticket.bonus_number}
                      isBonus
                      isMatched={ticket.bonus_number === bonusNumber}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {ticket.matches !== null && (
                        <Badge variant="outline">
                          {ticket.matches} match{ticket.matches !== 1 ? "es" : ""}
                          {ticket.bonus_matched ? " + Bonus" : ""}
                        </Badge>
                      )}
                      {hasPrize && (
                        <Badge className="bg-primary/10 text-primary">
                          <Gift className="h-3 w-3 mr-1" />
                          {ticket.prize_cash > 0 && `$${ticket.prize_cash.toLocaleString()}`}
                          {ticket.prize_xp > 0 && ` +${ticket.prize_xp} XP`}
                          {ticket.prize_fame > 0 && ` +${ticket.prize_fame} Fame`}
                        </Badge>
                      )}
                    </div>
                    {hasPrize && !ticket.claimed && (
                      <Button
                        size="sm"
                        onClick={() => onClaim(ticket.id)}
                        disabled={claimLoading}
                      >
                        Claim Prize
                      </Button>
                    )}
                    {ticket.claimed && (
                      <Badge variant="secondary">Claimed</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
