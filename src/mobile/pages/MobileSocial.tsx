import { FormEvent, ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Inbox as InboxIcon, Mail, MessageCircle, MessageSquare, Monitor, Send, Twitter, UserPlus, Users, X } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { useUnifiedInbox, useUnifiedInboxUnreadCount } from "@/hooks/useUnifiedInbox";
import { useUnreadDirectMessageCount, useDirectMessages } from "@/hooks/useDirectMessages";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { listConversations } from "@/features/direct-messages/services/conversations";
import { useTwaaterExploreFeed } from "@/hooks/useTwaaterExploreFeed";
import { getPublicProfileDetail } from "@/services/publicProfileDetail";
import { resolveCompanionPath } from "@/mobile/routeRegistry";
import { EmptyState } from "../components/EmptyState";
import { MobileInstantChat } from "../components/MobileInstantChat";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileStickyActionBar } from "../components/MobilePrimitives";

type NavKey = "overview" | "chat" | "messages" | "friends" | "twaater" | "notifications" | "profile" | "conversation" | "requests" | "desktop";
const nav: [NavKey, string, string][] = [
  ["overview", "Overview", "/mobile/social"],
  ["chat", "Live chat", "/mobile/social/chat"],
  ["messages", "Messages", "/mobile/social/messages"],
  ["friends", "Friends", "/mobile/social/friends"],
  ["twaater", "Twaater", "/mobile/social/twaater"],
  ["notifications", "Inbox", "/mobile/social/notifications"],
];
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Now";
const nameOf = (p: any) => p?.display_name || p?.username || p?.characterName || p?.handle || "Player";

function SocialNav({ active }: { active: NavKey }) {
  return <nav aria-label="Social sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">{nav.map(([k, label, to]) => <Link key={k} to={to} aria-current={active === k ? "page" : undefined} className={`rm-tap shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${active === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40"}`}>{label}</Link>)}</nav>;
}

function Shell({ active, title, desc, children, badge }: { active: NavKey; title: string; desc: string; children: ReactNode; badge?: ReactNode }) {
  return <MobilePageShell><MobileSectionHeader eyebrow="Social" title={title} description={desc} action={badge}/><SocialNav active={active}/>{children}</MobilePageShell>;
}

function DesktopOnly({ title, reason }: { title: string; reason: string }) {
  return <Shell active="desktop" title={title} desc={reason}><MobileSectionCard title="Desktop gameplay"><div className="space-y-3"><div className="flex items-start gap-3"><Monitor className="mt-0.5 h-5 w-5 text-primary"/><p className="text-sm text-muted-foreground">This is intentionally not duplicated on mobile. Use desktop for the full workflow.</p></div></div></MobileSectionCard></Shell>;
}

