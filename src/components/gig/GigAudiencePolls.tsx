import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Vote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type Option = { key: string; label: string };
type Poll = { id: string; poll_type: string; question: string; options: Option[]; status: string; winning_option: string | null; vote_count: number; crowd_effect: number };
type VoteRow = { poll_id: string; profile_id: string; option_key: string };

const db = supabase as any;

/** Crowd polls for a gig. `canVote` is false for band members (they see live results only). */
export function GigAudiencePolls({ gigId, gigStatus, canVote }: { gigId: string; gigStatus?: string | null; canVote: boolean }) {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const qc = useQueryClient();
  const key = ["gig-audience-polls", gigId];

  useEffect(() => {
    if (gigStatus === "in_progress") void db.rpc("ensure_gig_audience_polls", { p_gig_id: gigId }).then(() => qc.invalidateQueries({ queryKey: key }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, gigStatus]);

  const q = useQuery({
    queryKey: key,
    refetchInterval: gigStatus === "in_progress" ? 15_000 : false,
    queryFn: async () => {
      const { data: polls, error } = await db.from("gig_audience_polls").select("id,poll_type,question,options,status,winning_option,vote_count,crowd_effect").eq("gig_id", gigId).order("poll_type");
      if (error) throw error;
      const ids = (polls ?? []).map((p: Poll) => p.id);
      const { data: votes } = ids.length ? await db.from("gig_audience_poll_votes").select("poll_id,profile_id,option_key").in("poll_id", ids) : { data: [] };
      return { polls: (polls ?? []) as Poll[], votes: (votes ?? []) as VoteRow[] };
    },
  });

  const vote = async (poll: Poll, option: string) => {
    const { error } = await db.rpc("submit_gig_audience_poll_vote", { p_poll_id: poll.id, p_option_key: option });
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: key });
  };

  const polls = q.data?.polls ?? [];
  if (polls.length === 0) return null;
  const totalEffect = polls.reduce((s, p) => s + Number(p.crowd_effect || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Vote className="h-4 w-4 text-primary" /> Crowd polls</CardTitle>
        <p className="text-[11px] text-muted-foreground">More voters and a hungry encore crowd lift the gig rating. A chilled-out crowd lowers it.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {polls.map((poll) => {
          const votes = (q.data?.votes ?? []).filter((v) => v.poll_id === poll.id);
          const mine = votes.find((v) => v.profile_id === profileId)?.option_key;
          const total = poll.status === "closed" ? poll.vote_count : votes.length;
          return (
            <div key={poll.id} className="space-y-1.5 rounded border p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{poll.question}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{poll.status === "open" ? `${total} votes` : "Closed"}</Badge>
              </div>
              {poll.options.map((o) => {
                const n = votes.filter((v) => v.option_key === o.key).length;
                const pct = total ? Math.round((n / total) * 100) : 0;
                const open = poll.status === "open" && canVote;
                return (
                  <div key={o.key} className="flex items-center gap-2">
                    <Button size="sm" variant={mine === o.key ? "default" : "outline"} className="h-7 w-40 justify-start text-[11px]" disabled={!open} onClick={() => void vote(poll, o.key)}>
                      {o.label}{poll.winning_option === o.key ? " ★" : ""}
                    </Button>
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="w-8 text-right text-[10px] text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
              {poll.status === "closed" && (
                <p className="text-[10px] text-muted-foreground">Crowd effect: {Number(poll.crowd_effect) >= 0 ? "+" : ""}{(Number(poll.crowd_effect) * 100).toFixed(1)}% rating</p>
              )}
            </div>
          );
        })}
        {polls.every((p) => p.status === "closed") && (
          <p className="font-medium">Total crowd effect on the gig: {totalEffect >= 0 ? "+" : ""}{(Math.max(-0.03, Math.min(0.08, totalEffect)) * 100).toFixed(1)}%</p>
        )}
        {!canVote && polls.some((p) => p.status === "open") && <p className="text-[10px] text-muted-foreground">You're playing this gig — only the audience can vote.</p>}
      </CardContent>
    </Card>
  );
}
