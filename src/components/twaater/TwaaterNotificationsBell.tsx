import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTwaaterNotifications } from "@/hooks/useTwaaterNotifications";
import { TwaaterNotificationsList } from "./TwaaterNotificationsList";
import { useNavigate } from "react-router-dom";

interface TwaaterNotificationsBellProps {
  accountId: string;
}

export const TwaaterNotificationsBell = ({ accountId }: TwaaterNotificationsBellProps) => {
  const { unreadCount } = useTwaaterNotifications(accountId);
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)]">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-[hsl(var(--twaater-purple))] text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" style={{ backgroundColor: "hsl(var(--twaater-card))", borderColor: "hsl(var(--twaater-border))" }}>
        <div className="max-h-80 overflow-y-auto">
          <TwaaterNotificationsList accountId={accountId} />
        </div>
        <div className="border-t p-2" style={{ borderColor: "hsl(var(--twaater-border))" }}>
          <Button 
            variant="ghost" 
            className="w-full text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)]"
            onClick={() => navigate("/twaater/notifications")}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};