function Overview() {
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const notifications = useNotificationsFeed();
  const inboxUnreadCount = useUnifiedInboxUnreadCount();
  const dm = useUnreadDirectMessageCount(profileId);
  const friends = useFriendships(profileId);
  const twaater = useTwaaterExploreFeed();
  const requests = friends.friendships.filter((f: any) => f.friendship?.status === "pending" && f.friendship?.addressee_id === profileId);
  const accepted = friends.friendships.filter((f: any) => f.friendship?.status === "accepted");
  const socialNotifs = notifications.notifications.filter(n => ["friend", "band", "chat", "message", "social", "twaater", "mail", "invite"].some(k => `${n.category} ${n.type} ${n.title}`.toLowerCase().includes(k)));

  return <Shell active="overview" title="People & messages" desc="Quick communication, requests and social updates." badge={<MobileStatusBadge tone={inboxUnreadCount ? "danger" : "success"}>{inboxUnreadCount ? `${inboxUnreadCount} inbox` : "Caught up"}</MobileStatusBadge>}>
    <div className="grid grid-cols-2 gap-2">
      <MobileEntityCard title="Inbox" subtitle="Game messages, alerts and outcomes" icon={<InboxIcon/>} meta={<MobileStatusBadge tone={inboxUnreadCount ? "danger" : "neutral"}>{inboxUnreadCount}</MobileStatusBadge>} onPress={() => navigate("/mobile/social/notifications")}/>
      <MobileEntityCard title="Live chat" subtitle="World, Help, Recruit, Band and Friends" icon={<MessageCircle/>} meta={<MobileStatusBadge tone="success">Live</MobileStatusBadge>} onPress={() => navigate("/mobile/social/chat")}/>
      <MobileEntityCard title="Direct messages" subtitle="Recent conversations" icon={<MessageSquare/>} meta={<MobileStatusBadge tone={(dm.data ?? 0) > 0 ? "danger" : "neutral"}>{dm.isLoading ? "…" : dm.isError ? "!" : dm.data ?? 0}</MobileStatusBadge>} onPress={() => navigate("/mobile/social/messages")}/>
      <MobileEntityCard title="Friend requests" subtitle="Incoming requests" icon={<UserPlus/>} meta={<MobileStatusBadge tone={requests.length ? "warning" : "neutral"}>{friends.loading ? "…" : requests.length}</MobileStatusBadge>} onPress={() => navigate("/mobile/social/requests")}/>
      <MobileEntityCard title="Friends" subtitle="Your accepted contacts" icon={<Users/>} meta={<MobileStatusBadge>{friends.loading ? "…" : accepted.length}</MobileStatusBadge>} onPress={() => navigate("/mobile/social/friends")}/>
      <MobileEntityCard title="Twaater" subtitle="Check the world feed" icon={<Twitter/>} meta={<MobileStatusBadge tone="info">Live</MobileStatusBadge>} onPress={() => navigate("/mobile/social/twaater")}/>
    </div>

    <MobileSectionCard title="Action needed" subtitle="Social updates that may need a quick response.">
      {notifications.error ? <MobileErrorState message="Social updates failed to load." onRetry={() => notifications.refetch()}/> : notifications.isLoading ? <MobileLoadingSkeleton cards={2}/> : socialNotifs.length === 0 ? <EmptyState title="Nothing needs attention" message="Friend, band, message and Twaater updates will appear here."/> : <div className="space-y-2">{socialNotifs.slice(0, 5).map(n => <MobileEntityCard key={n.id} title={n.title} subtitle={n.message} icon={<InboxIcon/>} meta={<MobileStatusBadge tone={n.read_at ? "neutral" : "danger"}>{n.read_at ? "Read" : "New"}</MobileStatusBadge>} onPress={() => { notifications.markRead(n.id); navigate(resolveCompanionPath(n.action_path)); }}/>)}</div>}
    </MobileSectionCard>

    <MobileSectionCard title="Recent Twaater">
      {twaater.isError ? <MobileErrorState message="Twaater feed failed." onRetry={() => twaater.refetch()}/> : twaater.isLoading ? <MobileLoadingSkeleton/> : (twaater.data ?? []).length === 0 ? <EmptyState title="No recent Twaater posts" message="New public posts will appear here."/> : <div className="space-y-2">{(twaater.data ?? []).slice(0, 3).map((t: any) => <PostCard key={t.id} t={t}/>)}</div>}
    </MobileSectionCard>

    <MobileSectionCard title="Desktop-only communication" subtitle="Long-form mail management stays on desktop."><div className="flex items-center gap-3 text-sm text-muted-foreground"><Mail className="h-5 w-5"/>Compose, archive, flag and attachment-heavy mail workflows are desktop-only.</div></MobileSectionCard>
  </Shell>;
}

function ChatPage() {
  return <Shell active="chat" title="Live chat" desc="The same instant chat rooms and messages used by the desktop chat dock." badge={<MobileStatusBadge tone="success">Realtime</MobileStatusBadge>}>
    <MobileInstantChat />
  </Shell>;
}

