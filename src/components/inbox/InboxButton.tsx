import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedInboxUnreadCount } from "@/hooks/useUnifiedInbox";
import { cn } from "@/lib/utils";

export function InboxButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const unreadCount = useUnifiedInboxUnreadCount();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative h-8 w-8", className)}
      onClick={() => navigate("/inbox")}
      title="Inbox"
      aria-label={`Inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
    >
      <Inbox className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
