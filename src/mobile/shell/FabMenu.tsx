import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Plane, Zap, MessageSquare, Twitter, Moon, CalendarDays } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Action = {
  key: string;
  label: string;
  icon: React.ReactNode;
  to: string;
};

const companionActions: Action[] = [
  { key: "day", label: "My Day", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile?view=day" },
  { key: "practice", label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/mobile?view=day#practice" },
  { key: "travel", label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/mobile/world/travel" },
  { key: "message", label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/social/messages" },
  { key: "twaater", label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/mobile/social/twaater" },
  { key: "recover", label: "Recover", icon: <Moon className="h-5 w-5" />, to: "/mobile/me/wellness" },
];

export const FabMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = (action: Action) => {
    setOpen(false);
    navigate(action.to);
  };

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        className={cn(
          "fixed z-40 right-4 rounded-full h-14 w-14 flex items-center justify-center shadow-lg",
          "bg-primary text-primary-foreground active:scale-95 transition-transform",
        )}
        style={{ bottom: "calc(var(--m-nav-h) + var(--m-safe-b) + 12px)" }}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-8">
          <SheetHeader className="text-left mb-3">
            <SheetTitle>Quick Actions</SheetTitle>
          </SheetHeader>
          <p className="mb-4 text-sm text-muted-foreground">
            Short companion actions only. Detailed creation and management stay on desktop.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {companionActions.map((action) => (
              <button
                key={action.key}
                onClick={() => go(action)}
                className="rm-mcard rm-tap flex flex-col items-center justify-center gap-1.5 py-3 active:scale-95"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {action.icon}
                </div>
                <div className="text-[11px] font-medium text-center leading-tight">{action.label}</div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
