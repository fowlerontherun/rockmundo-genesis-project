import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Film,
  Lock,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  Star,
  Clock,
  CheckCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface FilmOffersPanelProps {
  bandId: string;
  bandFame: number;
  userId: string;
}

const FILM_FAME_REQUIREMENT = 25000;
const MAX_FILMS_PER_YEAR = 2;

const filmTypeLabels: Record<string, { label: string; icon: string }> = {
  cameo: { label: "Cameo Role", icon: "🎬" },
  supporting: { label: "Supporting Role", icon: "🌟" },
  lead: { label: "Lead Role", icon: "👑" },
};

export function FilmOffersPanel({ bandId, bandFame, userId }: FilmOffersPanelProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const isFameLocked = bandFame < FILM_FAME_REQUIREMENT;
  const fameProgress = Math.min((bandFame / FILM_FAME_REQUIREMENT) * 100, 100);

  // Fetch film offers
  const { data: filmOffers, isLoading: offersLoading } = useQuery({
    queryKey: ["film-offers", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pr_media_offers")
        .select("*")
        .eq("band_id", bandId)
        .eq("media_type", "film")
        .eq("status", "pending")
        .order("proposed_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId && !isFameLocked,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch film contracts this year
  const { data: filmContracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["film-contracts", userId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_film_contracts")
        .select("*")
        .eq("user_id", userId)
        .eq("contract_year", currentYear);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const filmsThisYear = filmContracts?.filter(c => c.status !== "declined").length || 0;
  const canAcceptFilm = filmsThisYear < MAX_FILMS_PER_YEAR;

  const acceptFilmMutation = useMutation({
    mutationFn: async (offerId: string) => {
      // Create film contract
      const offer = filmOffers?.find(o => o.id === offerId);
      if (!offer) throw new Error("Offer not found");

      const proposedDate = parseISO(offer.proposed_date);
      const filmingDays = 7;
      const endDate = new Date(proposedDate);
      endDate.setDate(endDate.getDate() + filmingDays);

      const { error: contractError } = await supabase
        .from("player_film_contracts")
        .insert({
          user_id: userId,
          film_id: offer.media_outlet_id || "",
          status: "accepted",
          filming_start_date: offer.proposed_date,
          filming_end_date: endDate.toISOString().split("T")[0],
          contract_year: currentYear,
        });

      if (contractError) throw contractError;

      // Process the PR activity
      const { data, error } = await supabase.functions.invoke("process-pr-activity", {
        body: { offerId, action: "accept" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["film-offers", bandId] });
      queryClient.invalidateQueries({ queryKey: ["film-contracts", userId, currentYear] });
      queryClient.invalidateQueries({ queryKey: ["pr-stats", bandId] });
      toast.success("Film role accepted!", {
        description: "Your schedule has been blocked for filming.",
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to accept film role", { description: error.message });
    },
  });

  if (isFameLocked) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">Film Career Locked</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You need {FILM_FAME_REQUIREMENT.toLocaleString()} fame to unlock film opportunities.
          </p>
          <div className="mx-auto mt-4 max-w-md space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Fame</span>
              <span className="font-medium">{bandFame.toLocaleString()}</span>
            </div>
            <Progress value={fameProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {(FILM_FAME_REQUIREMENT - bandFame).toLocaleString()} more fame needed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Film Career Status */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Film className="h-5 w-5" />
            Film Career
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Films This Year</p>
              <p className="text-2xl font-bold">{filmsThisYear} / {MAX_FILMS_PER_YEAR}</p>
            </div>
            {!canAcceptFilm && (
              <Alert variant="destructive" className="flex-1">
                <AlertTitle>Annual Limit Reached</AlertTitle>
                <AlertDescription>
                  You can only do {MAX_FILMS_PER_YEAR} films per year. Check back next year!
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Film Offers */}
      {offersLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !filmOffers || filmOffers.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Film className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Film Offers</h3>
            <p className="text-sm text-muted-foreground">
              Film offers are rare and based on your fame. Keep growing your presence!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filmOffers.map((offer) => {
            const typeConfig = filmTypeLabels.cameo;
            const proposedDate = offer.proposed_date ? parseISO(offer.proposed_date) : null;

            return (
              <Card key={offer.id} className="bg-gradient-to-r from-amber-900/20 to-card backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeConfig.icon}</span>
                        <div>
                          <h3 className="font-semibold">Film Production</h3>
                          <p className="text-sm text-muted-foreground">
                            {typeConfig.label} • Major Studio
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {proposedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Filming: {format(proposedDate, "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          7 days
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                          <DollarSign className="mr-1 h-3 w-3" />
                          ${(offer.compensation || 0).toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          +{(offer.fame_boost || 0).toLocaleString()} Fame
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                          <Users className="mr-1 h-3 w-3" />
                          +{(offer.fan_boost || 0).toLocaleString()} Fans
                        </Badge>
                      </div>
                      <Button
                        onClick={() => acceptFilmMutation.mutate(offer.id)}
                        disabled={!canAcceptFilm || acceptFilmMutation.isPending}
                      >
                        <Star className="mr-1 h-4 w-4" />
                        {canAcceptFilm ? "Accept Role" : "Limit Reached"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Film History */}
      {contractsLoading ? null : filmContracts && filmContracts.length > 0 && (
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your Films</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filmContracts.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Film Contract</span>
                    <Badge variant={contract.status === "completed" ? "default" : "secondary"}>
                      {contract.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {contract.filming_start_date}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
