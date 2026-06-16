import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, ChevronRight, History, Calendar } from "lucide-react";
import { useUnreadInboxCount } from "@/hooks/useInbox";

export const BottomActionBar = () => {
  const navigate = useNavigate();
  const { data: unread } = useUnreadInboxCount();

  return (
    <footer className="h-12 flex items-center gap-2 px-3 bg-fm-panel border-t border-fm-border">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/version-history")}>
        <History className="h-3.5 w-3.5" />
        <span className="text-xs">v1.1.373</span>
      </Button>

      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/schedule")}>
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-xs">Schedule</span>
      </Button>

      <Button variant="ghost" size="sm" className="h-8 gap-1.5 relative" onClick={() => navigate("/inbox")}>
        <Bell className="h-3.5 w-3.5" />
        <span className="text-xs">Inbox</span>
        {unread && unread > 0 ? (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-fm-bad text-white text-[10px] font-bold leading-none">
            {unread}
          </span>
        ) : null}
      </Button>

      <div className="flex-1" />

      <Button
        size="sm"
        className="h-8 gap-2 bg-fm-accent hover:bg-fm-accent/90 text-fm-bg font-semibold tracking-wide uppercase text-xs"
        onClick={() => navigate("/perform-gig")}
      >
        Continue
        <ChevronRight className="h-4 w-4" />
      </Button>
    </footer>
  );
};

export default BottomActionBar;
