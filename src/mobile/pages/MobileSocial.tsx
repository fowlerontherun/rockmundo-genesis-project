import { useNavigate } from "react-router-dom";
import { Users, MessageSquare, Mail, Twitter, UsersRound } from "lucide-react";
import { MCard } from "../components/MCard";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";

export default function MobileSocial() {
  const navigate = useNavigate();
  const { notifications, markRead } = useNotificationsFeed();
  const social = notifications.filter((n) =>
    ["friend", "band", "chat", "message", "social", "twaater", "mail"].some((k) => n.category?.includes(k)),
  );

  const rows = [
    { title: "Friends", subtitle: "See who's online", icon: <Users className="h-5 w-5" />, to: "/friends" },
    { title: "My Band", subtitle: "Chemistry, chat, and roster", icon: <UsersRound className="h-5 w-5" />, to: "/bands" },
    { title: "Chat", subtitle: "Direct messages", icon: <MessageSquare className="h-5 w-5" />, to: "/messages" },
    { title: "Mail", subtitle: "Inbox and offers", icon: <Mail className="h-5 w-5" />, to: "/inbox" },
    { title: "Twaater", subtitle: "Post and trends", icon: <Twitter className="h-5 w-5" />, to: "/twaater" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {rows.map((r) => (
          <MCard key={r.title} {...r} chevron onPress={() => navigate(r.to)} />
        ))}
      </div>
      <section>
        <h2 className="font-bold text-[15px] px-1 mb-2">Recent activity</h2>
        <div className="space-y-2">
          {social.length === 0 ? (
            <EmptyState title="No social activity" message="Chat, mail, and band updates will show here." />
          ) : (
            social.slice(0, 8).map((n) => <NotificationCard key={n.id} n={n} onRead={markRead} />)
          )}
        </div>
      </section>
    </div>
  );
}
