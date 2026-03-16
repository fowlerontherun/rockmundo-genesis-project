import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useAddictions } from "@/hooks/useAddictions";
import { Dices, Club, CircleDot, Cherry, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

const GAMES = [
  {
    key: "blackjack",
    title: "Blackjack",
    description: "Beat the dealer to 21. Hit, Stand, or Double Down.",
    icon: Club,
    path: "/casino/blackjack",
    color: "from-emerald-900/60 to-emerald-700/30",
    emoji: "🃏",
  },
  {
    key: "roulette",
    title: "Roulette",
    description: "Place your bets. Red, black, or lucky number?",
    icon: CircleDot,
    path: "/casino/roulette",
    color: "from-red-900/60 to-red-700/30",
    emoji: "🎡",
  },
  {
    key: "slots",
    title: "Slot Machine",
    description: "Spin the music-themed reels and hit the jackpot!",
    icon: Cherry,
    path: "/casino/slots",
    color: "from-yellow-900/60 to-amber-700/30",
    emoji: "🎰",
  },
];

export default function Casino() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profileId } = useActiveProfile();
  const { addictions } = useAddictions();

  const gamblingAddiction = addictions.find(a => a.addiction_type === "gambling");

  const { data: profile } = useQuery({
    queryKey: ["profile-cash", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      return data;
    },
    enabled: !!profileId,
  });

  const { data: stats } = useQuery({
    queryKey: ["casino-stats", profileId],
    queryFn: async () => {
      if (!profileId) return { totalWon: 0, totalLost: 0, gamesPlayed: 0 };
      const { data } = await (supabase as any)
        .from("casino_transactions")
        .select("net_result")
        .eq("profile_id", profileId);
      if (!data) return { totalWon: 0, totalLost: 0, gamesPlayed: 0 };
      const totalWon = data.filter((d: any) => d.net_result > 0).reduce((s: number, d: any) => s + d.net_result, 0);
      const totalLost = data.filter((d: any) => d.net_result < 0).reduce((s: number, d: any) => s + Math.abs(d.net_result), 0);
      return { totalWon, totalLost, gamesPlayed: data.length };
    },
    enabled: !!profileId,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">🎰</motion.div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
          Casino
        </h1>
        <p className="text-muted-foreground">Try your luck — but know when to walk away.</p>
      </div>

      {/* Addiction warning */}
      {gamblingAddiction && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Gambling Addiction Active</p>
              <p className="text-xs text-muted-foreground">
                Severity: {gamblingAddiction.severity}/100. Consider seeking recovery.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance & Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-primary">${(profile?.cash ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Won</p>
            <p className="text-lg font-bold text-green-500">${(stats?.totalWon ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3" /> Lost</p>
            <p className="text-lg font-bold text-destructive">${(stats?.totalLost ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Games */}
      <div className="grid gap-4">
        {GAMES.map((game, i) => (
          <motion.div
            key={game.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
              onClick={() => navigate(game.path)}
            >
              <div className={`bg-gradient-to-r ${game.color} p-4 flex items-center gap-4`}>
                <div className="text-4xl">{game.emoji}</div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{game.title}</CardTitle>
                  <CardDescription className="text-muted-foreground/80">{game.description}</CardDescription>
                </div>
                <Button variant="secondary" size="sm">Play</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        All gambling uses in-game currency only. Bets: $10–$10,000.
      </p>
    </div>
  );
}
