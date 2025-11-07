import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ProfileRow } from "../types";
import { searchProfiles } from "../api";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FriendSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeProfileIds: string[];
  onSelectProfile: (profileId: string) => Promise<void>;
}

export function FriendSearchDialog({ open, onOpenChange, excludeProfileIds, onSelectProfile }: FriendSearchDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      toast({
        title: "Keep typing",
        description: "Enter at least two characters to search for friends.",
      });
      return;
    }

    setLoading(true);
    try {
      const profiles = await searchProfiles(query, excludeProfileIds);
      setResults(profiles);
    } catch (error: unknown) {
      toast({
        title: "Unable to search",
        description: error instanceof Error ? error.message : "Something went wrong while searching players.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (profileId: string) => {
    setSending(profileId);
    try {
      await onSelectProfile(profileId);
      toast({ title: "Request sent", description: "Your friend request is on the way." });
      onOpenChange(false);
      setQuery("");
      setResults([]);
    } catch (error: unknown) {
      toast({
        title: "Unable to send request",
        description: error instanceof Error ? error.message : "Something went wrong while sending the request.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const hasResults = results.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Find players</DialogTitle>
          <DialogDescription>Search for artists to send a friend request.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by username or display name"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>
          <ScrollArea className="h-[320px] pr-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching players...
              </div>
            ) : !hasResults ? (
              <p className="text-sm text-muted-foreground">No players yet. Try a different query.</p>
            ) : (
              <div className="space-y-2">
                {results.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleSelect(profile.id)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:border-primary"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name ?? profile.username} />
                        <AvatarFallback>{profile.display_name?.[0] ?? profile.username?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{profile.display_name ?? profile.username}</p>
                        <p className="text-xs text-muted-foreground">Fame {profile.fame ?? "TBD"}</p>
                      </div>
                    </div>
                    <Button disabled={sending === profile.id}>
                      {sending === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Send request"
                      )}
                    </Button>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

