import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X, Check, AlertTriangle, Info, Zap, DollarSign, Users, Target } from "lucide-react";
import { useCompanyNotifications, useMarkNotificationRead, useDismissNotification } from "@/hooks/useCompanyAdvanced";
import { NOTIFICATION_PRIORITY_COLORS } from "@/types/company-advanced";
import { formatDistanceToNow } from "date-fns";

interface CompanyNotificationsCenterProps {
  companyId: string;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  contract_pending: <DollarSign className="h-4 w-4" />,
  payment_due: <DollarSign className="h-4 w-4" />,
  employee_issue: <Users className="h-4 w-4" />,
  goal_progress: <Target className="h-4 w-4" />,
  synergy_unlocked: <Zap className="h-4 w-4" />,
  financial_alert: <AlertTriangle className="h-4 w-4" />,
  milestone: <Check className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
};

export function CompanyNotificationsCenter({ companyId }: CompanyNotificationsCenterProps) {
  const { data: notifications = [], isLoading } = useCompanyNotifications(companyId);
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await markRead.mutateAsync(id);
  };

  const handleDismiss = async (id: string) => {
    await dismiss.mutateAsync(id);
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading notifications...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Company alerts and updates
            </CardDescription>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} new</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.is_read ? 'bg-muted/30' : 'bg-card border-primary/30'
                } transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded ${NOTIFICATION_PRIORITY_COLORS[notification.priority] || 'bg-muted'}`}>
                    {NOTIFICATION_ICONS[notification.notification_type] || <Info className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium text-sm ${notification.is_read ? 'text-muted-foreground' : ''}`}>
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.is_read && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMarkRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleDismiss(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
