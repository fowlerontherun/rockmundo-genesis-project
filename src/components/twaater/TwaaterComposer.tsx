import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTwaats } from "@/hooks/useTwaats";
import { Send, Music, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TwaaterComposerProps {
  accountId: string;
}

export const TwaaterComposer = ({ accountId }: TwaaterComposerProps) => {
  const [body, setBody] = useState("");
  const [linkedType, setLinkedType] = useState<"single" | "album" | "gig" | "tour" | "busking" | null>(null);
  const { createTwaat, isPosting } = useTwaats();

  const handlePost = () => {
    if (!body.trim()) return;

    createTwaat({
      account_id: accountId,
      body: body.trim(),
      linked_type: linkedType || undefined,
      visibility: "public",
    });

    setBody("");
    setLinkedType(null);
  };

  const charCount = body.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Textarea
          placeholder="What's happening in your music journey?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[120px] resize-none"
          disabled={isPosting}
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={linkedType === "single" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLinkedType(linkedType === "single" ? null : "single")}
            >
              <Music className="h-4 w-4 mr-1" />
              Single
            </Button>
            <Button
              variant={linkedType === "album" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLinkedType(linkedType === "album" ? null : "album")}
            >
              <Music className="h-4 w-4 mr-1" />
              Album
            </Button>
            <Button
              variant={linkedType === "gig" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLinkedType(linkedType === "gig" ? null : "gig")}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Gig
            </Button>
            <Button
              variant={linkedType === "tour" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLinkedType(linkedType === "tour" ? null : "tour")}
            >
              <MapPin className="h-4 w-4 mr-1" />
              Tour
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount}/{maxChars}
            </span>
            <Button
              onClick={handlePost}
              disabled={isPosting || !body.trim() || isOverLimit}
            >
              <Send className="h-4 w-4 mr-2" />
              Post
            </Button>
          </div>
        </div>

        {linkedType && (
          <Badge variant="secondary" className="gap-1">
            {linkedType === "single" && <Music className="h-3 w-3" />}
            {linkedType === "album" && <Music className="h-3 w-3" />}
            {linkedType === "gig" && <Calendar className="h-3 w-3" />}
            {linkedType === "tour" && <MapPin className="h-3 w-3" />}
            Linked to {linkedType} (+2 XP bonus!)
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
