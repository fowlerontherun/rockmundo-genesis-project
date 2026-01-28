import { format } from "date-fns";
import { JournalEntry } from "@/hooks/useJournal";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import {
  Trophy,
  FileText,
  Pin,
  PinOff,
  MoreVertical,
  Edit,
  Trash2,
  Music,
  Users,
  TrendingUp,
  Heart,
  Star,
  Mic,
  DollarSign,
  Calendar,
  Target,
  Sparkles,
} from "lucide-react";

interface JournalEntryCardProps {
  entry: JournalEntry;
  onPin: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "career":
      return Star;
    case "performance":
      return Mic;
    case "chart":
      return TrendingUp;
    case "fan":
      return Heart;
    case "earnings":
      return DollarSign;
    case "band":
      return Users;
    case "music":
      return Music;
    case "goal":
      return Target;
    case "memory":
      return Sparkles;
    default:
      return Calendar;
  }
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case "career":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    case "performance":
      return "bg-purple-500/10 text-purple-500 border-purple-500/30";
    case "chart":
      return "bg-green-500/10 text-green-500 border-green-500/30";
    case "fan":
      return "bg-pink-500/10 text-pink-500 border-pink-500/30";
    case "earnings":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    case "band":
      return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "music":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/30";
    case "goal":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "memory":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const JournalEntryCard = ({ entry, onPin, onDelete, onEdit }: JournalEntryCardProps) => {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const isMilestone = entry.entry_type === "milestone";
  const CategoryIcon = getCategoryIcon(entry.category);
  
  return (
    <>
      <Card className={`relative transition-all hover:shadow-md ${
        entry.is_pinned ? "border-primary/50 bg-primary/5" : ""
      } ${isMilestone ? "border-l-4 border-l-yellow-500" : ""}`}>
        {entry.is_pinned && (
          <div className="absolute -top-2 -right-2">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
              <Pin className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
        )}
        
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isMilestone ? "bg-yellow-500/10" : "bg-blue-500/10"
            }`}>
              {isMilestone ? (
                <Trophy className="h-5 w-5 text-yellow-500" />
              ) : (
                <FileText className="h-5 w-5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{entry.title}</h3>
                {entry.is_auto_generated && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t("journal.autoLogged", "Auto")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(entry.category)}`}>
                  <CategoryIcon className="h-2.5 w-2.5 mr-1" />
                  {entry.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.occurred_at), "h:mm a")}
                </span>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPin}>
                {entry.is_pinned ? (
                  <>
                    <PinOff className="h-4 w-4 mr-2" />
                    {t("journal.unpin", "Unpin")}
                  </>
                ) : (
                  <>
                    <Pin className="h-4 w-4 mr-2" />
                    {t("journal.pin", "Pin to top")}
                  </>
                )}
              </DropdownMenuItem>
              {!entry.is_auto_generated && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("common.edit", "Edit")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("common.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        {entry.content && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {entry.content}
            </p>
          </CardContent>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("journal.deleteEntry", "Delete Entry")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("journal.deleteConfirmation", "Are you sure you want to delete this journal entry? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
