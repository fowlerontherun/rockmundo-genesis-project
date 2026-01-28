import { useState } from "react";
import { format } from "date-fns";
import { JournalEntry } from "@/hooks/useJournal";
import { JournalEntryCard } from "./JournalEntryCard";
import { EditNoteDialog } from "./EditNoteDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";

interface JournalTimelineProps {
  entries: JournalEntry[];
  isLoading: boolean;
  onPin: (entryId: string, isPinned: boolean) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (entryId: string, data: { title: string; content: string }) => void;
}

export const JournalTimeline = ({ 
  entries, 
  isLoading, 
  onPin, 
  onDelete,
  onUpdate,
}: JournalTimelineProps) => {
  const { t } = useTranslation();
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold">
          {t("journal.noEntries", "No journal entries yet")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mt-2">
          {t("journal.noEntriesDescription", "Your career milestones will be automatically logged here, and you can add your own notes to document your band's journey.")}
        </p>
      </div>
    );
  }

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = format(new Date(entry.occurred_at), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, JournalEntry[]>);

  const handleEdit = (entry: JournalEntry) => {
    if (!entry.is_auto_generated) {
      setEditingEntry(entry);
    }
  };

  const handleSaveEdit = (data: { title: string; content: string }) => {
    if (editingEntry) {
      onUpdate(editingEntry.id, data);
      setEditingEntry(null);
    }
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      
      <div className="space-y-6">
        {Object.entries(groupedEntries).map(([date, dateEntries]) => (
          <div key={date} className="relative">
            {/* Date header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 mb-4">
              <div className="flex items-center gap-3 pl-8">
                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <span className="text-sm font-medium text-muted-foreground">
                  {format(new Date(date), "MMMM d, yyyy")}
                </span>
              </div>
            </div>
            
            {/* Entries for this date */}
            <div className="space-y-3 pl-10">
              {dateEntries.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onPin={() => onPin(entry.id, entry.is_pinned)}
                  onDelete={() => onDelete(entry.id)}
                  onEdit={() => handleEdit(entry)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <EditNoteDialog
        entry={editingEntry}
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSubmit={handleSaveEdit}
      />
    </div>
  );
};
