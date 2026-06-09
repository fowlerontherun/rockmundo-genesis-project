import { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const FMLoading = ({ label = "Loading…", className }: { label?: string; className?: string }) => (
  <div className={cn("flex items-center justify-center gap-2 py-10 text-xs text-fm-fg-muted", className)}>
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const FMEmpty = ({
  title = "Nothing here yet",
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  icon?: React.ElementType;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center justify-center text-center gap-2 py-10 text-fm-fg-muted", className)}>
    <Icon className="h-6 w-6 text-fm-border" />
    <div className="text-sm font-semibold text-fm-fg">{title}</div>
    {description && <div className="text-xs max-w-xs">{description}</div>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const FMError = ({ message = "Something went wrong", className }: { message?: string; className?: string }) => (
  <div
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs text-fm-bad bg-fm-bad/10 border border-fm-bad/30 rounded-sm",
      className,
    )}
  >
    <AlertCircle className="h-4 w-4" />
    {message}
  </div>
);
