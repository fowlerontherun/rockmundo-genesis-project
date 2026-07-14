import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PersistedNotification } from "@/hooks/useNotificationsFeed";
import { formatDistanceToNow } from "date-fns";

interface NotificationCardProps {
  n: PersistedNotification;
  onRead?: (id: string) => void;
}

export const NotificationCard = ({ n, onRead }: NotificationCardProps) => {
  const navigate = useNavigate();
  const unread = !n.read_at;
  const handle = () => {
    if (unread) onRead?.(n.id);
    if (n.action_path) navigate(n.action_path);
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        "rm-mcard w-full text-left p-3 flex items-start gap-3 active:scale-[0.99]",
        unread && "border-primary/60",
      )}
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-semibold truncate">{n.title}</div>
          {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        <div className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</div>
        <div className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </div>
      </div>
    </button>
  );
};
