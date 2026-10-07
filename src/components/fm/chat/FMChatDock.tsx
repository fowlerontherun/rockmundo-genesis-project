import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import {
  MessageSquare,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Globe,
  HelpCircle,
  UserPlus,
  Users,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatDock } from "./ChatDockContext";
import { ChatRoomView } from "./ChatRoomView";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel } from "@/i18n/fm";
import { fmChatText } from "@/i18n/fmChat";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { DirectMessageThread } from "@/features/social-hub/components/DirectMessageThread";
import { useUnreadDirectMessageCount } from "@/hooks/useDirectMessages";

const HIDDEN_PATHS = ["/auth", "/onboarding", "/create-character"];

type RoomId = "world" | "help" | "recruit" | "band" | "friends";

export function FMChatDock() {
  const { pathname } = useLocation();
  const { profileId: myProfileId, userId: authUserId } = useActiveProfile();
  const { language } = useTranslation();
  const { open, setOpen, threads, openThread, closeThread, reset } = useChatDock();
  const { friendships, loading } = useFriendships(myProfileId);
  const { data: primaryBand } = usePrimaryBand();
  const { data: unreadDirectMessages = 0 } = useUnreadDirectMessageCount(myProfileId);
  const [activeRoom, setActiveRoom] = useState<RoomId>("world");
  const [notificationMode, setNotificationMode] = useState<"auto" | "badge" | "off">(() => {
    try {
      const saved = localStorage.getItem("rockmundo-world-chat-notifications");
      return saved === "auto" || saved === "badge" || saved === "off" ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [unreadWorld, setUnreadWorld] = useState(0);
  const [unreadRooms, setUnreadRooms] = useState<Record<"help" | "recruit" | "band", number>>({ help: 0, recruit: 0, band: 0 });
  const [worldActivity, setWorldActivity] = useState(false);
  const seenWorldIds = useRef(new Set<string>());
  const worldReady = useRef(false);
  const openRef = useRef(open);
  const activeRoomRef = useRef(activeRoom);
  const modeRef = useRef(notificationMode);
  const profileRef = useRef(myProfileId);
  openRef.current = open;
  activeRoomRef.current = activeRoom;
  modeRef.current = notificationMode;
  profileRef.current = myProfileId;

  const previousProfileId = useRef<string | null>(null);

  useEffect(() => {
    if (previousProfileId.current && previousProfileId.current !== myProfileId) {
      reset();
      setActiveRoom("world");
      setUnreadWorld(0);
      setWorldActivity(false);
      setShowChatSettings(false);
    }
    previousProfileId.current = myProfileId;
  }, [myProfileId, reset]);

  useEffect(() => {
    try { localStorage.setItem("rockmundo-world-chat-notifications", notificationMode); } catch { /* Storage unavailable. */ }
    if (notificationMode === "off") {
      setUnreadWorld(0);
      setWorldActivity(false);
    }
  }, [notificationMode]);

  useEffect(() => {
    if (open && activeRoom === "world") {
      setUnreadWorld(0);
      setWorldActivity(false);
    }
  }, [open, activeRoom]);

  // Keep the dock subscribed while minimised. Poll as a fallback for dropped
  // realtime events (including reconnects and missed events during startup).
  useEffect(() => {
    if (!myProfileId) return;
    let disposed = false;
    let currentUserId: string | undefined;
    let newestTimestamp: string | null = null;
    let checking = false;
    const pending: Array<{ id: string; profile_id?: string | null; user_id?: string; created_at: string }> = [];
    worldReady.current = false;
    seenWorldIds.current.clear();

    const handleMessage = (row: { id: string; profile_id?: string | null; user_id?: string; created_at: string }) => {
      if (disposed || seenWorldIds.current.has(row.id)) return;
      if (!worldReady.current) {
        pending.push(row);
        return;
      }
      seenWorldIds.current.add(row.id);
      if (!newestTimestamp || row.created_at > newestTimestamp) newestTimestamp = row.created_at;
      if (seenWorldIds.current.size > 300) {
        seenWorldIds.current = new Set(Array.from(seenWorldIds.current).slice(-150));
      }
      if (row.profile_id === profileRef.current || row.user_id === currentUserId) return;
      if (modeRef.current === "off") return;
      if (openRef.current && activeRoomRef.current === "world") return;
      setUnreadWorld((count) => count + 1);
      setWorldActivity(true);
      if (modeRef.current === "auto") {
        setActiveRoom("world");
        setOpen(true);
      }
    };

    const checkMissedMessages = async () => {
      if (disposed || !worldReady.current || checking || !newestTimestamp) return;
      checking = true;
      try {
        const { data, error } = await supabase.from("global_chat")
          .select("id, profile_id, user_id, created_at")
          .eq("channel", "world")
          .gte("created_at", newestTimestamp)
          .order("created_at", { ascending: true }).limit(100);
        if (error) throw error;
        for (const row of data ?? []) handleMessage(row);
      } catch (error) {
        console.warn("World Chat notification sync failed", error);
      } finally {
        checking = false;
      }
    };

    const channel = supabase.channel(`world-chat-dock-${myProfileId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "global_chat", filter: "channel=eq.world",
      }, (payload) => handleMessage(payload.new as { id: string; profile_id?: string | null; user_id?: string; created_at: string }))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void checkMissedMessages();
      });

    void (async () => {
      const [auth, latest] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("global_chat").select("id, created_at").eq("channel", "world")
          .order("created_at", { ascending: false }).limit(1),
      ]);
      if (disposed) return;
      currentUserId = auth.data.user?.id;
      if (latest.error) {
        console.warn("World Chat notification initialisation failed", latest.error);
        return;
      }
      const initial = latest.data?.[0];
      if (initial) {
        newestTimestamp = initial.created_at;
        seenWorldIds.current.add(initial.id);
      } else {
        newestTimestamp = new Date().toISOString();
      }
      worldReady.current = true;
      for (const row of pending.splice(0)) handleMessage(row);
      void checkMissedMessages();
    })();
    const timer = window.setInterval(() => void checkMissedMessages(), 8000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkMissedMessages(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      worldReady.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [myProfileId, setOpen]);

  const bandId = (primaryBand as any)?.band_id ?? null;
  const bandName = (primaryBand as any)?.bands?.name ?? translateFMLabel(language, "Band");

  useEffect(() => {
    setUnreadRooms({ help: 0, recruit: 0, band: 0 });
  }, [myProfileId, bandId]);

  useEffect(() => {
    if (open && (activeRoom === "help" || activeRoom === "recruit" || activeRoom === "band")) {
      setUnreadRooms((current) => current[activeRoom] ? { ...current, [activeRoom]: 0 } : current);
    }
  }, [open, activeRoom]);

  useEffect(() => {
    if (!myProfileId) return;
    const channels = ["help", "recruit", ...(bandId ? [`band:${bandId}`] : [])];
    const handle = (row: { profile_id?: string | null; user_id?: string; channel?: string }) => {
      if (row.profile_id === myProfileId || (!row.profile_id && row.user_id === authUserId)) return;
      const room = row.channel === "help" ? "help" : row.channel === "recruit" ? "recruit" : row.channel === `band:${bandId}` ? "band" : null;
      if (!room || (openRef.current && activeRoomRef.current === room)) return;
      setUnreadRooms((current) => ({ ...current, [room]: current[room] + 1 }));
    };
    const subscriptions = channels.map((channelKey) => supabase
      .channel(`chat-dock-unread-${myProfileId}-${channelKey}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_chat", filter: `channel=eq.${channelKey}` },
        (payload) => handle(payload.new as { profile_id?: string | null; user_id?: string; channel?: string }))
      .subscribe());
    return () => { subscriptions.forEach((subscription) => { void supabase.removeChannel(subscription); }); };
  }, [authUserId, bandId, myProfileId]);

  const rooms = useMemo(
    () => [
      { id: "world" as RoomId, label: translateFMLabel(language, "World"), icon: Globe },
      { id: "help" as RoomId, label: fmChatText(language, "help"), icon: HelpCircle },
      { id: "recruit" as RoomId, label: fmChatText(language, "recruit"), icon: UserPlus },
      { id: "band" as RoomId, label: translateFMLabel(language, "Band"), icon: Users },
      { id: "friends" as RoomId, label: translateFMLabel(language, "Friends"), icon: MessageSquare },
    ],
    [language],
  );

  const accepted = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted" && f.otherProfile),
    [friendships],
  );

  const totalRoomUnread =
    unreadWorld + unreadRooms.help + unreadRooms.recruit + unreadRooms.band;
  const totalUnread = totalRoomUnread + unreadDirectMessages;

  if (!myProfileId) return null;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <div className="fixed bottom-0 left-3 z-40 flex flex-row-reverse items-end gap-2 pointer-events-none">
      {threads.map((t) => (
        <div
          key={t.profileId}
          className="pointer-events-auto w-[320px] h-[420px] bg-fm-panel border border-fm-border border-b-0 rounded-t-sm shadow-lg flex flex-col"
        >
          <div className="h-8 flex items-center justify-between px-2 bg-fm-panel-2 border-b border-fm-border">
            <span className="text-[11px] tracking-tight text-fm-fg font-medium truncate">
              {t.displayName}
            </span>
            <button
              type="button"
              onClick={() => closeThread(t.profileId)}
              className="text-fm-fg-muted hover:text-fm-fg"
              aria-label={fmChatText(language, "closeChat")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <DirectMessageThread
              myProfileId={myProfileId}
              otherProfileId={t.profileId}
              otherDisplayName={t.displayName}
              compact
            />
          </div>
        </div>
      ))}

      <div className="pointer-events-auto w-[300px] bg-fm-panel border border-fm-border border-b-0 rounded-t-sm shadow-lg flex flex-col">
        <button
          type="button"
          onClick={() => { setOpen(!open); if (!open) setActiveRoom("world"); }}
          className="h-8 flex items-center justify-between px-2 bg-fm-panel-2 border-b border-fm-border hover:bg-fm-panel-2/80"
        >
          <span className="flex items-center gap-1.5 text-[11px] tracking-tight text-fm-fg font-medium">
            <MessageSquare className="h-3.5 w-3.5 text-fm-accent" />
            {fmChatText(language, "chat")}
            {totalUnread > 0 && (
              <span
                className="rounded-full bg-fm-accent px-1.5 text-[10px] text-fm-panel"
                aria-label={`${totalUnread} unread chat messages`}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
            <span className="text-fm-fg-muted">
              ({activeRoom === "friends" ? accepted.length : rooms.find((r) => r.id === activeRoom)?.label})
            </span>
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <div className="h-[340px] flex flex-col">
            <div className="flex items-center justify-end border-b border-fm-border px-2 py-1">
              <button type="button" onClick={() => setShowChatSettings((value) => !value)}
                className="flex items-center gap-1 text-[10px] text-fm-fg-muted hover:text-fm-fg"
                aria-label="World Chat notification settings" aria-expanded={showChatSettings}>
                <Settings2 className="h-3 w-3" /> Notifications
              </button>
            </div>
            {showChatSettings && (
              <div className="border-b border-fm-border px-2 py-2 text-xs">
                <label htmlFor="world-chat-notification-mode" className="mb-1 block text-fm-fg">New World Chat messages</label>
                <select id="world-chat-notification-mode" value={notificationMode}
                  onChange={(event) => setNotificationMode(event.target.value as "auto" | "badge" | "off")}
                  className="w-full rounded border border-fm-border bg-fm-panel p-1 text-fm-fg">
                  <option value="auto">Automatically open chat</option>
                  <option value="badge">Show unread badge only</option>
                  <option value="off">No notifications</option>
                </select>
              </div>
            )}
            <div className="flex overflow-x-auto scrollbar-hide border-b border-fm-border bg-fm-panel-2/60">
              {rooms.map((room) => {
                const Icon = room.icon;
                const isActive = activeRoom === room.id;
                const roomUnread =
                  room.id === "world"
                    ? unreadWorld
                    : room.id === "friends"
                      ? unreadDirectMessages
                      : room.id === "help"
                        ? unreadRooms.help
                        : room.id === "recruit"
                          ? unreadRooms.recruit
                          : unreadRooms.band;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setActiveRoom(room.id);
                      if (room.id === "world") {
                        setUnreadWorld(0);
                        setWorldActivity(false);
                      } else if (room.id === "help" || room.id === "recruit" || room.id === "band") {
                        setUnreadRooms((current) =>
                          current[room.id] ? { ...current, [room.id]: 0 } : current,
                        );
                      }
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-fm-fg-muted hover:text-fm-fg",
                      isActive && "bg-fm-panel text-fm-accent border-b-2 border-fm-accent",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {roomUnread > 0 && (
                      <span className="rounded-full bg-fm-accent px-1 text-[9px] text-fm-panel">
                        {roomUnread > 99 ? "99+" : roomUnread}
                      </span>
                    )}
                    {room.label}
                  </button>
                );
              })}
            </div>

            {activeRoom === "world" && (
              <ChatRoomView
                channelKey="world"
                emptyMessage={fmChatText(language, "worldQuiet")}
                placeholder={fmChatText(language, "worldPlaceholder")}
              />
            )}
            {activeRoom === "help" && (
              <ChatRoomView
                channelKey="help"
                emptyMessage={fmChatText(language, "helpEmpty")}
                placeholder={fmChatText(language, "helpPlaceholder")}
              />
            )}
            {activeRoom === "recruit" && (
              <ChatRoomView
                channelKey="recruit"
                emptyMessage={fmChatText(language, "recruitEmpty")}
                placeholder={fmChatText(language, "recruitPlaceholder")}
              />
            )}
            {activeRoom === "band" && (
              <ChatRoomView
                channelKey={bandId ? `band:${bandId}` : null}
                lockedMessage={bandId ? null : fmChatText(language, "bandLocked")}
                emptyMessage={fmChatText(language, "bandEmpty", { band: bandName })}
                placeholder={fmChatText(language, "bandPlaceholder", { band: bandName })}
              />
            )}
            {activeRoom === "friends" && (
              <div className="flex flex-1 min-h-0 flex-col">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-fm-fg-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> {fmChatText(language, "loading")}
                  </div>
                ) : accepted.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-fm-fg-muted px-3 text-center">
                    {fmChatText(language, "addFriends")}
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="py-1">
                      {accepted.map((f) => {
                        const other = f.otherProfile!;
                        const name = other.display_name ?? other.username ?? fmChatText(language, "friend");
                        const isOpen = threads.some((t) => t.profileId === other.id);
                        return (
                          <button
                            key={f.friendship.id}
                            onClick={() => openThread({ profileId: other.id, displayName: name })}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-fm-panel-2",
                              isOpen && "bg-fm-panel-2",
                            )}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={(other as any).avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs text-fm-fg">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FMChatDock;
