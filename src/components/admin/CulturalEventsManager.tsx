import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

interface CulturalEventsManagerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function CulturalEventsManager({ value, onChange }: CulturalEventsManagerProps) {
  const [newEvent, setNewEvent] = useState("");
  const events = Array.isArray(value) ? value : [];

  const addEvent = () => {
    if (newEvent.trim() && !events.includes(newEvent.trim())) {
      onChange([...events, newEvent.trim()]);
      setNewEvent("");
    }
  };

  const removeEvent = (eventToRemove: string) => {
    onChange(events.filter((e) => e !== eventToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEvent();
    }
  };

  return (
    <div className="space-y-3">
      <Label>Cultural Events</Label>
      
      <div className="flex gap-2">
        <Input
          value={newEvent}
          onChange={(e) => setNewEvent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add a cultural event..."
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={addEvent} disabled={!newEvent.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {events.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {events.map((event, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
              {event}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeEvent(event)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No cultural events added yet.</p>
      )}
    </div>
  );
}
