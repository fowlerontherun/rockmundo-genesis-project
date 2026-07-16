import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Twitter, UserPlus, Users, UsersRound } from "lucide-react";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { QuickActionCard } from "../components/QuickActionCard";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

export default function MobileSocial() {
  const navigate = useNavigate();
  const { notifications, markRead, unreadCount, isLoading } = useNotificationsFeed();
  const social = notifications.filter((n) => ["friend", "band", "chat", "message", "social", "twaater", "mail", "invite"].some((k) => n.category?.includes(k) || n.title?.toLowerCase().includes(k)));
  const actions = [["Message", <MessageSquare className="h-5 w-5" />, "/social/messages"], ["Band Chat", <UsersRound className="h-5 w-5" />, "/band"], ["Post", <Twitter className="h-5 w-5" />, "/twaater"], ["Mail", <Mail className="h-5 w-5" />, "/inbox"], ["Invite", <UserPlus className="h-5 w-5" />, "/social/players/discover"], ["Friends", <Users className="h-5 w-5" />, "/social/friends"]] as const;
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Social" title="People & messages" description="Unread conversations, band communication and Twaater activity." action={<MobileStatusBadge tone={unreadCount ? "danger" : "success"}>{unreadCount ? `${unreadCount} unread` : "Caught up"}</MobileStatusBadge>} />
    <section><h2 className="mb-2 px-1 text-[15px] font-bold">Quick actions</h2><div className="grid grid-cols-3 gap-2">{actions.map(([label, icon, to]) => <QuickActionCard key={label} label={label} icon={icon} to={to} />)}</div></section>
    <MobileSectionCard title="Social inbox" subtitle="Messages, invites and friend requests stay visually obvious."><div className="space-y-2">{actions.slice(0, 6).map(([label, icon, to]) => <MobileEntityCard key={label} title={label} subtitle={label === "Mail" && unreadCount ? `${unreadCount} pending` : "Open"} icon={icon} meta={label === "Mail" && unreadCount ? <MobileStatusBadge tone="danger">New</MobileStatusBadge> : undefined} onPress={() => navigate(to)} />)}</div></MobileSectionCard>
    <MobileSectionCard title="Recent activity" subtitle="Conversations, band updates and Twaater">{isLoading ? <EmptyState title="Loading social activity" /> : social.length === 0 ? <EmptyState title="No social activity" message="Chat, mail, friend requests and band updates will show here." /> : <div className="space-y-2">{social.slice(0, 8).map((n) => <NotificationCard key={n.id} n={n} onRead={markRead} />)}</div>}</MobileSectionCard>
  </MobilePageShell>;
}
