import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTwaats } from "@/hooks/useTwaats";
import { Send, Music, Calendar, MapPin, X, Disc, Clock, Route, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TwaatMediaUpload } from "./TwaatMediaUpload";
import { QuotedTwaat } from "./QuotedTwaat";
import { LinkSongDialog } from "./LinkSongDialog";
import { LinkReleaseDialog } from "./LinkReleaseDialog";
import { LinkGigDialog } from "./LinkGigDialog";
import { LinkTourDialog } from "./LinkTourDialog";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

interface TwaaterComposerProps {
  accountId: string;
}

// Helper to generate promotional text when linking content
const generateLinkText = (type: string, title: string, extra?: { venue?: string; city?: string }): string => {
  switch (type) {
    case 'single':
      return `Check out my new single "${title}"! 🎵 `;
    case 'album':
      return `My new album "${title}" is here! 🎶 `;
    case 'gig':
      if (extra?.venue && extra?.city) {
        return `Catch us live at ${extra.venue}, ${extra.city}! 📅 `;
      } else if (extra?.venue) {
        return `Catch us live at ${extra.venue}! 📅 `;
      }
      return `We're playing live soon! 📅 `;
    case 'tour':
      return `We're hitting the road! ${title} tour is coming! 🎸 `;
    default:
      return '';
  }
};

// Helper to format band name as hashtag
const formatBandHashtag = (bandName: string): string => {
  return '#' + bandName
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export const TwaaterComposer = ({ accountId }: TwaaterComposerProps) => {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [linkedType, setLinkedType] = useState<"single" | "album" | "gig" | "tour" | "busking" | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkedTitle, setLinkedTitle] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [quotedTwaat, setQuotedTwaat] = useState<any>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const { createTwaat, isPosting } = useTwaats();

  // Link dialogs
  const [showSongDialog, setShowSongDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showGigDialog, setShowGigDialog] = useState(false);
  const [showTourDialog, setShowTourDialog] = useState(false);

  // Fetch user's bands for hashtag feature
  const { data: userBands = [] } = useQuery({
    queryKey: ["user-bands-for-twaater", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands:bands(id, name)")
        .eq("user_id", user.id)
        .eq("member_status", "active");
      
      if (error) throw error;
      return data?.map(m => m.bands).filter(Boolean) || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('quoteTwaat');
    if (stored) {
      setQuotedTwaat(JSON.parse(stored));
      sessionStorage.removeItem('quoteTwaat');
    }
  }, []);

  const handlePost = async () => {
    if (!body.trim()) return;

    createTwaat({
      account_id: accountId,
      body: body.trim(),
      linked_type: linkedType || undefined,
      linked_id: linkedId || undefined,
      visibility: "public",
      media_url: mediaUrl || undefined,
      media_type: mediaType || undefined,
      quoted_twaat_id: quotedTwaat?.id || undefined,
      scheduled_for: scheduledFor || undefined,
    });

    setBody("");
    setLinkedType(null);
    setLinkedId(null);
    setLinkedTitle(null);
    setMediaUrl("");
    setMediaType(null);
    setQuotedTwaat(null);
    setScheduledFor("");
  };

  const handleClearLink = () => {
    setLinkedType(null);
    setLinkedId(null);
    setLinkedTitle(null);
  };

  // Handle song selection with auto-text
  const handleSongSelect = (id: string, title: string) => {
    setLinkedType("single");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("single", title);
    setBody(prev => prev ? prev + " " + autoText : autoText);
  };

  // Handle album selection with auto-text
  const handleAlbumSelect = (id: string, title: string) => {
    setLinkedType("album");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("album", title);
    setBody(prev => prev ? prev + " " + autoText : autoText);
  };

  // Handle gig selection with auto-text
  const handleGigSelect = (id: string, title: string, extra?: { venue?: string; city?: string }) => {
    setLinkedType("gig");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("gig", title, extra);
    setBody(prev => prev ? prev + " " + autoText : autoText);
  };

  // Handle tour selection with auto-text
  const handleTourSelect = (id: string, title: string) => {
    setLinkedType("tour");
    setLinkedId(id);
    setLinkedTitle(title);
    const autoText = generateLinkText("tour", title);
    setBody(prev => prev ? prev + " " + autoText : autoText);
  };

  // Handle band hashtag insertion
  const handleBandHashtag = (bandName: string) => {
    const hashtag = formatBandHashtag(bandName);
    setBody(prev => prev ? prev + " " + hashtag : hashtag);
  };

  const charCount = body.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="space-y-3">
      {quotedTwaat && (
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 z-10"
            onClick={() => setQuotedTwaat(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <QuotedTwaat twaat={quotedTwaat} />
        </div>
      )}
      
      <Textarea
        placeholder="What's happening in your music journey?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSongDialog(true)}
            className={`h-8 ${linkedType === "single" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Single</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReleaseDialog(true)}
            className={`h-8 ${linkedType === "album" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Disc className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Album</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGigDialog(true)}
            className={`h-8 ${linkedType === "gig" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Gig</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTourDialog(true)}
            className={`h-8 ${linkedType === "tour" ? "bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]" : ""}`}
          >
            <Route className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Tour</span>
          </Button>
          
          {/* Band Hashtag Button */}
          {userBands.length === 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBandHashtag((userBands[0] as any)?.name || '')}
              className="h-8"
            >
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Band</span>
            </Button>
          ) : userBands.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Hash className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Band</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {userBands.map((band: any) => (
                  <DropdownMenuItem 
                    key={band.id} 
                    onClick={() => handleBandHashtag(band.name)}
                  >
                    {formatBandHashtag(band.name)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Schedule</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Twaat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Schedule for</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </div>
                <Button onClick={() => setShowScheduleDialog(false)}>
                  Confirm Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

      {linkedType && linkedTitle && (
        <Badge 
          variant="secondary" 
          className="gap-1 text-xs cursor-pointer" 
          style={{ backgroundColor: 'hsl(var(--twaater-purple) / 0.2)', color: 'hsl(var(--twaater-purple))' }}
          onClick={handleClearLink}
        >
          {linkedType === "single" && <Music className="h-3 w-3" />}
          {linkedType === "album" && <Disc className="h-3 w-3" />}
          {linkedType === "gig" && <Calendar className="h-3 w-3" />}
          {linkedType === "tour" && <Route className="h-3 w-3" />}
          {linkedTitle}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {/* Link Dialogs */}
      <LinkSongDialog
        open={showSongDialog}
        onOpenChange={setShowSongDialog}
        onSelect={handleSongSelect}
      />
      <LinkReleaseDialog
        open={showReleaseDialog}
        onOpenChange={setShowReleaseDialog}
        onSelect={handleAlbumSelect}
      />
      <LinkGigDialog
        open={showGigDialog}
        onOpenChange={setShowGigDialog}
        onSelect={handleGigSelect}
      />
      <LinkTourDialog
        open={showTourDialog}
        onOpenChange={setShowTourDialog}
        onSelect={handleTourSelect}
      />
    </div>
  );
};