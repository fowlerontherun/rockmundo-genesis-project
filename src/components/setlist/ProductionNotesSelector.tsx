import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Lock, Sparkles, Flame, Lightbulb, Users, Wand2, Video, Box, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductionNotes, useSetlistProductionNotes, useAddProductionNote, useRemoveProductionNote } from "@/hooks/useProductionNotes";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductionNote } from "@/hooks/useProductionNotes";

interface ProductionNotesSelectorProps {
  setlistId: string;
  bandFame: number;
  venuePrestige?: number;
  userSkills?: Record<string, number>;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'pyro': return <Flame className="h-4 w-4" />;
    case 'lighting': return <Lightbulb className="h-4 w-4" />;
    case 'crowd_interaction': return <Users className="h-4 w-4" />;
    case 'special_effects': return <Wand2 className="h-4 w-4" />;
    case 'video': return <Video className="h-4 w-4" />;
    case 'stage_design': return <Box className="h-4 w-4" />;
    case 'surprise_element': return <Gift className="h-4 w-4" />;
    default: return <Sparkles className="h-4 w-4" />;
  }
};

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'legendary': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500';
    case 'rare': return 'bg-purple-500/10 text-purple-700 border-purple-500';
    case 'uncommon': return 'bg-blue-500/10 text-blue-700 border-blue-500';
    default: return 'bg-gray-500/10 text-gray-700 border-gray-500';
  }
};

const meetsRequirements = (
  note: ProductionNote, 
  bandFame: number, 
  venuePrestige: number = 0,
  userSkills: Record<string, number> = {}
): boolean => {
  if (note.required_fame && bandFame < note.required_fame) return false;
  if (note.required_venue_prestige && venuePrestige < note.required_venue_prestige) return false;
  if (note.required_skill_slug && note.required_skill_value) {
    const skillValue = userSkills[note.required_skill_slug] || 0;
    if (skillValue < note.required_skill_value) return false;
  }
  return true;
};

export const ProductionNotesSelector = ({
  setlistId,
  bandFame,
  venuePrestige = 0,
  userSkills = {}
}: ProductionNotesSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<string>("all");

  const { data: allNotes = [] } = useProductionNotes();
  const { data: assignedNotes = [] } = useSetlistProductionNotes(setlistId);
  const addNoteMutation = useAddProductionNote();
  const removeNoteMutation = useRemoveProductionNote();

  const selectedNoteIds = new Set(
    assignedNotes.map((a) => a.production_note_id)
  );

  const filteredNotes = allNotes.filter((note) => {
    if (searchQuery && !note.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== "all" && note.category !== categoryFilter) {
      return false;
    }
    if (rarityFilter !== "all" && note.rarity !== rarityFilter) {
      return false;
    }
    return true;
  });

  const toggleNote = (noteId: string) => {
    if (selectedNoteIds.has(noteId)) {
      removeNoteMutation.mutate({ setlistId, productionNoteId: noteId });
    } else {
      addNoteMutation.mutate({ setlistId, productionNoteId: noteId });
    }
  };

  const totalCost = assignedNotes.reduce((sum, a) => {
    return sum + (a.setlist_production_notes?.cost_per_use || 0);
  }, 0);

  const totalImpact = assignedNotes.reduce((sum, a) => {
    const note = a.setlist_production_notes;
    if (!note) return sum;
    return sum + ((note.impact_value - 1) * 100);
  }, 0);

  const categories = Array.from(new Set(allNotes.map((n) => n.category)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Production Notes</Label>
        <div className="text-sm">
          <Badge variant="outline" className="mr-2">
            {assignedNotes.length} selected
          </Badge>
          {totalCost > 0 && (
            <Badge variant="outline" className="mr-2">
              ${totalCost.toLocaleString()} cost
            </Badge>
          )}
          <Badge variant="secondary">
            +{totalImpact.toFixed(0)}% total impact
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Add special effects and production elements to enhance your show
      </p>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input
          placeholder="Search production notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Rarities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rarities</SelectItem>
            <SelectItem value="common">Common</SelectItem>
            <SelectItem value="uncommon">Uncommon</SelectItem>
            <SelectItem value="rare">Rare</SelectItem>
            <SelectItem value="legendary">Legendary</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes List */}
      <ScrollArea className="h-[400px] border rounded-md p-4">
        <div className="space-y-3">
          {filteredNotes.map((note) => {
            const canUse = meetsRequirements(note, bandFame, venuePrestige, userSkills);
            const isSelected = selectedNoteIds.has(note.id);

            return (
              <div
                key={note.id}
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg transition-all",
                  !canUse && "opacity-50 cursor-not-allowed bg-muted",
                  isSelected && canUse && "border-primary bg-primary/5"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => canUse && toggleNote(note.id)}
                  disabled={!canUse}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getCategoryIcon(note.category)}
                    <span className="font-medium">{note.name}</span>
                    <Badge variant="outline" className={cn("text-xs", getRarityColor(note.rarity))}>
                      {note.rarity}
                    </Badge>
                    {note.cost_per_use > 0 && (
                      <Badge variant="outline" className="text-xs">
                        ${note.cost_per_use}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">{note.description}</p>

                  {/* Requirements */}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {note.required_fame && (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          bandFame >= note.required_fame ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {bandFame >= note.required_fame ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {note.required_fame}+ fame
                      </div>
                    )}
                    {note.required_venue_prestige && (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          venuePrestige >= note.required_venue_prestige
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {venuePrestige >= note.required_venue_prestige ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        Prestige {note.required_venue_prestige}+ venue
                      </div>
                    )}
                    {note.required_skill_slug && (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          (userSkills[note.required_skill_slug] || 0) >= (note.required_skill_value || 0)
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {(userSkills[note.required_skill_slug] || 0) >= (note.required_skill_value || 0) ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        Skill required
                      </div>
                    )}
                  </div>

                  {/* Impact */}
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {note.impact_type}: +{((note.impact_value - 1) * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
