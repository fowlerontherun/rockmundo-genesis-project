import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, History, Timer } from "lucide-react";
import { NumberPicker } from "@/components/lottery/NumberPicker";
import { DrawResults } from "@/components/lottery/DrawResults";
import { TicketHistory } from "@/components/lottery/TicketHistory";
import {
  useCurrentDraw,
  useMyTicket,
  useMyTickets,
  useBuyTicket,
  useDrawHistory,
  useClaimPrize,
  TICKET_COST,
} from "@/hooks/useLottery";
import { useGameData } from "@/hooks/useGameData";
import { getUtcWeekStart } from "@/utils/week";
import { useEffect, useState } from "react";

function Countdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const weekStart = getUtcWeekStart(now, 1);
      const nextDraw = new Date(weekStart);
      nextDraw.setUTCDate(nextDraw.getUTCDate() + 7);

      const diff = nextDraw.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("Draw in progress...");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Timer className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Next draw:</span>
      <span className="font-mono font-bold text-foreground">{timeLeft}</span>
    </div>
  );
}

const PRIZE_TABLE = [
  { match: "7 + Bonus", prize: "$1,000,000 + 10,000 XP + 5,000 Fame" },
  { match: "7", prize: "$250,000 + 5,000 XP" },
  { match: "6 + Bonus", prize: "$50,000 + 2,000 XP" },
  { match: "6", prize: "$10,000 + 1,000 XP" },
  { match: "5 + Bonus", prize: "$5,000 + 500 XP" },
  { match: "5", prize: "$1,000 + 200 XP" },
  { match: "4", prize: "$500 + 100 XP" },
  { match: "3", prize: "Free ticket (refund $500)" },
];

const Lottery = () => {
  const { profile } = useGameData();
  const { data: currentDraw, isLoading: drawLoading } = useCurrentDraw();
  const { data: myTicket } = useMyTicket(currentDraw?.id);
  const { data: myTickets } = useMyTickets();
  const { data: drawHistory } = useDrawHistory();
  const buyTicket = useBuyTicket();
  const claimPrize = useClaimPrize();

  const cash = (profile as any)?.cash || 0;
  const hasTicket = !!myTicket;

  const handleBuyTicket = (numbers: number[], bonus: number) => {
    if (!currentDraw?.id) return;
    buyTicket.mutate({
      drawId: currentDraw.id,
      selectedNumbers: numbers,
      bonusNumber: bonus,
    });
  };

  // Get tickets for the latest drawn draw
  const drawnTickets = (myTickets || []).filter(
    (t: any) => t.lottery_draws && t.lottery_draws.status !== "pending"
  );

  const latestDrawnDraw = (drawHistory || [])[0];
  const ticketsForLatestDraw = (myTickets || []).filter(
    (t: any) => latestDrawnDraw && t.draw_id === latestDrawnDraw.id
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Weekly Lottery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick 7 numbers + 1 bonus for a chance to win big!
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Balance: ${cash.toLocaleString()}
        </Badge>
      </div>

      <Countdown />

      <Tabs defaultValue="play">
        <TabsList className="w-full">
          <TabsTrigger value="play" className="flex-1">
            <Ticket className="h-4 w-4 mr-1" /> Play
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1">
            <Trophy className="h-4 w-4 mr-1" /> Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <History className="h-4 w-4 mr-1" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="play" className="space-y-4">
          {drawLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : hasTicket ? (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <p className="text-lg font-semibold">You already have a ticket for this week!</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {(myTicket.selected_numbers || []).sort((a: number, b: number) => a - b).map((n: number, i: number) => (
                    <span key={i} className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                      {n}
                    </span>
                  ))}
                  <span className="flex items-center text-muted-foreground mx-1">+</span>
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-warning text-warning-foreground font-bold">
                    {myTicket.bonus_number}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Good luck! Results will be available after the draw.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {cash < TICKET_COST && (
                <Card>
                  <CardContent className="py-4 text-center text-destructive text-sm">
                    You need at least ${TICKET_COST} to buy a ticket. Current balance: ${cash.toLocaleString()}
                  </CardContent>
                </Card>
              )}
              <NumberPicker
                onSubmit={handleBuyTicket}
                disabled={cash < TICKET_COST || buyTicket.isPending}
                isLoading={buyTicket.isPending}
              />
            </>
          )}

          {/* Prize table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prize Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 text-sm">
                {PRIZE_TABLE.map(({ match, prize }) => (
                  <div key={match} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="font-medium">{match}</span>
                    <span className="text-muted-foreground">{prize}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <DrawResults
            draw={latestDrawnDraw}
            tickets={ticketsForLatestDraw}
            onClaim={(id) => claimPrize.mutate(id)}
            claimLoading={claimPrize.isPending}
          />
        </TabsContent>

        <TabsContent value="history">
          <TicketHistory draws={drawHistory || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Lottery;
