import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTwaats } from "@/hooks/useTwaats";
import { Music, Calendar, X, Disc, Route, Hash, BarChart3, Globe2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TwaatMediaUpload } from "./TwaatMediaUpload";
import { QuotedTwaat } from "./QuotedTwaat";
import { LinkSongDialog } from "./LinkSongDialog";
import { LinkReleaseDialog } from "./LinkReleaseDialog";
import { LinkGigDialog } from "./LinkGigDialog";
import { LinkTourDialog } from "./LinkTourDialog";
import { TwaaterPollCreator } from "./TwaaterPollCreator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/components/ui/use-toast";

interface TwaaterComposerProps {
  accountId: string;
}

type PollDraft = {
  question: string;
  options: string[];
  durationHours: number;
};

const generateLinkText = (type: string, title: string, extra?: { venue?: string; city?: string }): string => {
  switch (type) {
    case "single":
      return `Check out my new single "${title}"! 🎵 `;
    case "album":
      return `My new album "${title}" is here! 🎶 `;
    case "gig":
      if (extra?.venue && extra?.city) return `Catch us live at ${extra.venue}, ${extra.city}! 📅 `;
      if (extra?.venue) return `Catch us live at ${extra.venue}! 📅 `;
      return "We're playing live soon! 📅 ";
    case "tour":
      return `We're hitting the road! ${title} tour is coming! 🎸 `;
    default:
      return "";
  }
};

const formatBandHashtag = (bandName: string): string => {
  return "#" + bandName
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
};