function Friends({ requestsOnly = false }: { requestsOnly?: boolean }) {
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const f = useFriendships(profileId);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const list = f.friendships
    .filter((x: any) => requestsOnly
      ? x.friendship?.status === "pending" && x.friendship?.addressee_id === profileId
      : x.friendship?.status === "accepted")
    .filter((x: any) => !filter || nameOf(x.otherProfile).toLowerCase().includes(filter.toLowerCase()));
  const respond = async (id: string, ok: boolean) => { setBusy(id); try { ok ? await f.acceptRequest(id) : await f.declineRequest(id); } finally { setBusy(null); } };

  return <Shell active={requestsOnly ? "requests" : "friends"} title={requestsOnly ? "Friend requests" : "Friends"} desc="Quick relationship actions and messaging.">
    <div className="flex gap-2"><input aria-label="Filter friends" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name" className="min-h-11 flex-1 rounded-xl border bg-background px-3"/><Link className="rm-tap rounded-xl border px-3 py-3 text-sm" to="/mobile/social/requests">Requests</Link></div>
    {f.error ? <MobileErrorState message="Friends could not be loaded." onRetry={() => f.refresh()}/> : f.loading ? <MobileLoadingSkeleton/> : list.length === 0 ? <EmptyState title={requestsOnly ? "No incoming friend requests" : "No friends found"} message="Your social contacts will appear here."/> : <div className="space-y-2">{list.map((x: any) => <MobileEntityCard key={x.friendship.id} title={nameOf(x.otherProfile)} subtitle={[x.otherProfile?.city_name, x.otherProfile?.bandName].filter(Boolean).join(" • ")} icon={<Users/>} meta={requestsOnly ? <span className="flex gap-1"><button disabled={busy === x.friendship.id} onClick={() => respond(x.friendship.id, true)} aria-label="Accept request" className="rm-tap rounded-full bg-primary p-2 text-primary-foreground"><Check className="h-4 w-4"/></button><button disabled={busy === x.friendship.id} onClick={() => respond(x.friendship.id, false)} aria-label="Decline request" className="rm-tap rounded-full border p-2"><X className="h-4 w-4"/></button></span> : <MobileStatusBadge tone="success">Friend</MobileStatusBadge>} onPress={() => x.otherProfile?.id && navigate(`/mobile/social/profile/${x.otherProfile.id}`)}/>)}</div>}
  </Shell>;
}

function Messages() {
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const q = useQuery({
    queryKey: ["mobile-conversations", profileId],
    enabled: !!profileId,
    queryFn: () => listConversations({ limit: 50 }),
  });
  const rows = q.data ?? [];

  return <Shell active="messages" title="Messages" desc="Quick conversations using the existing direct-message system.">
    {q.isError ? <MobileErrorState message={q.error instanceof Error ? q.error.message : "Conversations could not be loaded."} onRetry={() => q.refetch()}/> : q.isLoading ? <MobileLoadingSkeleton/> : rows.length === 0 ? <EmptyState title="No conversations" message="Open a friend profile to start a conversation."/> : <div className="space-y-2">{rows.map((conversation) => <MobileEntityCard key={conversation.conversation_id} title={conversation.other_display_name || conversation.other_username || "Player"} subtitle={conversation.last_message_preview || "No messages yet"} icon={<MessageSquare/>} meta={<MobileStatusBadge tone={conversation.unread_count > 0 ? "danger" : "neutral"}>{conversation.unread_count > 0 ? `${conversation.unread_count} unread` : fmt(conversation.last_message_at)}</MobileStatusBadge>} onPress={() => navigate(`/mobile/social/conversation/${conversation.other_profile_id}`)}/>)}</div>}
    <MobileStickyActionBar><Link to="/mobile/social/friends" className="rm-tap flex justify-center rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground">Choose a friend</Link></MobileStickyActionBar>
  </Shell>;
}

function Conversation() {
  const { id } = useParams();
  const { profileId } = useActiveProfile();
  const dm = useDirectMessages(profileId, id);
  const [body, setBody] = useState("");
  const send = (e: FormEvent) => { e.preventDefault(); if (!body.trim() || dm.sendMessage.isPending) return; dm.sendMessage.mutate(body.trim(), { onSuccess: () => setBody("") }); };
  return <Shell active="conversation" title="Conversation" desc="Send a quick direct message."><Link to="/mobile/social/messages" className="rm-tap inline-flex items-center text-sm"><ChevronLeft className="h-4 w-4"/> Inbox</Link>{dm.isLoading ? <MobileLoadingSkeleton/> : dm.messages.length === 0 ? <EmptyState title="No messages yet" message="Send the first message below."/> : <ol className="space-y-2" aria-label="Message history">{dm.messages.map(m => <li key={m.id} className={`rounded-2xl border p-3 ${m.sender_profile_id === profileId ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted/50"}`}><p className="text-sm">{m.body}</p><p className="mt-1 text-[11px] opacity-70">{fmt(m.created_at)} {m.read_at ? "• read" : ""}</p></li>)}</ol>}<form onSubmit={send} className="sticky bottom-[calc(var(--m-nav-h)+var(--m-safe-b)+8px)] flex gap-2 rounded-2xl border bg-background/95 p-2"><input aria-label="Message" value={body} onChange={e => setBody(e.target.value)} className="min-h-11 flex-1 rounded-xl border bg-background px-3" placeholder={dm.sendMessage.isError ? "Send failed — edit and retry" : "Write a message"}/><button disabled={!body.trim() || dm.sendMessage.isPending} className="rm-tap rounded-xl bg-primary px-4 text-primary-foreground" aria-label="Send message"><Send className="h-4 w-4"/></button></form></Shell>;
}

