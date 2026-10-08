import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, CalendarDays, CalendarPlus, Inbox, MessageSquare, Share2, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const companionActions = [
  { key: "schedule", label: "My Schedule", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile?view=day" },
  { key: "book", label: "Book Activity", icon: <CalendarPlus className="h-5 w-5" />, to: "/mobile?view=book" },
  { key: "inbox", label: "Inbox", icon: <Inbox className="h-5 w-5" />, to: "/mobile/inbox" },
  { key: "chat", label: "Game Chat", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/chat" },
  { key: "progression", label: "Spend XP / AP", icon: <Sparkles className="h-5 w-5" />, to: "/mobile/progression" },
  { key: "share", label: "Share", icon: <Share2 className="h-5 w-5" />, to: "/social/share-studio" },
];

export const FabMenu = () => {
  const { t } = useTranslation();
  const labels: Record<string, string> = { schedule: t("playerControls.mySchedule"), book: t("playerControls.bookActivity"), inbox: t("nav.inbox"), chat: t("playerControls.gameChat"), progression: t("playerControls.spendPoints"), share: t("common.share") };
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return <>
    <Button variant="ghost" onClick={() => setOpen((value) => !value)} aria-label={t(open ? "playerControls.closeActions" : "playerControls.openActions")} className={cn("fixed z-40 right-4 rounded-full h-14 w-14 flex items-center justify-center shadow-lg","bg-primary text-primary-foreground active:scale-95 transition-transform")} style={{ bottom: "calc(var(--m-nav-h) + var(--m-safe-b) + 12px)" }}>
      {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" aria-describedby={undefined} className="rounded-t-2xl p-4 pb-8">
        <SheetHeader className="text-left mb-3"><SheetTitle>{t("playerControls.quickActions")}</SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-3">
          {companionActions.map((action) => <Button variant="ghost" key={action.key} onClick={() => { setOpen(false); navigate(action.to); }} className="rm-mcard rm-tap h-auto whitespace-normal flex flex-col items-center justify-center gap-1.5 py-3 active:scale-95"><div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">{action.icon}</div><div className="text-[11px] font-medium text-center leading-tight">{labels[action.key]}</div></Button>)}
        </div>
      </SheetContent>
    </Sheet>
  </>;
};