export const TwaaterComposer = ({ accountId }: TwaaterComposerProps) => {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [linkedType, setLinkedType] = useState<"single" | "album" | "gig" | "tour" | "busking" | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkedTitle, setLinkedTitle] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [quotedTwaat, setQuotedTwaat] = useState<any>(null);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const { createTwaatAsync, isPosting } = useTwaats();

  const [showSongDialog, setShowSongDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showGigDialog, setShowGigDialog] = useState(false);
  const [showTourDialog, setShowTourDialog] = useState(false);

  const { data: userBands = [] } = useQuery({
    queryKey: ["user-bands-for-twaater", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("band_members")
        .select("band_id, bands:bands(id, name)")
        .eq("profile_id", profileId)
        .eq("member_status", "active");

      if (error) throw error;
      return data?.map((membership: any) => membership.bands).filter(Boolean) || [];
    },
    enabled: !!profileId,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem("quoteTwaat");
    if (!stored) return;
    try {
      setQuotedTwaat(JSON.parse(stored));
    } catch {
      // Ignore a stale/corrupt quote draft.
    } finally {
      sessionStorage.removeItem("quoteTwaat");
    }
  }, []);

  const resetComposer = () => {
    setBody("");
    setLinkedType(null);
    setLinkedId(null);
    setLinkedTitle(null);
    setMediaUrl("");
    setMediaType(null);
    setQuotedTwaat(null);
    setVisibility("public");
    setPollDraft(null);
  };

  const createPoll = async (twaatId: string, draft: PollDraft) => {
    const expiresAt = new Date(Date.now() + draft.durationHours * 60 * 60 * 1000).toISOString();
    const { data: poll, error: pollError } = await supabase
      .from("twaater_polls")
      .insert({ twaat_id: twaatId, question: draft.question, expires_at: expiresAt })
      .select("id")
      .single();

    if (pollError) throw pollError;

    const { error: optionsError } = await supabase
      .from("twaater_poll_options")
      .insert(draft.options.map((option, index) => ({
        poll_id: poll.id,
        option_text: option,
        display_order: index,
      })));

    if (optionsError) throw optionsError;
  };

  const handlePost = async () => {
    if (!body.trim()) return;

    try {
      const twaat = await createTwaatAsync({
        account_id: accountId,
        body: body.trim(),
        linked_type: linkedType || undefined,
        linked_id: linkedId || undefined,
        visibility,
        media_url: mediaUrl || undefined,
        media_type: mediaType || undefined,
        quoted_twaat_id: quotedTwaat?.id || undefined,
      });

      if (pollDraft) {
        try {
          await createPoll(twaat.id, pollDraft);
        } catch (error: any) {
          toast({
            title: "Twaat posted, poll failed",
            description: error?.message || "The post is live but the poll could not be attached.",
            variant: "destructive",
          });
        }
      }

      resetComposer();
    } catch {
      // Mutation toast handles the error. Preserve the draft for retry.
    }
  };

  const handleClearLink = () => {
    setLinkedType(null);
    setLinkedId(null);
    setLinkedTitle(null);
  };

  const handleSongSelect = (id: string, title: string) => {
    setLinkedType("single");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("single", title);
    setBody((previous) => previous ? `${previous} ${autoText}` : autoText);
  };

  const handleAlbumSelect = (id: string, title: string) => {
    setLinkedType("album");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("album", title);
    setBody((previous) => previous ? `${previous} ${autoText}` : autoText);
  };

  const handleGigSelect = (id: string, title: string, extra?: { venue?: string; city?: string }) => {
    setLinkedType("gig");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("gig", title, extra);
    setBody((previous) => previous ? `${previous} ${autoText}` : autoText);
  };

  const handleTourSelect = (id: string, title: string) => {
    setLinkedType("tour");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("tour", title);
    setBody((previous) => previous ? `${previous} ${autoText}` : autoText);
  };

  const handleBandHashtag = (bandName: string) => {
    const hashtag = formatBandHashtag(bandName);
    setBody((previous) => previous ? `${previous} ${hashtag}` : hashtag);
  };

  const charCount = body.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="space-y-3">
      {quotedTwaat && (
        <div className="relative">
          <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 z-10" onClick={() => setQuotedTwaat(null)}>
            <X className="h-4 w-4" />
          </Button>
          <QuotedTwaat twaat={quotedTwaat} />
        </div>
      )}

      {pollDraft && (
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "hsl(var(--twaater-border))" }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{pollDraft.question}</p>
              <p className="text-xs text-muted-foreground">{pollDraft.options.length} options · {pollDraft.durationHours}h</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPollDraft(null)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <Textarea
        placeholder="What's happening in your music journey?"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0 text-lg bg-transparent"
        disabled={isPosting}
      />

      <TwaatMediaUpload
        onMediaUploaded={(url, type) => {
          setMediaUrl(url);
          setMediaType(type);
        }}
        onMediaRemoved={() => {
          setMediaUrl("");
          setMediaType(null);
        }}
        currentMediaUrl={mediaUrl}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowSongDialog(true)} className={`h-8 ${linkedType === "single" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}>
            <Music className="h-4 w-4" /><span className="hidden sm:inline ml-1">Single</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowReleaseDialog(true)} className={`h-8 ${linkedType === "album" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}>
            <Disc className="h-4 w-4" /><span className="hidden sm:inline ml-1">Album</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowGigDialog(true)} className={`h-8 ${linkedType === "gig" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}>
            <Calendar className="h-4 w-4" /><span className="hidden sm:inline ml-1">Gig</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTourDialog(true)} className={`h-8 ${linkedType === "tour" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}>
            <Route className="h-4 w-4" /><span className="hidden sm:inline ml-1">Tour</span>
          </Button>

          {userBands.length === 1 ? (
            <Button variant="ghost" size="sm" onClick={() => handleBandHashtag((userBands[0] as any)?.name || "")} className="h-8">
              <Hash className="h-4 w-4" /><span className="hidden sm:inline ml-1">Band</span>
            </Button>
          ) : userBands.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8"><Hash className="h-4 w-4" /><span className="hidden sm:inline ml-1">Band</span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {userBands.map((band: any) => (
                  <DropdownMenuItem key={band.id} onClick={() => handleBandHashtag(band.name)}>{formatBandHashtag(band.name)}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowPollDialog(true)}>
            <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline ml-1">Poll</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                {visibility === "public" ? <Globe2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                <span className="hidden sm:inline ml-1">{visibility === "public" ? "Public" : "Followers"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setVisibility("public")}><Globe2 className="h-4 w-4 mr-2" />Public</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVisibility("followers")}><Users className="h-4 w-4 mr-2" />Followers only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            style={{ backgroundColor: "hsl(var(--twaater-purple))", color: "white" }}
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>

      {linkedType && linkedTitle && (
        <Badge
          variant="secondary"
          className="gap-1 text-xs cursor-pointer"
          style={{ backgroundColor: "hsl(var(--twaater-purple) / 0.2)", color: "hsl(var(--twaater-purple))" }}
          onClick={handleClearLink}
        >
          {linkedType === "single" && <Music className="h-3 w-3" />}
          {linkedType === "album" && <Disc className="h-3 w-3" />}
          {linkedType === "gig" && <Calendar className="h-3 w-3" />}
          {linkedType === "tour" && <Route className="h-3 w-3" />}
          {linkedTitle}<X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add a poll</DialogTitle></DialogHeader>
          <TwaaterPollCreator
            accountId={accountId}
            onCreatePoll={(question, options, durationHours) => {
              setPollDraft({ question, options, durationHours });
              setShowPollDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <LinkSongDialog open={showSongDialog} onOpenChange={setShowSongDialog} onSelect={handleSongSelect} />
      <LinkReleaseDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog} onSelect={handleAlbumSelect} />
      <LinkGigDialog open={showGigDialog} onOpenChange={setShowGigDialog} onSelect={handleGigSelect} />
      <LinkTourDialog open={showTourDialog} onOpenChange={setShowTourDialog} onSelect={handleTourSelect} />
    </div>
  );
};
