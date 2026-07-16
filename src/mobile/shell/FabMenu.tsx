import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, X, Music4, Plane, PenLine, Zap, MessageSquare, Mic2, CalendarClock, Twitter, Moon, Utensils, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Action = {
  key: string;
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
};

// Context-aware ordering: put likely actions first for the current section.
function orderFor(pathname: string, base: Action[]): Action[] {
  const bucket = (keys: string[]) => {
    const set = new Set(keys);
    return [...base.filter((a) => set.has(a.key)), ...base.filter((a) => !set.has(a.key))];
  };
  if (pathname.startsWith("/mobile/career") || pathname.startsWith("/career")) return bucket(["practice", "write", "book-studio", "book-rehearsal", "jam"]);
  if (pathname.startsWith("/mobile/social") || pathname.startsWith("/social")) return bucket(["message", "twaater", "jam"]);
  if (pathname.startsWith("/mobile/world") || pathname.startsWith("/world")) return bucket(["travel", "shop", "book-studio"]);
  if (pathname.startsWith("/mobile/me") || pathname.startsWith("/me") || pathname.startsWith("/character")) return bucket(["sleep", "eat", "shop"]);
  return base;
}

export const FabMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const base: Action[] = [
    { key: "practice", label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/skills" },
    { key: "travel", label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/travel" },
    { key: "write", label: "Write Song", icon: <PenLine className="h-5 w-5" />, to: "/songwriting" },
    { key: "jam", label: "Jam", icon: <Music4 className="h-5 w-5" />, to: "/jams" },
    { key: "message", label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/social/messages" },
    { key: "book-studio", label: "Book Studio", icon: <Mic2 className="h-5 w-5" />, to: "/recording-studio" },
    { key: "book-rehearsal", label: "Rehearsal", icon: <CalendarClock className="h-5 w-5" />, to: "/rehearsals" },
    { key: "twaater", label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/twaater" },
    { key: "sleep", label: "Sleep", icon: <Moon className="h-5 w-5" />, to: "/wellness" },
    { key: "eat", label: "Eat", icon: <Utensils className="h-5 w-5" />, to: "/wellness" },
    { key: "shop", label: "Shop", icon: <ShoppingBag className="h-5 w-5" />, to: "/gear-shop" },
  ];
  const actions = orderFor(location.pathname, base);

  const trigger = () => setOpen((v) => !v);
  const go = (a: Action) => {
    setOpen(false);
    if (a.onClick) a.onClick();
    else if (a.to) navigate(a.to);
  };

  return (
    <>
      <button
        onClick={trigger}
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
        <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-8 max-h-[75vh]">
          <SheetHeader className="text-left mb-3">
            <SheetTitle>Quick Actions</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3">
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={() => go(a)}
                className="rm-mcard rm-tap flex flex-col items-center justify-center gap-1.5 py-3 active:scale-95"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {a.icon}
                </div>
                <div className="text-[11px] font-medium text-center leading-tight">{a.label}</div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
