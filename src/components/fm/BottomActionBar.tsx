import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, History, Calendar } from "lucide-react";
import { useUnreadInboxCount } from "@/hooks/useInbox";
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel } from "@/i18n/fm";
import { version } from "@/components/VersionHeader";

export const BottomActionBar = () => {
  const navigate = useNavigate();
  const { data: unread } = useUnreadInboxCount();
  const { language } = useTranslation();

  return (
    <footer className="h-12 flex items-center gap-2 px-3 bg-fm-panel border-t border-fm-border">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => navigate("/version-history")}
      >
        <History className="h-3.5 w-3.5" />
        <span className="text-xs">v{version}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => navigate("/schedule")}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-xs">{translateFMLabel(language, "Schedule")}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 relative"
        onClick={() => navigate("/inbox")}
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="text-xs">{translateFMLabel(language, "Inbox")}</span>
        {unread && unread > 0 ? (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-fm-bad text-white text-[10px] font-bold leading-none">
            {unread}
          </span>
        ) : null}
      </Button>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-1.5 pr-2 select-none">
        <span className="font-bebas text-[14px] tracking-[0.18em] text-fm-fg-muted leading-none">
          ROCKMUNDO
        </span>
        <span className="text-[10px] text-fm-fg-muted">© 2026</span>
      </div>
    </footer>
  );
};

export default BottomActionBar;
