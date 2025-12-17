import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const REQUIREMENT_TYPES = [
  { value: "gigs_completed", label: "Gigs Completed", type: "number" },
  { value: "songs_recorded", label: "Songs Recorded", type: "number" },
  { value: "songs_released", label: "Songs Released", type: "number" },
  { value: "fame_reached", label: "Fame Reached", type: "number" },
  { value: "fans_total", label: "Total Fans", type: "number" },
  { value: "chart_entries", label: "Chart Entries", type: "number" },
  { value: "chart_top_10", label: "Top 10 Chart Positions", type: "number" },
  { value: "chart_number_1", label: "Number 1 Chart Positions", type: "number" },
  { value: "money_earned", label: "Money Earned", type: "number" },
  { value: "streams_total", label: "Total Streams", type: "number" },
  { value: "releases_completed", label: "Releases Completed", type: "number" },
  { value: "rehearsals_completed", label: "Rehearsals Completed", type: "number" },
  { value: "cities_toured", label: "Cities Toured", type: "number" },
  { value: "band_chemistry", label: "Band Chemistry Level", type: "number" },
  { value: "skill_level", label: "Any Skill Level", type: "number" },
  { value: "twaater_followers", label: "Twaater Followers", type: "number" },
  { value: "festival_performances", label: "Festival Performances", type: "number" },
];

interface Requirement {
  type: string;
  count: number;
}

interface RequirementsBuilderProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
}

export function RequirementsBuilder({ value, onChange }: RequirementsBuilderProps) {
  // Convert object format to array format for editing
  const parseRequirements = (obj: Record<string, any>): Requirement[] => {
    if (!obj || typeof obj !== "object") return [];
    
    // Handle array format
    if (Array.isArray(obj)) {
      return obj.map(item => ({
        type: item.type || "",
        count: item.count || 0,
      }));
    }
    
    // Handle object format { type: "...", count: N }
    if (obj.type && typeof obj.count === "number") {
      return [{ type: obj.type, count: obj.count }];
    }
    
    // Handle flat object { gigs_completed: 10, fame_reached: 1000 }
    return Object.entries(obj).map(([type, count]) => ({
      type,
      count: typeof count === "number" ? count : 0,
    }));
  };

  const [requirements, setRequirements] = useState<Requirement[]>(() => parseRequirements(value));

  const updateRequirements = (newReqs: Requirement[]) => {
    setRequirements(newReqs);
    // Convert to object format for storage
    const obj: Record<string, number> = {};
    newReqs.forEach(req => {
      if (req.type) {
        obj[req.type] = req.count;
      }
    });
    onChange(obj);
  };

  const addRequirement = () => {
    updateRequirements([...requirements, { type: "", count: 0 }]);
  };

  const removeRequirement = (index: number) => {
    updateRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, field: keyof Requirement, val: string | number) => {
    const newReqs = [...requirements];
    newReqs[index] = { ...newReqs[index], [field]: val };
    updateRequirements(newReqs);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Requirements</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
          <Plus className="h-4 w-4 mr-1" />
          Add Requirement
        </Button>
      </div>
      
      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requirements set. Click "Add Requirement" to add one.</p>
      ) : (
        <div className="space-y-2">
          {requirements.map((req, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={req.type}
                      onValueChange={(val) => updateRequirement(index, "type", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select requirement type" />
                      </SelectTrigger>
                      <SelectContent>
                        {REQUIREMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Count</Label>
                    <Input
                      type="number"
                      min={0}
                      value={req.count}
                      onChange={(e) => updateRequirement(index, "count", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRequirement(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
