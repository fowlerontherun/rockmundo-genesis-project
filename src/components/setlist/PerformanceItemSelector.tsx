import { useState } from "react";
import { useFilteredPerformanceItems, type PerformanceItem } from "@/hooks/usePerformanceItems";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Zap, Users, Lock } from "lucide-react";

interface PerformanceItemSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PerformanceItem) => void;
  userSkills: Record<string, number>;
  userGenres: string[];
}

const categoryLabels = {
  stage_action: "Stage Action",
  crowd_interaction: "Crowd Interaction",
  special_effect: "Special Effect",
  improvisation: "Improvisation",
  storytelling: "Storytelling"
};

export const PerformanceItemSelector = ({
  open,
  onClose,
  onSelect,
  userSkills,
  userGenres
}: PerformanceItemSelectorProps) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Get ALL performance items - no longer filtering by user skills/genres
  const { data: allPerformanceItems } = useFilteredPerformanceItems(userSkills, userGenres);
  
  // Use all items directly instead of filtering by locked status
  const filteredItems = allPerformanceItems?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                         item.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.item_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // All items are now always unlocked
  const isItemLocked = (item: PerformanceItem) => {
    return false; // Never locked anymore
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Performance Item</DialogTitle>
          <DialogDescription>
            Choose stage actions, crowd interactions, and special moments to enhance your setlist.
            You can add up to 5 performance items per setlist.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <Badge variant="outline">{filteredItems?.length || 0}</Badge> performance items available
          </div>
          
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-2">
              {filteredItems?.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 transition-colors hover:bg-accent cursor-pointer"
                    onClick={() => onSelect(item)}
                  >
                    <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{item.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                      <Badge variant="outline" className="ml-2">
                        {categoryLabels[item.item_category]}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Energy: {item.energy_cost}/10
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Appeal: {item.crowd_appeal}/10
                      </div>
                    </div>
                    
                    {(item.required_skill || item.required_genre) && (
                      <div className="flex gap-2 mt-2">
                        {item.required_skill && (
                          <Badge variant="secondary" className="text-xs">
                            {item.required_skill.replace(/_/g, ' ')} Lv.{item.min_skill_level}+
                            {userSkills[item.required_skill] && ` (${userSkills[item.required_skill]})`}
                          </Badge>
                        )}
                        {item.required_genre && (
                          <Badge variant="secondary" className="text-xs">
                            {item.required_genre}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {filteredItems?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items found matching your search.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
