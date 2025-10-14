import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle } from "lucide-react";
import { useTwaaterReplies } from "@/hooks/useTwaaterReplies";

interface TwaatReplyDialogProps {
  twaatId: string;
  accountId: string;
  replyCount: number;
}

export const TwaatReplyDialog = ({ twaatId, accountId, replyCount }: TwaatReplyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const { replies, isLoading, postReply, isPosting } = useTwaaterReplies(twaatId);

  const handleSubmit = () => {
    if (!replyBody.trim()) return;
    postReply({ accountId, body: replyBody.trim() });
    setReplyBody("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <MessageCircle className="h-4 w-4 mr-1" />
          {replyCount}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replies</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reply composer */}
          <div className="space-y-2">
            <Textarea
              placeholder="Post your reply..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="min-h-[80px]"
              disabled={isPosting}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!replyBody.trim() || isPosting}
                size="sm"
              >
                {isPosting ? "Posting..." : "Reply"}
              </Button>
            </div>
          </div>

          {/* Replies list */}
          <div className="space-y-3 border-t pt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center">Loading replies...</p>
            ) : replies && replies.length > 0 ? (
              replies.map((reply: any) => (
                <div key={reply.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm">{reply.account.display_name}</span>
                    <span className="text-xs text-muted-foreground">@{reply.account.handle}</span>
                    {reply.account.verified && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </div>
                  <p className="text-sm">{reply.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(reply.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No replies yet. Be the first to reply!
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
