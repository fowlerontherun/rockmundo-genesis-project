import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { 
  Dice5, 
  Guitar, 
  Tv, 
  Disc3, 
  Handshake, 
  DollarSign, 
  Users, 
  Trophy,
  Bell,
  Archive,
  Trash2,
  ChevronRight,
  Circle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InboxMessage as InboxMessageType, InboxCategory } from "@/hooks/useInbox";

interface InboxMessageProps {
  message: InboxMessageType;
  onMarkAsRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const categoryConfig: Record<InboxCategory, { icon: typeof Dice5; colorClass: string; label: string }> = {
  random_event: { icon: Dice5, colorClass: "text-yellow-500 bg-yellow-500/10", label: "Event" },
  gig_result: { icon: Guitar, colorClass: "text-green-500 bg-green-500/10", label: "Gig" },
  pr_media: { icon: Tv, colorClass: "text-blue-500 bg-blue-500/10", label: "PR" },
  record_label: { icon: Disc3, colorClass: "text-purple-500 bg-purple-500/10", label: "Label" },
  sponsorship: { icon: Handshake, colorClass: "text-teal-500 bg-teal-500/10", label: "Sponsor" },
  financial: { icon: DollarSign, colorClass: "text-emerald-500 bg-emerald-500/10", label: "Money" },
  social: { icon: Users, colorClass: "text-pink-500 bg-pink-500/10", label: "Social" },
  achievement: { icon: Trophy, colorClass: "text-amber-500 bg-amber-500/10", label: "Achievement" },
  system: { icon: Bell, colorClass: "text-muted-foreground bg-muted", label: "System" },
};

export function InboxMessage({ message, onMarkAsRead, onArchive, onDelete }: InboxMessageProps) {
  const navigate = useNavigate();
  const config = categoryConfig[message.category];
  const Icon = config.icon;

  const handleClick = () => {
    if (!message.is_read) {
      onMarkAsRead(message.id);
    }
  };

  const handleAction = () => {
    handleClick();
    
    if (message.action_type === 'navigate' && message.action_data?.route) {
      navigate(message.action_data.route as string);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true });

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        !message.is_read && "border-l-4 border-l-primary bg-primary/5"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div className={cn("p-2 rounded-lg shrink-0", config.colorClass)}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {config.label}
              </Badge>
              {message.priority === 'urgent' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Urgent
                </Badge>
              )}
              {message.priority === 'high' && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-warning text-warning-foreground">
                  Important
                </Badge>
              )}
              {!message.is_read && (
                <Circle className="h-2 w-2 fill-primary text-primary" />
              )}
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {timeAgo}
              </span>
            </div>

            <h4 className={cn(
              "font-medium text-sm mb-1 line-clamp-1",
              !message.is_read && "font-semibold"
            )}>
              {message.title}
            </h4>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {message.message}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              {message.action_type === 'navigate' && message.action_data?.route && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction();
                  }}
                  className="h-7 text-xs"
                >
                  View Details
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(message.id);
                  }}
                  title="Archive"
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(message.id);
                  }}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
