import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export const EmptyState = ({
  title = "Nothing here yet",
  message,
  icon,
  action,
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="rm-mcard p-6 flex flex-col items-center text-center gap-2">
    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
      {icon ?? <Inbox className="h-6 w-6" />}
    </div>
    <div className="text-[14px] font-semibold">{title}</div>
    {message && <div className="text-[12px] text-muted-foreground max-w-xs">{message}</div>}
    {action}
  </div>
);
