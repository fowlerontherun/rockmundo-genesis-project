import { Bell, ShieldAlert, Timer, Trophy, XOctagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ContractNotification } from "./contractNotifications";

interface ContractNotificationsPanelProps {
  playerMessages: ContractNotification[];
  adminAlerts: ContractNotification[];
  onNotificationAction?: (notification: ContractNotification) => void;
}

const categoryCopy: Record<ContractNotification["category"], { label: string; icon: JSX.Element }> = {
  offer: { label: "New offer", icon: <Bell className="h-4 w-4" /> },
  expiry: { label: "Expiring", icon: <Timer className="h-4 w-4" /> },
  termination: { label: "Termination", icon: <XOctagon className="h-4 w-4" /> },
  bonus: { label: "Bonus", icon: <Trophy className="h-4 w-4" /> },
  penalty: { label: "Penalty", icon: <ShieldAlert className="h-4 w-4" /> },
};

const severityVariant: Record<ContractNotification["severity"], "default" | "secondary" | "destructive" | "outline"> = {
  default: "secondary",
  warning: "outline",
  danger: "destructive",
  success: "default",
};

interface NotificationListProps {
  title: string;
  description: string;
  emptyLabel: string;
  notifications: ContractNotification[];
  onAction?: (notification: ContractNotification) => void;
}

const NotificationList = ({ title, description, notifications, emptyLabel, onAction }: NotificationListProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          notifications.map((notification) => {
            const category = categoryCopy[notification.category];
            return (
              <div key={notification.id} className="rounded-lg border p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Badge variant={severityVariant[notification.severity]} className="flex items-center gap-1 capitalize">
                      {category.icon}
                      {category.label}
                    </Badge>
                    <span>{notification.title}</span>
                  </div>
                  {notification.cta && onAction && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-medium text-primary hover:text-primary/80"
                      onClick={() => onAction(notification)}
                    >
                      {notification.cta}
                    </Button>
                  )}
                  {notification.cta && !onAction && (
                    <Badge variant="outline" className="text-xs font-medium">
                      {notification.cta}
                    </Badge>
                  )}
                </div>
                <Separator className="my-2" />
                <p className="text-sm text-muted-foreground">{notification.description}</p>
                {(notification.entityName || notification.labelName) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {notification.entityName && (
                      <Badge variant="secondary" className="bg-muted/60">
                        Entity: {notification.entityName}
                      </Badge>
                    )}
                    {notification.labelName && (
                      <Badge variant="secondary" className="bg-muted/60">
                        Label: {notification.labelName}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export const ContractNotificationsPanel = ({ playerMessages, adminAlerts, onNotificationAction }: ContractNotificationsPanelProps) => {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NotificationList
        title="In-game messages"
        description="Player-facing updates for offers, expirations, and performance events."
        notifications={playerMessages}
        emptyLabel="No player messages right now."
        onAction={onNotificationAction}
      />
      <NotificationList
        title="Admin approvals"
        description="Internal follow-ups that need a producer or label admin to approve."
        notifications={adminAlerts}
        emptyLabel="No admin approvals required."
        onAction={onNotificationAction}
      />
    </div>
  );
};
