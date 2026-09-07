import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFestivalEditionArtistAction } from "../application/useFestivalArtistWorkflows";
import { parseFestivalArtistCandidates, type FestivalArtistCandidate } from "../domain/festivalArtistWorkflows";
import { formatMinorMoney } from "../domain/festivalTicketPlan";

const rpc = supabase.rpc.bind(supabase) as any;
const DAY_MS = 24 * 60 * 60 * 1000;

export function FestivalAdvancedArtistSearch({
  festivalCompanyId,
  festivalEditionId,
  festivalDates,
  currencyCode,
  preferredGenres,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
  festivalDates: string[];
  currencyCode: string;
  preferredGenres: string[];
}) {
  const [query, setQuery] = useState("");
  const [artistType, setArtistType] = useState("band");
  const [genre, setGenre] = useState("all");
  const [minimumFame, setMinimumFame] = useState("");
  const [maximumFame, setMaximumFame] = useState("");
  const [feeByArtist, setFeeByArtist] = useState<Record<string, string>>({});
  const invite = useFestivalEditionArtistAction("sendInvitation");

  const candidates = useQuery({
    queryKey: ["festival-advanced-artist-search", festivalCompanyId, festivalEditionId, query, artistType, genre, minimumFame, maximumFame],
    queryFn: async () => {
      const { data, error } = await rpc("search_festival_edition_artist_candidates", {
        p_festival_company_id: festivalCompanyId,
        p_festival_edition_id: festivalEditionId,
        p_query: query || null,
        p_artist_type: artistType === "all" ? null : artistType,
        p_genres: genre === "all" ? [] : [genre],
        p_minimum_fame: minimumFame === "" ? null : Math.max(0, Number(minimumFame)),
        p_maximum_fame: maximumFame === "" ? null : Math.max(0, Number(maximumFame)),
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return parseFestivalArtistCandidates(data);
    },
    retry: false,
  });

  const genres = useMemo(() => {
    const values = new Set(preferredGenres.filter(Boolean));
    for (const candidate of candidates.data?.items ?? []) {
      for (const value of candidate.genres) if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [candidates.data?.items, preferredGenres]);

  const suggestedFee = (candidate: FestivalArtistCandidate) =>
    Math.round((candidate.estimatedFeeMinimumMinor + candidate.estimatedFeeMaximumMinor) / 2);

  const inviteCandidate = async (candidate: FestivalArtistCandidate) => {
    const key = candidate.identity.type === "band" ? candidate.identity.bandId : candidate.identity.type === "solo" ? candidate.identity.artistProfileId : candidate.identity.npcArtistId;
    const feeMajor = Number(feeByArtist[key] ?? suggestedFee(candidate) / 100);
    const now = Date.now();
    const festivalStart = festivalDates[0] ? new Date(`${festivalDates[0]}T12:00:00Z`).getTime() : now + 30 * DAY_MS;
    const deadline = new Date(Math.max(now + DAY_MS, Math.min(now + 14 * DAY_MS, festivalStart - DAY_MS))).toISOString();
    try {
      await invite.mutateAsync({
        festivalCompanyId,
        festivalEditionId,
        identity: candidate.identity,
        suggestedFeeMinor: Math.max(0, Math.round((Number.isFinite(feeMajor) ? feeMajor : 0) * 100)),
        suggestedSetMinutes: 60,
        suggestedDates: festivalDates[0] ? [festivalDates[0]] : [],
        responseDeadline: deadline,
        message: "We would like to invite you to perform at this year's Festival.",
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(`Invitation sent to ${candidate.displayName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Festival invitation could not be sent");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Advanced band & artist search</CardTitle>
        <CardDescription>
          Search all active acts and filter by type, genre and fame before sending an invitation. Existing invitations, offers and bookings are clearly marked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search band or artist name" className="pl-9" />
          </div>
          <Select value={artistType} onValueChange={setArtistType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="band">Bands</SelectItem>
              <SelectItem value="solo">Solo artists</SelectItem>
              <SelectItem value="all">All player acts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger><SelectValue placeholder="All genres" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genres</SelectItem>
              {genres.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min={0} value={minimumFame} onChange={(event) => setMinimumFame(event.target.value)} placeholder="Min fame" />
            <Input type="number" min={0} value={maximumFame} onChange={(event) => setMaximumFame(event.target.value)} placeholder="Max fame" />
          </div>
        </div>

        {candidates.isLoading ? <p className="text-sm text-muted-foreground">Searching active acts…</p> : null}
        {candidates.isError ? <p className="text-sm text-destructive">The filtered artist search could not be loaded.</p> : null}
        {!candidates.isLoading && !candidates.isError && (candidates.data?.items.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No active acts match these filters.</p>
        ) : null}

        <div className="space-y-2">
          {(candidates.data?.items ?? []).map((candidate) => {
            const key = candidate.identity.type === "band" ? candidate.identity.bandId : candidate.identity.type === "solo" ? candidate.identity.artistProfileId : candidate.identity.npcArtistId;
            const fee = feeByArtist[key] ?? String(suggestedFee(candidate) / 100);
            return (
              <div key={`${candidate.identity.type}:${key}`} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1fr)_11rem_auto] lg:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{candidate.displayName}</strong>
                    <Badge variant="secondary" className="capitalize">{candidate.identity.type}</Badge>
                    <Badge variant={candidate.relationshipState === "none" ? "outline" : "secondary"} className="capitalize">{candidate.relationshipState}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fame {candidate.fame}{candidate.genres.length ? ` · ${candidate.genres.join(", ")}` : ""} · suggested {formatMinorMoney(suggestedFee(candidate), currencyCode)}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Offer ({currencyCode})</label>
                  <Input type="number" min={0} value={fee} disabled={candidate.relationshipState !== "none"} onChange={(event) => setFeeByArtist((current) => ({ ...current, [key]: event.target.value }))} />
                </div>
                <Button size="sm" variant="outline" disabled={invite.isPending || candidate.relationshipState !== "none"} onClick={() => void inviteCandidate(candidate)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Invite
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
