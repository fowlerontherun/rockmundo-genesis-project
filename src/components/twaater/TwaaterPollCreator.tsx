import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { BarChart3, Plus, Trash2, Clock } from "lucide-react";

interface TwaaterPollCreatorProps {
  accountId: string;
  onCreatePoll?: (question: string, options: string[], durationHours: number) => void;
}

export const TwaaterPollCreator = ({ accountId, onCreatePoll }: TwaaterPollCreatorProps) => {
  const { toast } = useToast();

  const [pollData, setPollData] = useState({
    question: "",
    options: ["", ""],
    durationHours: 24,
  });

  const addOption = () => {
    if (pollData.options.length < 4) {
      setPollData(prev => ({ ...prev, options: [...prev.options, ""] }));
    }
  };

  const removeOption = (index: number) => {
    if (pollData.options.length > 2) {
      setPollData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
      }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setPollData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
  };

  const handleCreatePoll = () => {
    const validOptions = pollData.options.filter(opt => opt.trim());
    if (!pollData.question.trim()) {
      toast({ title: "Please enter a question", variant: "destructive" });
      return;
    }
    if (validOptions.length < 2) {
      toast({ title: "Please provide at least 2 options", variant: "destructive" });
      return;
    }

    // Polls require a twaat_id - they must be attached to a twaat
    // This component is for UI preview - actual creation happens via TwaaterComposer
    if (onCreatePoll) {
      onCreatePoll(pollData.question, validOptions, pollData.durationHours);
      setPollData({ question: "", options: ["", ""], durationHours: 24 });
    } else {
      toast({ 
        title: "Poll Ready", 
        description: "Add this poll to your twaat using the composer" 
      });
    }
  };

  const isValid = pollData.question.trim() && pollData.options.filter(o => o.trim()).length >= 2;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Create a Poll
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Question</Label>
          <Input
            placeholder="What's your favorite genre?"
            value={pollData.question}
            onChange={(e) => setPollData(prev => ({ ...prev, question: e.target.value }))}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label>Options (2-4)</Label>
          {pollData.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                maxLength={50}
              />
              {pollData.options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {pollData.options.length < 4 && (
            <Button variant="outline" size="sm" onClick={addOption} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Option
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Duration
          </Label>
          <Select
            value={String(pollData.durationHours)}
            onValueChange={(v) => setPollData(prev => ({ ...prev, durationHours: Number(v) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hour</SelectItem>
              <SelectItem value="6">6 hours</SelectItem>
              <SelectItem value="12">12 hours</SelectItem>
              <SelectItem value="24">1 day</SelectItem>
              <SelectItem value="72">3 days</SelectItem>
              <SelectItem value="168">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleCreatePoll}
          disabled={!isValid}
          className="w-full"
        >
          Add Poll to Twaat
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Polls are attached to twaats - compose your twaat first
        </p>
      </CardContent>
    </Card>
  );
};