function PostCard({ t }: { t: any }) {
  return <MobileEntityCard title={t.account?.display_name || t.account?.handle || "Twaater"} subtitle={t.body} icon={<Twitter/>} meta={<MobileStatusBadge>{t.metrics?.likes ?? 0} likes</MobileStatusBadge>}/>;
}

function TwaaterPage() {
  const q = useTwaaterExploreFeed();
  const posts = q.data ?? [];
  return <Shell active="twaater" title="Twaater" desc="Check the world feed from mobile. Full account management stays on desktop.">{q.isError ? <MobileErrorState message="Twaater feed failed." onRetry={() => q.refetch()}/> : q.isLoading ? <MobileLoadingSkeleton/> : posts.length === 0 ? <EmptyState title="No public posts" message="New Twaater posts will appear here."/> : <div className="space-y-2">{posts.slice(0, 20).map((t: any) => <PostCard key={t.id} t={t}/>)}</div>}</Shell>;
}

function Profile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { profileId } = useActiveProfile();
  const q = useQuery({
    queryKey: ["mobile-profile", id, profileId],
    enabled: !!id,
    queryFn: () => getPublicProfileDetail(id, profileId),
  });

  return <Shell active="profile" title="Player profile" desc="A compact profile for messaging and social context.">{q.isLoading ? <MobileLoadingSkeleton/> : q.isError ? <MobileErrorState message={q.error instanceof Error ? q.error.message : "Profile could not be loaded."} onRetry={() => q.refetch()}/> : !q.data ? <EmptyState title="Profile unavailable" message="This player may be unavailable or private."/> : <MobileSectionCard title={nameOf(q.data)} subtitle={q.data.city_name || "City hidden"} action={<MobileStatusBadge tone="info">Player</MobileStatusBadge>}><p className="text-sm text-muted-foreground">{q.data.bio || "No public bio."}</p><button onClick={() => navigate(`/mobile/social/conversation/${id}`)} className="rm-tap mt-3 w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground">Message</button></MobileSectionCard>}</Shell>;
}

function InboxPage() {
  const navigate = useNavigate();
  const inbox = useUnifiedInbox();

  return <Shell active="notifications" title="Inbox" desc="Game messages, activity outcomes and alerts in one place." badge={<MobileStatusBadge tone={inbox.unreadCount ? "danger" : "success"}>{inbox.unreadCount ? `${inbox.unreadCount} unread` : "Caught up"}</MobileStatusBadge>}>
    {inbox.unreadCount > 0 && <div className="flex justify-end"><button className="rm-tap rounded-xl border px-3 py-2 text-xs font-semibold" onClick={inbox.markAllAsRead}>Mark all read</button></div>}
    {inbox.error ? <MobileErrorState message="Inbox could not be loaded." onRetry={() => inbox.refetch()}/> : inbox.isLoading ? <MobileLoadingSkeleton/> : inbox.messages.length === 0 ? <EmptyState title="Inbox is clear" message="New game messages, outcomes and alerts will appear here."/> : <div className="space-y-2">{inbox.messages.map(message => {
      const route = message.action_type === "navigate" && typeof message.action_data?.route === "string" ? message.action_data.route : null;
      return <MobileEntityCard key={message.id} title={message.title} subtitle={`${message.message} • ${fmt(message.created_at)}`} icon={<InboxIcon/>} meta={<MobileStatusBadge tone={message.is_read ? "neutral" : "danger"}>{message.is_read ? "Read" : "New"}</MobileStatusBadge>} onPress={() => { inbox.markAsRead(message.id); if (route) navigate(resolveCompanionPath(route)); }}/>;
    })}</div>}
  </Shell>;
}

export default function MobileSocial() {
  const { section, id } = useParams();
  if (section === "chat") return <ChatPage/>;
  if (section === "messages" && id) return <Conversation/>;
  if (section === "messages") return <Messages/>;
  if (section === "friends") return <Friends/>;
  if (section === "requests") return <Friends requestsOnly/>;
  if (section === "twaater") return <TwaaterPage/>;
  if (section === "profile") return <Profile/>;
  if (section === "conversation") return <Conversation/>;
  if (section === "notifications") return <InboxPage/>;
  if (section === "mail") return <DesktopOnly title="Mail" reason="Long-form mail management is desktop-only."/>;
  return <Overview/>;
}
