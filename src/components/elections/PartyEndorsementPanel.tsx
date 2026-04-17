import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Award, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMyParty } from "@/hooks/useParties";
import {
  useElectionEndorsements,
  useEndorseCandidate,
  useRevokeEndorsement,
} from "@/hooks/usePartyEndorsements";
import type { CityCandidate } from "@/types/city-governance";

interface Props {
  electionId: string;
  candidates: CityCandidate[];
}

/**
 * Party endorsement panel for a city election.
 * Public: shows current endorsements list.
 * Founders/officers of an active party: can endorse a candidate or revoke.
 */
export function PartyEndorsementPanel({ electionId, candidates }: Props) {
  const { data: endorsements } = useElectionEndorsements(electionId);
  const { data: myParty } = useMyParty();
  const endorse = useEndorseCandidate();
  const revoke = useRevokeEndorsement();

  const canEndorse =
    !!myParty?.party_id && (myParty.role === "founder" || myParty.role === "officer");
  const myEndorsement = endorsements?.find((e) => e.party_id === myParty?.party_id);

  const [candidateId, setCandidateId] = useState<string>("");
  const [statement, setStatement] = useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" /> Party Endorsements ({endorsements?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!endorsements || endorsements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parties have endorsed yet.</p>
        ) : (
          <ul className="space-y-2">
            {endorsements.map((e) => {
              const cand = candidates.find((c) => c.id === e.candidate_id);
              return (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 p-2 rounded-md border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.party && (
                        <span
                          className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: e.party.colour_hex }}
                        />
                      )}
                      <span className="text-sm font-semibold truncate">
                        {e.party?.name ?? "Unknown party"}
                      </span>
                      <span className="text-xs text-muted-foreground">endorses</span>
                      <Badge variant="outline" className="text-xs">
                        {cand?.profile?.stage_name ?? "candidate"}
                      </Badge>
                    </div>
                    {e.statement && (
                      <p className="text-xs italic mt-1 line-clamp-2">"{e.statement}"</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canEndorse && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Endorsing as <span className="font-semibold">{myParty!.party.name}</span> — you can
              switch your endorsement at any time, but each party may only endorse one candidate per
              election.
            </p>

            {myEndorsement ? (
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                <span className="text-xs">
                  Currently endorsing{" "}
                  <span className="font-semibold">
                    {candidates.find((c) => c.id === myEndorsement.candidate_id)?.profile
                      ?.stage_name ?? "—"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate({ party_id: myParty!.party_id, election_id: electionId })
                  }
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Revoke
                </Button>
              </div>
            ) : null}

            <div>
              <Label className="text-xs">Endorse candidate</Label>
              <Select value={candidateId} onValueChange={setCandidateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a candidate…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates
                    .filter((c) => c.status === "approved" || c.status === "pending")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.profile?.stage_name ?? "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Statement (optional)</Label>
              <Textarea
                rows={2}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Why your party supports this candidate…"
              />
            </div>
            <Button
              size="sm"
              disabled={endorse.isPending || !candidateId}
              onClick={() =>
                endorse.mutate(
                  {
                    party_id: myParty!.party_id,
                    candidate_id: candidateId,
                    election_id: electionId,
                    statement: statement.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setStatement("");
                    },
                  },
                )
              }
            >
              {endorse.isPending
                ? "Endorsing…"
                : myEndorsement
                ? "Switch Endorsement"
                : "Issue Endorsement"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
