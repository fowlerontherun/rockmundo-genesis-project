import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTwaaterReactions } from "@/hooks/useTwaaterReactions";
import { useTwaaterModeration } from "@/hooks/useTwaaterModeration";
import { useTwaaterFollow } from "@/hooks/useTwaaterFollow";
import { useTwaaterReplies } from "@/hooks/useTwaaterReplies";
import { useTwaaterBookmarks } from "@/hooks/useTwaaterBookmarks";
import { TwaatPoll } from "./TwaatPoll";
import { QuotedTwaat } from "./QuotedTwaat";
import { Heart, MessageCircle, Repeat2, MoreHorizontal, Flag, UserX, Bookmark, BookmarkCheck, Quote, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TwaatCardProps {
  twaat: any;
  viewerAccountId?: string;
}

export const TwaatCard = ({ twaat, viewerAccountId }: TwaatCardProps) => {
  const { toggleLike, toggleRetwaat } = useTwaaterReactions();
  const { blockAccount } = useTwaaterModeration();
  const { followAccount, unfollowAccount } = useTwaaterFollow(viewerAccountId);
  const { postReply, isPosting } = useTwaaterReplies(twaat.id);
  const { toggleBookmark, isBookmarked } = useTwaaterBookmarks(viewerAccountId);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const navigate = useNavigate();

  const handleReply = () => {
    if (!replyBody.trim() || !viewerAccountId) return;
    postReply({ accountId: viewerAccountId, body: replyBody.trim() });
    setReplyBody("");
    setShowReplyBox(false);
  };

  const makeHashtagsClickable = (text: string) => {
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        const hashtag = part.slice(1);
        return (
          <span key={i} onClick={(e) => { e.stopPropagation(); navigate(`/twaater/tag/${hashtag}`); }} className="text-primary hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/twaater/${twaat.account.handle}`)}>
              {twaat.account.display_name}
            </span>
            {twaat.account.verified && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
            <span className="text-muted-foreground text-sm">@{twaat.account.handle}</span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(twaat.created_at), { addSuffix: true })}</span>
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{makeHashtagsClickable(twaat.body)}</p>
          
          {twaat.media_url && <img src={twaat.media_url} alt="Twaat media" className="mt-3 rounded-lg max-h-96 object-cover border" />}
          {twaat.quoted_twaat_id && <QuotedTwaat twaat={twaat.quoted_twaat} />}
          <TwaatPoll twaatId={twaat.id} accountId={viewerAccountId} />

          <div className="flex items-center gap-4 mt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowReplyBox(!showReplyBox)} disabled={!viewerAccountId}>
              <MessageCircle className="h-4 w-4" />
              <span className="ml-1">{twaat.metrics?.replies || 0}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={!viewerAccountId}>
                  <Repeat2 className="h-4 w-4" />
                  <span className="ml-1">{twaat.metrics?.retwaats || 0}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toggleRetwaat({ twaatId: twaat.id, accountId: viewerAccountId! })}>
                  <Repeat2 className="h-4 w-4 mr-2" />Retwaat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { sessionStorage.setItem('quoteTwaat', JSON.stringify(twaat)); navigate('/twaater'); }}>
                  <Quote className="h-4 w-4 mr-2" />Quote Twaat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={() => toggleLike({ twaatId: twaat.id, accountId: viewerAccountId! })} disabled={!viewerAccountId}>
              <Heart className="h-4 w-4" />
              <span className="ml-1">{twaat.metrics?.likes || 0}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => toggleBookmark({ twaatId: twaat.id })} disabled={!viewerAccountId}>
              {isBookmarked(twaat.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
          </div>

          {showReplyBox && (
            <div className="mt-3 space-y-2">
              <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Post your reply..." rows={3} />
              <div className="flex gap-2">
                <Button onClick={handleReply} disabled={isPosting || !replyBody.trim()} size="sm">Reply</Button>
                <Button onClick={() => setShowReplyBox(false)} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};