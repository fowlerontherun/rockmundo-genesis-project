import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, CalendarDays, CalendarPlus, Inbox, MessageSquare, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const companionActions = [
  { key: "schedule", label: "My Schedule", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile?view=day" },
  { key: "book", label: "Book Activity", icon: <CalendarPlus className="h-5 w-5" />, to: "/mobile?view=book" },
  { key: "inbox", label: "Inbox", icon: <Inbox className="h-5 w-5" />, to: "/mobile/inbox" },
  { key: "chat", label: "Game Chat", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/chat" },
  { key: "progression", label: "Spend XP / AP", icon: <Sparkles className="h-5 w-5" />, to: "/mobile/progression" },
];

export const FabMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return <>
    <button onClick={() => setOpen((value) => !value)} aria-label={open ? "Close quick actions" : "Open quick actions"} className={cn("fixed z-40 right-4 rounded-full h-14 w-14 flex items-center justify-center shadow-lg","bg-primary text-primary-foreground active:scale-95 transition-transform")} style={{ bottom: "calc(var(--m-nav-h) + var(--m-safe-b) + 12px)" }}>
      {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
    </button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-8">
        <SheetHeader className="text-left mb-3"><SheetTitle>Quick Actions</SheetTitle></SheetHeader>
        <p className="mb-4 text-sm text-muted-foreground">Mobile access is limited to scheduling, inbox, game chat and progression.</p>
        <div className="grid grid-cols-2 gap-3">
          {companionActions.map((action) => <button key={action.key} onClick={() => { setOpen(false); navigate(action.to); }} className="rm-mcard rm-tap flex flex-col items-center justify-center gap-1.5 py-3 active:scale-95"><div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">{action.icon}</div><div className="text-[11px] font-medium text-center leading-tight">{action.label}</div></button>)}
        </div>
      </SheetContent>
    </Sheet>
  </>;
};
