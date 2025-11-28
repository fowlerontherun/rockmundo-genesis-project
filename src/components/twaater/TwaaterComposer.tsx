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

  const handlePost = async () => {
    if (!body.trim()) return;

    // Rate limit check happens in backend
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
    <div className="space-y-3">
      <Textarea
        placeholder="What's happening in your music journey?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0 text-lg bg-transparent"
        disabled={isPosting}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLinkedType(linkedType === "single" ? null : "single")}
            className={`h-8 ${linkedType === "single" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Single</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLinkedType(linkedType === "album" ? null : "album")}
            className={`h-8 ${linkedType === "album" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Album</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLinkedType(linkedType === "gig" ? null : "gig")}
            className={`h-8 ${linkedType === "gig" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Gig</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLinkedType(linkedType === "tour" ? null : "tour")}
            className={`h-8 ${linkedType === "tour" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Tour</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount > 450 && `${charCount}/${maxChars}`}
          </span>
          <Button
            onClick={handlePost}
            disabled={isPosting || !body.trim() || isOverLimit}
            size="sm"
            className="rounded-full h-9 px-4 font-bold"
            style={{ backgroundColor: 'hsl(var(--twaater-purple))', color: 'white' }}
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>

      {linkedType && (
        <Badge variant="secondary" className="gap-1 text-xs" style={{ backgroundColor: 'hsl(var(--twaater-purple) / 0.2)', color: 'hsl(var(--twaater-purple))' }}>
          {linkedType === "single" && <Music className="h-3 w-3" />}
          {linkedType === "album" && <Music className="h-3 w-3" />}
          {linkedType === "gig" && <Calendar className="h-3 w-3" />}
          {linkedType === "tour" && <MapPin className="h-3 w-3" />}
          Linked: {linkedType} (+2 XP)
        </Badge>
      )}
    </div>
  );
};
