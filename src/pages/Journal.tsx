import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useTranslation } from "@/hooks/useTranslation";
import { useJournalEntries, useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry, usePinJournalEntry } from "@/hooks/useJournal";
import { JournalTimeline } from "@/components/journal/JournalTimeline";
import { JournalFilters } from "@/components/journal/JournalFilters";
import { CreateNoteDialog } from "@/components/journal/CreateNoteDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus, Search, FileText, Trophy, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type JournalFilterType = "all" | "milestone" | "note";
export type JournalCategory = "all" | "career" | "performance" | "chart" | "fan" | "personal" | "goal" | "memory";

const Journal = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [filterType, setFilterType] = useState<JournalFilterType>("all");
  const [category, setCategory] = useState<JournalCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const { data: entries, isLoading, refetch } = useJournalEntries(user?.id || null, {
    type: filterType === "all" ? undefined : filterType,
    category: category === "all" ? undefined : category,
    search: searchQuery || undefined,
  });

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const deleteMutation = useDeleteJournalEntry();
  const pinMutation = usePinJournalEntry();

  const milestoneCount = entries?.filter(e => e.entry_type === "milestone").length || 0;
  const noteCount = entries?.filter(e => e.entry_type === "note").length || 0;

  const handleCreateNote = async (data: { title: string; content: string; category: string }) => {
    if (!user?.id) return;
    
    await createMutation.mutateAsync({
      profile_id: user.id,
      band_id: null,
      entry_type: "note",
      category: data.category,
      title: data.title,
      content: data.content,
      is_auto_generated: false,
      is_pinned: false,
      occurred_at: new Date().toISOString(),
    });
    
    setIsCreateDialogOpen(false);
    refetch();
  };

  const handlePin = async (entryId: string, isPinned: boolean) => {
    await pinMutation.mutateAsync({ entryId, isPinned: !isPinned });
    refetch();
  };

  const handleDelete = async (entryId: string) => {
    await deleteMutation.mutateAsync(entryId);
    refetch();
  };

  const handleUpdate = async (entryId: string, data: { title: string; content: string }) => {
    await updateMutation.mutateAsync({ entryId, ...data });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-oswald font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            {t("journal.title", "Career Journal")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("journal.subtitle", "Document your band's story and career milestones")}
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("journal.addNote", "Add Note")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{entries?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{t("journal.totalEntries", "Total Entries")}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{milestoneCount}</p>
              <p className="text-xs text-muted-foreground">{t("journal.milestones", "Milestones")}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{noteCount}</p>
              <p className="text-xs text-muted-foreground">{t("journal.personalNotes", "Personal Notes")}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Filter className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{entries?.filter(e => e.is_pinned).length || 0}</p>
              <p className="text-xs text-muted-foreground">{t("journal.pinnedEntries", "Pinned")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Tabs value={filterType} onValueChange={(v) => setFilterType(v as JournalFilterType)} className="w-full sm:w-auto">
              <TabsList className="grid w-full sm:w-auto grid-cols-3">
                <TabsTrigger value="all" className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  {t("common.all", "All")}
                </TabsTrigger>
                <TabsTrigger value="milestone" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  {t("journal.milestones", "Milestones")}
                </TabsTrigger>
                <TabsTrigger value="note" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {t("journal.notes", "Notes")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("journal.searchPlaceholder", "Search entries...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <JournalFilters
            category={category}
            onCategoryChange={setCategory}
          />
        </CardContent>
      </Card>

      {/* Timeline */}
      <JournalTimeline
        entries={entries || []}
        isLoading={isLoading}
        onPin={handlePin}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />

      {/* Create Note Dialog */}
      <CreateNoteDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateNote}
        isLoading={createMutation.isPending}
      />
    </div>
  );
};

export default Journal;
