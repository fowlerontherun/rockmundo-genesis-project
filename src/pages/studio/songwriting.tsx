// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";

import { useAuth } from "@/hooks/use-auth-context";

import {
  DEFAULT_LYRIC_CONTENT,
  createSongwritingDraft,
  createSongwritingDraftRevision,
  fetchSongwritingDraftById,
  fetchSongwritingDraftRevisions,
  fetchSongwritingDraftsForUser,
  type SongwritingDraftRecord,
  type SongwritingDraftRevisionRecord,
  updateSongwritingDraft,
} from "@/lib/api/songwritingDrafts";
import {
  createSongwritingRealtimeChannel,
  type SongwritingContentUpdate,
  type SongwritingPresence,
} from "@/lib/realtime/songwriting";
import type { Json } from "@/lib/supabase-types";
import { cn } from "@/lib/utils";

interface LyricContent {
  html: string;
}

const INITIAL_LYRIC_CONTENT: LyricContent = normalizeContent(DEFAULT_LYRIC_CONTENT);

function normalizeContent(content: Json | null): LyricContent {
  if (content && typeof content === "object" && !Array.isArray(content) && "html" in content) {
    const htmlValue = (content as { html?: unknown }).html;
    if (typeof htmlValue === "string") {
      return { html: htmlValue };
    }
  }

  return {
    html: "<p>Start writing your lyrics here. Share the draft link with collaborators to jam in real time.</p>",
  };
}

interface LyricEditorProps {
  value: LyricContent;
  onChange: (content: LyricContent) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const toolbarButtonClasses =
  "rounded-md border bg-background px-2 py-1 text-sm font-medium transition hover:bg-muted disabled:opacity-50";

function execCommand(command: string) {
  document.execCommand(command);
}

const LyricEditor = ({ value, onChange, readOnly, placeholder }: LyricEditorProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value.html) {
      editorRef.current.innerHTML = value.html;
    }
  }, [value.html]);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    onChange({ html: target.innerHTML });
  };

  return (
    <div className="flex h-full flex-col rounded-lg border bg-background">
      <div className="flex flex-wrap gap-2 border-b px-3 py-2">
        <button
          type="button"
          className={toolbarButtonClasses}
          onMouseDown={(event) => {
            event.preventDefault();
            execCommand("bold");
          }}
          disabled={readOnly}
        >
          Bold
        </button>
        <button
          type="button"
          className={toolbarButtonClasses}
          onMouseDown={(event) => {
            event.preventDefault();
            execCommand("italic");
          }}
          disabled={readOnly}
        >
          Italic
        </button>
        <button
          type="button"
          className={toolbarButtonClasses}
          onMouseDown={(event) => {
            event.preventDefault();
            execCommand("underline");
          }}
          disabled={readOnly}
        >
          Underline
        </button>
        <button
          type="button"
          className={toolbarButtonClasses}
          onMouseDown={(event) => {
            event.preventDefault();
            execCommand("insertUnorderedList");
          }}
          disabled={readOnly}
        >
          Bullet List
        </button>
        <button
          type="button"
          className={toolbarButtonClasses}
          onMouseDown={(event) => {
            event.preventDefault();
            execCommand("insertOrderedList");
          }}
          disabled={readOnly}
        >
          Numbered List
        </button>
      </div>
      <div className="relative flex-1">
        <div
          ref={editorRef}
          className={cn(
            "lyric-editor prose prose-sm h-full w-full max-w-none px-4 py-3 focus:outline-none",
            readOnly && "pointer-events-none opacity-70",
          )}
          contentEditable={!readOnly}
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={handleInput}
        />
      </div>
    </div>
  );
};

const presenceColors = [
  "bg-rose-500/20 text-rose-500",
  "bg-sky-500/20 text-sky-500",
  "bg-emerald-500/20 text-emerald-500",
  "bg-amber-500/20 text-amber-500",
  "bg-purple-500/20 text-purple-500",
];

function colorForUser(userId: string) {
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return presenceColors[hash % presenceColors.length];
}

function formatRelativeTime(value: string): string {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch (error) {
    console.warn("Failed to format relative time", error);
    return "moments ago";
  }
}

