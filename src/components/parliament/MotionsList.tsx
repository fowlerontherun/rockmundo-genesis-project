import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCastParliamentVote, useMotionVotes, useMyMayorSeat, useParliamentMotions } from "@/hooks/useParliament";
import { MOTION_STATUS_COLOURS, MOTION_TYPE_LABELS } from "@/types/parliament";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, ThumbsDown, MinusCircle } from "lucide-react";

export function MotionsList() {
  const { data: motions, isLoading } = useParliamentMotions("open");
  const { data: seat } = useMyMayorSeat();
  const cast = useCastParliamentVote();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading motions…</p>;
  if (!motions || motions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No open motions on the floor right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {motions.map((m) => {
        const total = m.yes_votes + m.no_votes + m.abstain_votes;
        const yesPct = total ? (m.yes_votes / total) * 100 : 0;
        return (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={MOTION_STATUS_COLOURS[m.status]}>
                      {m.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {MOTION_TYPE_LABELS[m.motion_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Closes {formatDistanceToNow(new Date(m.voting_closes_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Yes {m.yes_votes}</span>
                  <span>No {m.no_votes}</span>
                  <span>Abstain {m.abstain_votes}</span>
                </div>
                <Progress value={yesPct} />
              </div>
              {seat?.id && m.status === "open" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => cast.mutate({ motionId: m.id, vote: "yes" })}>
                    <ThumbsUp className="h-4 w-4 mr-1" /> Yes
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => cast.mutate({ motionId: m.id, vote: "no" })}>
                    <ThumbsDown className="h-4 w-4 mr-1" /> No
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cast.mutate({ motionId: m.id, vote: "abstain" })}>
                    <MinusCircle className="h-4 w-4 mr-1" /> Abstain
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
