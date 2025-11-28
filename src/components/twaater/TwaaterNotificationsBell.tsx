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

interface TwaaterNotificationsBellProps {
  accountId: string;
}

export const TwaaterNotificationsBell = ({ accountId }: TwaaterNotificationsBellProps) => {
  const { unreadCount } = useTwaaterNotifications(accountId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <TwaaterNotificationsList accountId={accountId} />
      </PopoverContent>
    </Popover>
  );
};