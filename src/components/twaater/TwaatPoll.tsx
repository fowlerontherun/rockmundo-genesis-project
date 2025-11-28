import { useTwaaterPolls } from "@/hooks/useTwaaterPolls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2 } from "lucide-react";

interface TwaatPollProps {
  twaatId: string;
  accountId?: string;
}

export const TwaatPoll = ({ twaatId, accountId }: TwaatPollProps) => {
  const { poll, userVote, isLoading, vote, isVoting } = useTwaaterPolls(twaatId);

  if (isLoading || !poll) return null;

  const totalVotes = poll.options?.reduce((sum: number, opt: any) => sum + opt.vote_count, 0) || 0;
  const isExpired = new Date(poll.expires_at) < new Date();
  const hasVoted = !!userVote;

  return (
    <Card className="p-4 mt-3">
      <h4 className="font-semibold mb-3">{poll.question}</h4>
      <div className="space-y-2">
        {poll.options?.map((option: any) => {
          const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          const isSelected = userVote?.option_id === option.id;

          return (
            <div key={option.id}>
              {hasVoted || isExpired ? (
                <div className="relative">
                  <div 
                    className="absolute inset-0 bg-primary/20 rounded transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      <span>{option.option_text}</span>
                    </div>
                    <span className="font-semibold">{percentage}%</span>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => vote({ optionId: option.id })}
                  disabled={isVoting || !accountId}
                >
                  {option.option_text}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        <span>
          {isExpired 
            ? 'Poll closed' 
            : `Closes ${formatDistanceToNow(new Date(poll.expires_at), { addSuffix: true })}`
          }
        </span>
      </div>
    </Card>
  );
};