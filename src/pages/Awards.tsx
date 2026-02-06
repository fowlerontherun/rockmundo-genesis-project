import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useAwards, type AwardShow, type AwardNomination } from "@/hooks/useAwards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Star, Vote, Calendar, MapPin, Users, Sparkles, Crown, Medal, Shirt, Music, ThumbsUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  nominations_open: { label: "Nominations Open", variant: "default" },
  voting_open: { label: "Voting Open", variant: "default" },
  live: { label: "Live Now", variant: "destructive" },
  completed: { label: "Completed", variant: "secondary" },
};

export default function Awards() {
  const { user } = useAuth();
  const { profile } = useGameData();

  // Fetch the user's primary band
  const { data: userBand } = useQuery({
    queryKey: ["user-primary-band", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("bands")
        .select("id, name, fame, status")
        .eq("leader_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    shows, showsLoading, nominations, wins,
    fetchShowNominations, fetchVoteCountForShow,
    submitNomination, castVote, attendRedCarpet,
    isSubmitting, isVoting, isAttending,
  } = useAwards(user?.id, userBand?.id);

  const [selectedShow, setSelectedShow] = useState<AwardShow | null>(null);
  const [showVotingDialog, setShowVotingDialog] = useState(false);
  const [showRedCarpetDialog, setShowRedCarpetDialog] = useState(false);
  const [outfitChoice, setOutfitChoice] = useState("standard");

  // Fetch nominations when a show is selected for voting
  const { data: showNominations = [], isLoading: nominationsLoading } = useQuery({
    queryKey: ["award-show-nominations", selectedShow?.id],
    queryFn: () => fetchShowNominations(selectedShow!.id),
    enabled: !!selectedShow?.id && showVotingDialog,
  });

  const { data: voteCount = 0 } = useQuery({
    queryKey: ["award-show-vote-count", selectedShow?.id, user?.id],
    queryFn: () => fetchVoteCountForShow(selectedShow!.id),
    enabled: !!selectedShow?.id && !!user?.id && showVotingDialog,
  });

  const activeShows = shows.filter(s => s.status !== 'completed');
  const completedShows = shows.filter(s => s.status === 'completed');

  const handleVote = (nominationId: string) => {
    if (!selectedShow) return;
    castVote({ nomination_id: nominationId, show_id: selectedShow.id });
  };

  const handleRedCarpet = () => {
    if (!selectedShow) return;
    attendRedCarpet({
      award_show_id: selectedShow.id,
      outfit_choice: outfitChoice,
      participant_type: "user",
    });
    setShowRedCarpetDialog(false);
  };

  if (showsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Music Awards</h1>
            <p className="text-muted-foreground">Compete for glory at the world's biggest music ceremonies</p>
          </div>
        </div>

        {/* Player wins summary */}
        {wins.length > 0 && (
          <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <Crown className="h-8 w-8 text-amber-400" />
              <div>
                <p className="font-semibold">{wins.length} Award{wins.length !== 1 ? 's' : ''} Won</p>
                <p className="text-sm text-muted-foreground">
                  Total fame earned: +{wins.reduce((s, w) => s + (w.fame_boost || 0), 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </header>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Star className="h-4 w-4" />
            Active ({activeShows.length})
          </TabsTrigger>
          <TabsTrigger value="wins" className="gap-2">
            <Trophy className="h-4 w-4" />
            My Wins ({wins.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Calendar className="h-4 w-4" />
            Past ({completedShows.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Shows */}
        <TabsContent value="active" className="space-y-6 mt-6">
          {activeShows.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active award shows right now. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {activeShows.map((show) => (
                <AwardShowCard
                  key={show.id}
                  show={show}
                  hasNomination={nominations.some(n => n.award_show_id === show.id)}
                  hasWin={wins.some(w => w.award_show_id === show.id)}
                  onVote={() => { setSelectedShow(show); setShowVotingDialog(true); }}
                  onRedCarpet={() => { setSelectedShow(show); setShowRedCarpetDialog(true); }}
                  onNominate={() => {
                    if (!userBand || !user) return;
                    submitNomination({
                      award_show_id: show.id,
                      category_name: (show.categories as any[])?.[0]?.name || "Best Live Act",
                      nominee_type: "band",
                      nominee_id: userBand.id,
                      nominee_name: userBand.name,
                      band_id: userBand.id,
                    });
                  }}
                  canNominate={!!userBand && show.status === 'nominations_open'}
                  canVote={show.status === 'voting_open' || show.status === 'nominations_open'}
                  canAttend={show.status === 'live'}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Wins */}
        <TabsContent value="wins" className="space-y-4 mt-6">
          {wins.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Medal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No awards won yet. Get nominated and compete to earn trophies!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {wins.map((win) => {
                const show = shows.find(s => s.id === win.award_show_id);
                return (
                  <Card key={win.id} className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        <span className="font-semibold">{win.category_name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{show?.show_name || "Award Show"}</p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-amber-500">+{win.fame_boost} fame</span>
                        {win.prize_money > 0 && <span className="text-green-500">${win.prize_money.toLocaleString()}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(win.won_at), "PPP")}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4 mt-6">
          {completedShows.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No completed award shows yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {completedShows.map(show => (
                <AwardShowCard key={show.id} show={show} compact />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Voting Dialog */}
      <Dialog open={showVotingDialog} onOpenChange={setShowVotingDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Vote - {selectedShow?.show_name}
            </DialogTitle>
            <DialogDescription>
              Cast your votes for nominees. You have {Math.max(0, 3 - voteCount)} votes remaining.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3 pr-4">
              {nominationsLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)
              ) : showNominations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No nominations yet for this show.</p>
              ) : (
                showNominations.map((nom) => (
                  <div key={nom.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{nom.nominee_name}</p>
                      <p className="text-xs text-muted-foreground">{nom.category_name}</p>
                      <div className="flex items-center gap-1 text-xs mt-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{nom.vote_count} votes</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleVote(nom.id)}
                      disabled={isVoting || voteCount >= 3}
                    >
                      <Vote className="h-4 w-4 mr-1" />
                      Vote
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Red Carpet Dialog */}
      <Dialog open={showRedCarpetDialog} onOpenChange={setShowRedCarpetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Red Carpet - {selectedShow?.show_name}
            </DialogTitle>
            <DialogDescription>
              Choose your outfit for the red carpet appearance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={outfitChoice} onValueChange={setOutfitChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Shirt className="h-4 w-4" />
                    Standard Outfit (+25 fame)
                  </div>
                </SelectItem>
                <SelectItem value="designer">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Designer Outfit (+50 fame)
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Custom Couture (+75 fame)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedCarpetDialog(false)}>Cancel</Button>
            <Button onClick={handleRedCarpet} disabled={isAttending}>
              <Sparkles className="h-4 w-4 mr-2" />
              Walk the Red Carpet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Award Show Card Component ---

interface AwardShowCardProps {
  show: AwardShow;
  hasNomination?: boolean;
  hasWin?: boolean;
  onVote?: () => void;
  onRedCarpet?: () => void;
  onNominate?: () => void;
  canNominate?: boolean;
  canVote?: boolean;
  canAttend?: boolean;
  isSubmitting?: boolean;
  compact?: boolean;
}

function AwardShowCard({
  show, hasNomination, hasWin, onVote, onRedCarpet, onNominate,
  canNominate, canVote, canAttend, isSubmitting, compact,
}: AwardShowCardProps) {
  const categories = (show.categories as any[]) || [];
  const config = statusConfig[show.status] || statusConfig.upcoming;
  const ceremonyDate = show.ceremony_date ? new Date(show.ceremony_date) : null;

  return (
    <Card className={cn(
      "flex flex-col",
      hasWin && "border-amber-500/30 bg-amber-500/5",
    )}>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={config.variant}>{config.label}</Badge>
          <div className="flex items-center gap-1">
            {Array.from({ length: show.prestige_level }, (_, i) => (
              <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
            ))}
          </div>
        </div>
        <div>
          <CardTitle className="text-xl">{show.show_name}</CardTitle>
          {show.overview && <CardDescription className="mt-1 line-clamp-2">{show.overview}</CardDescription>}
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {show.district && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {show.district}
            </span>
          )}
          {ceremonyDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(ceremonyDate, "MMM d, yyyy")}
            </span>
          )}
          {show.broadcast_partners?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {show.broadcast_partners.join(" • ")}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Categories */}
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, compact ? 3 : 6).map((cat: any, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {cat.name}
            </Badge>
          ))}
          {categories.length > (compact ? 3 : 6) && (
            <Badge variant="outline" className="text-xs">+{categories.length - (compact ? 3 : 6)} more</Badge>
          )}
        </div>

        {/* Rewards */}
        {!compact && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Attendance</p>
              <p className="font-semibold text-amber-500">+{show.attendance_fame_boost} fame</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Winner</p>
              <p className="font-semibold text-amber-500">+{show.winner_fame_boost} fame</p>
              {show.winner_prize_money > 0 && (
                <p className="text-xs text-green-500">${show.winner_prize_money.toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Status badges */}
        {(hasNomination || hasWin) && (
          <div className="flex gap-2">
            {hasNomination && <Badge variant="outline" className="gap-1"><Music className="h-3 w-3" />Nominated</Badge>}
            {hasWin && <Badge className="gap-1 bg-amber-500"><Trophy className="h-3 w-3" />Winner</Badge>}
          </div>
        )}

        {/* Action buttons */}
        {!compact && (
          <div className="flex gap-2 flex-wrap pt-2">
            {canNominate && (
              <Button size="sm" onClick={onNominate} disabled={isSubmitting || hasNomination}>
                <Music className="h-4 w-4 mr-1" />
                {hasNomination ? "Nominated" : "Nominate Band"}
              </Button>
            )}
            {canVote && (
              <Button size="sm" variant="secondary" onClick={onVote}>
                <Vote className="h-4 w-4 mr-1" />
                Vote
              </Button>
            )}
            {canAttend && (
              <Button size="sm" variant="outline" onClick={onRedCarpet}>
                <Sparkles className="h-4 w-4 mr-1" />
                Red Carpet
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}