const SongwritingStudioPage = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<LyricContent>(INITIAL_LYRIC_CONTENT);
  const [presence, setPresence] = useState<SongwritingPresence[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "error">("connecting");

  const realtimeChannelRef = useRef<ReturnType<typeof createSongwritingRealtimeChannel<LyricContent>> | null>(null);
  const isApplyingRemoteUpdateRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftIdFromParams = searchParams.get("draft");

  useEffect(() => {
    if (draftIdFromParams) {
      setActiveDraftId(draftIdFromParams);
    }
  }, [draftIdFromParams]);

  const { data: recentDrafts, isFetching: isFetchingDrafts } = useQuery({
    queryKey: ["songwriting-drafts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as SongwritingDraftRecord[];
      return await fetchSongwritingDraftsForUser(user.id);
    },
    enabled: !!user?.id,
  });

  const { data: activeDraft, isLoading: isDraftLoading } = useQuery({
    queryKey: ["songwriting-draft", activeDraftId],
    queryFn: async () => {
      if (!activeDraftId) return null;
      const draft = await fetchSongwritingDraftById(activeDraftId);
      return draft;
    },
    enabled: !!activeDraftId,
    staleTime: 0,
  });

  const { data: revisions } = useQuery({
    queryKey: ["songwriting-draft-revisions", activeDraftId],
    queryFn: async () => {
      if (!activeDraftId) return [] as SongwritingDraftRevisionRecord[];
      return await fetchSongwritingDraftRevisions(activeDraftId);
    },
    enabled: !!activeDraftId,
    refetchInterval: 60_000,
  });

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be signed in to start a songwriting draft.");
      return await createSongwritingDraft({
        userId: user.id,
        title: "Untitled Lyrics",
        content: DEFAULT_LYRIC_CONTENT,
      });
    },
    onSuccess: (draft) => {
      setSearchParams({ draft: draft.id }, { replace: true });
      setActiveDraftId(draft.id);
      queryClient.invalidateQueries({ queryKey: ["songwriting-drafts"] });
    },
    onError: (error) => {
      console.error("Failed to create songwriting draft", error);
      toast({
        title: "Could not create draft",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async (content: LyricContent) => {
      if (!activeDraftId) return null;
      return await updateSongwritingDraft({
        draftId: activeDraftId,
        content,
        lastEditedBy: user?.id ?? null,
      });
    },
    onSuccess: (draft) => {
      if (draft) {
        setLastSavedAt(draft.updated_at);
        queryClient.invalidateQueries({ queryKey: ["songwriting-drafts", user?.id] });
      }
    },
    onError: (error) => {
      console.error("Failed to save songwriting draft", error);
      toast({
        title: "Autosave failed",
        description: "We could not sync your latest changes. They are still visible locally.",
        variant: "destructive",
      });
    },
  });

  const createRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!activeDraftId) throw new Error("Missing active draft");
      await createSongwritingDraftRevision({
        draftId: activeDraftId,
        content: currentContent,
        createdBy: user?.id ?? null,
        summary: "Snapshot saved from the studio",
      });
    },
    onSuccess: () => {
      toast({
        title: "Revision captured",
        description: "Saved a snapshot of your lyrics.",
      });
      queryClient.invalidateQueries({ queryKey: ["songwriting-draft-revisions", activeDraftId] });
    },
    onError: (error) => {
      console.error("Failed to capture revision", error);
      toast({
        title: "Could not save revision",
        description: "Try again once your connection stabilizes.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!activeDraft) return;

    const normalized = normalizeContent(activeDraft.content as Json | null);
    isApplyingRemoteUpdateRef.current = true;
    setCurrentContent(normalized);
    setLastSavedAt(activeDraft.updated_at);
    isApplyingRemoteUpdateRef.current = false;
  }, [activeDraft?.id, activeDraft?.content, activeDraft?.updated_at]);

  useEffect(() => {
    if (!activeDraftId || !user?.id) return;

    setConnectionState("connecting");

    const channel = createSongwritingRealtimeChannel<LyricContent>(activeDraftId, {
      onContentUpdate: (payload: SongwritingContentUpdate<LyricContent>) => {
        if (payload.userId === user.id) {
          return;
        }

        isApplyingRemoteUpdateRef.current = true;
        setCurrentContent(payload.content);
        setLastSavedAt(payload.updatedAt);
        isApplyingRemoteUpdateRef.current = false;
      },
      onPresenceUpdate: (state) => {
        setPresence(
          state.map((presenceEntry) => ({
            ...presenceEntry,
            color: colorForUser(presenceEntry.userId),
          })),
        );
      },
      onStatusChange: (status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("error");
        }

        if (status === "CLOSED") {
          setConnectionState("connecting");
        }
      },
    });

    realtimeChannelRef.current = channel;

    void channel.subscribe().then(() => {
      void channel.trackPresence({
        userId: user.id,
        username: user.user_metadata?.username || user.email || "Collaborator",
        color: colorForUser(user.id),
        lastActive: new Date().toISOString(),
      });
    });

    return () => {
      void channel.unsubscribe();
      realtimeChannelRef.current = null;
    };
  }, [activeDraftId, user?.id, user?.email, user?.user_metadata?.username]);

  useEffect(() => {
    if (!user?.id || activeDraftId || authLoading || isFetchingDrafts) {
      return;
    }

    if (recentDrafts && recentDrafts.length > 0) {
      setSearchParams({ draft: recentDrafts[0].id }, { replace: true });
      setActiveDraftId(recentDrafts[0].id);
    } else {
      createDraftMutation.mutate();
    }
  }, [user?.id, activeDraftId, authLoading, isFetchingDrafts, recentDrafts, createDraftMutation, setSearchParams]);

  const handleContentChange = (content: LyricContent) => {
    setCurrentContent(content);

    if (isApplyingRemoteUpdateRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      updateDraftMutation.mutate(content);
      if (realtimeChannelRef.current && user?.id && activeDraftId) {
        void realtimeChannelRef.current.sendContentUpdate({
          draftId: activeDraftId,
          userId: user.id,
          content,
          updatedAt: new Date().toISOString(),
        });
      }
    }, 600);
  };

  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
  }, []);

  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) return "Not saved yet";
    try {
      return formatRelativeTime(lastSavedAt);
    } catch (error) {
      console.warn("Could not format last saved timestamp", error);
      return "Recently";
    }
  }, [lastSavedAt]);

  const collaboratorBadge = useMemo(() => {
    if (connectionState === "error") {
      return <Badge variant="destructive">Realtime disconnected</Badge>;
    }

    if (connectionState === "connecting") {
      return <Badge variant="secondary">Connecting…</Badge>;
    }

    return <Badge className="bg-emerald-500/10 text-emerald-500">Live collaboration</Badge>;
  }, [connectionState]);

  if (authLoading || isDraftLoading) {
    return (
      <div className="container mx-auto space-y-6 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-16">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              You need to be authenticated to collaborate on songwriting drafts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Head to the authentication page to log in, then return to the studio to continue writing lyrics with your
              collaborators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Collaborative Songwriting Studio</h1>
          <p className="max-w-2xl text-muted-foreground">
            Craft lyrics together in real time. Every keystroke syncs across collaborators via Supabase Realtime channels,
            and autosave protects your drafts in the cloud.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {collaboratorBadge}
          <Badge variant="outline">{formattedLastSaved}</Badge>
          <Button
            variant="outline"
            onClick={() => createRevisionMutation.mutate()}
            disabled={createRevisionMutation.isPending || !activeDraftId}
          >
            Save snapshot
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="h-full">
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{activeDraft?.title ?? "Untitled Lyrics"}</CardTitle>
              <CardDescription>
                Invite co-writers by sharing this URL. Everyone sees changes instantly with conflict-free updates.
              </CardDescription>
            </div>
            <Button variant="secondary" onClick={() => createDraftMutation.mutate()} disabled={createDraftMutation.isPending}>
              New draft
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <LyricEditor
              value={currentContent}
              onChange={handleContentChange}
              readOnly={connectionState === "error"}
              placeholder="Write your verses, hooks, and bridges…"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{presence.length} collaborator{presence.length === 1 ? "" : "s"} online</span>
              <span>Autosaving…</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active collaborators</CardTitle>
              <CardDescription>Realtime presence updates via Supabase channels</CardDescription>
            </CardHeader>
            <CardContent>
              {presence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Share this page with your co-writers to see them appear here instantly.
                </p>
              ) : (
                <div className="space-y-3">
                  {presence.map((collaborator) => (
                    <div key={collaborator.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {collaborator.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{collaborator.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Active {formatRelativeTime(collaborator.lastActive)}
                          </p>
                        </div>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-medium", collaborator.color)}>
                        Writing
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revision history</CardTitle>
              <CardDescription>Restore or review previous lyric ideas</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[320px] p-0">
              {revisions && revisions.length > 0 ? (
                <ScrollArea className="h-[320px] px-4 py-3">
                  <div className="space-y-4">
                    {revisions.map((revision) => (
                      <div key={revision.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{revision.summary ?? "Snapshot"}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(revision.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                          {normalizeContent(revision.content as Json | null).html.replace(/<[^>]+>/g, "").slice(0, 160) ||
                            "(Empty stanza)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No revisions yet. Use the “Save snapshot” button to capture moments in your writing session.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SongwritingStudioPage;

// Basic placeholder styling for the editor
declare global {
  interface Document {
    execCommand(commandId: string, showUI?: boolean, value?: string): boolean;
  }
}

if (typeof document !== "undefined" && !document.head.querySelector("style[data-lyric-editor]") ) {
  const style = document.createElement("style");
  style.innerHTML = `
.lyric-editor[contenteditable="true"]:empty::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}
`;
  style.setAttribute("data-lyric-editor", "true");
  document.head.appendChild(style);
}
