import { useLocation, useNavigate } from "react-router-dom";
import { Inbox as InboxIcon } from "lucide-react";
import { useUnifiedInbox } from "@/hooks/useUnifiedInbox";
import { resolveCompanionPath } from "@/mobile/routeRegistry";
import { EmptyState } from "../components/EmptyState";
import { MobileInstantChat } from "../components/MobileInstantChat";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Now";

function ChatPage() {
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Communication" title="Game Chat" description="Live in-game chat rooms and messages." />
    <MobileInstantChat />
  </MobilePageShell>;
}

function InboxPage() {
  const navigate = useNavigate();
  const inbox = useUnifiedInbox();
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Communication" title="Inbox" description="Game messages, activity outcomes and alerts." />
    {inbox.unreadCount > 0 && <div className="flex justify-end"><button className="rm-tap rounded-xl border px-3 py-2 text-xs font-semibold" onClick={inbox.markAllAsRead}>Mark all read</button></div>}
    {inbox.error ? <MobileErrorState message="Inbox could not be loaded." onRetry={() => inbox.refetch()} /> : inbox.isLoading ? <MobileLoadingSkeleton /> : inbox.messages.length === 0 ? <EmptyState title="Inbox is clear" message="New game messages, outcomes and alerts will appear here." /> : <div className="space-y-2">{inbox.messages.map(message => {
      const route = message.action_type === "navigate" && typeof message.action_data?.route === "string" ? message.action_data.route : null;
      return <MobileEntityCard key={message.id} title={message.title} subtitle={`${message.message} • ${fmt(message.created_at)}`} icon={<InboxIcon />} meta={<MobileStatusBadge tone={message.is_read ? "neutral" : "danger"}>{message.is_read ? "Read" : "New"}</MobileStatusBadge>} onPress={() => { inbox.markAsRead(message.id); if (route) navigate(resolveCompanionPath(route)); }} />;
    })}</div>}
  </MobilePageShell>;
}

export default function MobileSocial() {
  const { pathname } = useLocation();
  return pathname === "/mobile/chat" ? <ChatPage /> : <InboxPage />;
}
