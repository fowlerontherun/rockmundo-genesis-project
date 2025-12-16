import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, Bell, CheckCircle, AlertTriangle, Info, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "achievement" | "offer";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};

const ICON_MAP = {
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
  achievement: Gift,
  offer: Bell,
};

const COLOR_MAP = {
  success: "text-green-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
  achievement: "text-purple-500",
  offer: "text-primary",
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const NotificationItem = ({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) => {
  const Icon = ICON_MAP[notification.type];
  const colorClass = COLOR_MAP[notification.type];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors",
        notification.read ? "bg-muted/30" : "bg-muted/70"
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", colorClass)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
        {notification.action && (
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0 mt-1 text-xs"
            onClick={notification.action.onClick}
          >
            {notification.action.label}
          </Button>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 flex-shrink-0"
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
