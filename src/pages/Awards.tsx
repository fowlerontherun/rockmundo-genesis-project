import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useAwards } from "@/hooks/useAwards";
import { 
  Award as AwardIcon, 
  Trophy, 
  Vote, 
  Mic, 
  Camera, 
  Star,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  Crown,
  ThumbsUp
} from "lucide-react";
import { format } from "date-fns";

export default function Awards() {
  const { profile } = useGameData();
  const { data: bandData } = usePrimaryBand();
  const band = bandData?.bands;
  const userId = profile?.user_id;

  const { 
    shows, 
    showsLoading, 
    nominations, 
    nominationsLoading,
    wins,
    winsLoading,
    submitNomination,
    castVote,
    bookPerformance,
    attendRedCarpet,
    isSubmitting,
    isVoting,
    isBooking,
    isAttending 
  } = useAwards(userId, band?.id);

  const [selectedShow, setSelectedShow] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [nomineeType, setNomineeType] = useState<string>("song");
  const [nomineeId, setNomineeId] = useState<string>("");
  const [nomineeName, setNomineeName] = useState<string>("");
  const [submissionNotes, setSubmissionNotes] = useState<string>("");
  const [outfitChoice, setOutfitChoice] = useState<string>("casual");

  const handleSubmitNomination = () => {
    if (!selectedShow || !selectedCategory || !nomineeName) {
      return;
    }

    submitNomination({
      award_show_id: selectedShow,
      category_name: selectedCategory,
      nominee_type: nomineeType,
      nominee_id: nomineeId || nomineeName,
      nominee_name: nomineeName,
      band_id: band?.id,
      submission_data: { notes: submissionNotes },
    });

    // Reset form
    setSelectedCategory("");
    setNomineeName("");
    setSubmissionNotes("");
  };

  const handleVote = (nominationId: string) => {
    castVote({ nomination_id: nominationId });
  };

  const handleRedCarpet = (showId: string) => {
    attendRedCarpet({
      award_show_id: showId,
      outfit_choice: outfitChoice,
      participant_type: band ? "band" : "user",
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: "bg-slate-500",
      nominations_open: "bg-blue-500",
      voting_open: "bg-purple-500",
      completed: "bg-slate-400",
    };
    return <Badge className={colors[status] || "bg-slate-500"}>{status.replace(/_/g, " ")}</Badge>;
  };

  const getNominationStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      shortlisted: "bg-blue-500",
      winner: "bg-success",
      rejected: "bg-destructive",
    };
    return <Badge className={colors[status] || "bg-slate-500"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AwardIcon className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Awards</h1>
            <p className="text-muted-foreground">
              Compete for prestigious industry recognition
            </p>
          </div>
        </div>
        {wins.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Wins</div>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-amber-500" />
              {wins.length}
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="shows" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shows">
            <Calendar className="h-4 w-4 mr-2" />
            Award Shows
          </TabsTrigger>
          <TabsTrigger value="nominations">
            <Vote className="h-4 w-4 mr-2" />
            My Nominations ({nominations.length})
          </TabsTrigger>
          <TabsTrigger value="trophy-case">
            <Trophy className="h-4 w-4 mr-2" />
            Trophy Case ({wins.length})
          </TabsTrigger>
          <TabsTrigger value="voting">
            <ThumbsUp className="h-4 w-4 mr-2" />
            Vote
          </TabsTrigger>
        </TabsList>

        {/* Award Shows Tab */}
        <TabsContent value="shows" className="space-y-4">
          {showsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading award shows...</div>
          ) : shows.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No award shows available at the moment.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {shows.map((show) => (
                <Card key={show.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-2xl">{show.show_name}</CardTitle>
                          {getStatusBadge(show.status)}
                        </div>
                        <CardDescription>{show.overview}</CardDescription>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {show.venue}, {show.district}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {show.year}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Schedule */}
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Schedule
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {Object.entries(show.schedule || {}).map(([key, value]) => (
                          <div key={key} className="p-2 bg-muted rounded">
                            <div className="text-muted-foreground capitalize text-xs">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="font-medium">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Categories */}
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Categories ({show.categories?.length || 0})
                      </h3>
                      <div className="grid gap-2">
                        {(show.categories || []).map((category: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="font-medium">{category.name}</div>
                            <div className="text-sm text-muted-foreground">{category.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {show.status === "nominations_open" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button onClick={() => setSelectedShow(show.id)}>
                              <Vote className="h-4 w-4 mr-2" />
                              Submit Nomination
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Submit Nomination</DialogTitle>
                              <DialogDescription>
                                Nominate your work for {show.show_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Category</Label>
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(show.categories || []).map((cat: any, idx: number) => (
                                      <SelectItem key={idx} value={cat.name}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Nominee Type</Label>
                                <Select value={nomineeType} onValueChange={setNomineeType}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="song">Song</SelectItem>
                                    <SelectItem value="album">Album</SelectItem>
                                    <SelectItem value="band">Band</SelectItem>
                                    <SelectItem value="performance">Performance</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Nominee Name</Label>
                                <input
                                  className="w-full p-2 border rounded"
                                  value={nomineeName}
                                  onChange={(e) => setNomineeName(e.target.value)}
                                  placeholder="Enter name of song/album/etc."
                                />
                              </div>

                              <div>
                                <Label>Submission Notes (Optional)</Label>
                                <Textarea
                                  value={submissionNotes}
                                  onChange={(e) => setSubmissionNotes(e.target.value)}
                                  placeholder="Tell us why this should win..."
                                />
                              </div>

                              <Button 
                                onClick={handleSubmitNomination} 
                                disabled={isSubmitting || !selectedCategory || !nomineeName}
                                className="w-full"
                              >
                                Submit Nomination
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {show.status === "upcoming" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <Camera className="h-4 w-4 mr-2" />
                              Red Carpet RSVP
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Red Carpet Appearance</DialogTitle>
                              <DialogDescription>
                                Make a statement at {show.show_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Outfit Choice</Label>
                                <Select value={outfitChoice} onValueChange={setOutfitChoice}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="casual">Casual (+25 fame)</SelectItem>
                                    <SelectItem value="designer">Designer (+50 fame)</SelectItem>
                                    <SelectItem value="custom">Custom Couture (+75 fame)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button 
                                onClick={() => handleRedCarpet(show.id)}
                                disabled={isAttending}
                                className="w-full"
                              >
                                Confirm Attendance
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {(show.performance_slots || []).length > 0 && band && (
                        <Button variant="outline">
                          <Mic className="h-4 w-4 mr-2" />
                          Book Performance Slot
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Nominations Tab */}
        <TabsContent value="nominations" className="space-y-4">
          {nominationsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading nominations...</div>
          ) : nominations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Vote className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't submitted any nominations yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check the Award Shows tab to submit nominations when voting opens!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {nominations.map((nomination) => (
                <Card key={nomination.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{nomination.nominee_name}</CardTitle>
                        <CardDescription>{nomination.category_name}</CardDescription>
                      </div>
                      {getNominationStatusBadge(nomination.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="capitalize">{nomination.nominee_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Votes:</span>
                        <span className="font-semibold">{nomination.vote_count}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Submitted:</span>
                        <span>{format(new Date(nomination.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>

                    {nomination.status === "winner" && (
                      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Crown className="h-5 w-5" />
                          <span className="font-semibold">Winner!</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trophy Case Tab */}
        <TabsContent value="trophy-case" className="space-y-4">
          {winsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading trophy case...</div>
          ) : wins.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your trophy case is empty.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Submit nominations and campaign for votes to win awards!
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Trophy className="h-12 w-12 mx-auto mb-2 text-amber-500" />
                      <div className="text-3xl font-bold">{wins.length}</div>
                      <div className="text-sm text-muted-foreground">Total Awards</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Sparkles className="h-12 w-12 mx-auto mb-2 text-primary" />
                      <div className="text-3xl font-bold">
                        {wins.reduce((sum, win) => sum + (win.fame_boost || 0), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Fame Gained</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Star className="h-12 w-12 mx-auto mb-2 text-success" />
                      <div className="text-3xl font-bold">
                        ${wins.reduce((sum, win) => sum + (win.prize_money || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Prize Money</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trophies */}
              <div className="grid gap-4">
                {wins.map((win) => (
                  <Card key={win.id} className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Trophy className="h-12 w-12 text-amber-500 flex-shrink-0" />
                        <div className="flex-1">
                          <CardTitle>{win.category_name}</CardTitle>
                          <CardDescription className="text-lg font-semibold text-foreground mt-1">
                            {win.winner_name}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Won At</div>
                          <div className="font-medium">{format(new Date(win.won_at), "MMM d, yyyy")}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Fame Boost</div>
                          <div className="font-medium text-primary">+{win.fame_boost}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Prize Money</div>
                          <div className="font-medium text-success">${win.prize_money?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Show</div>
                          <div className="font-medium capitalize">{win.award_show_id}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Voting Tab */}
        <TabsContent value="voting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cast Your Votes</CardTitle>
              <CardDescription>
                Support your favorite nominees in active voting windows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-12 text-muted-foreground">
                Voting interface coming soon! Check back when voting opens.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
