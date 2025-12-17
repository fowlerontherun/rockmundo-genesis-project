import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Heart, DollarSign, Users, Star, Sparkles, AlertTriangle, Clock } from "lucide-react";
import { usePendingEvent, useChooseEventOption, type PlayerEvent } from "@/hooks/usePlayerEvents";

interface EffectDisplayProps {
  effects: Record<string, number>;
  label: string;
}

function EffectDisplay({ effects, label }: EffectDisplayProps) {
  const effectIcons: Record<string, { icon: typeof Zap; label: string }> = {
    fans: { icon: Users, label: "Fans" },
    cash: { icon: DollarSign, label: "Cash" },
    health: { icon: Heart, label: "Health" },
    energy: { icon: Zap, label: "Energy" },
    fame: { icon: Star, label: "Fame" },
    xp: { icon: Sparkles, label: "XP" },
  };

  const effectEntries = Object.entries(effects).filter(([_, value]) => value !== 0);

  if (effectEntries.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {effectEntries.map(([key, value]) => {
        const config = effectIcons[key];
        if (!config) return null;
        const Icon = config.icon;
        const isPositive = value > 0;

        return (
          <Badge
            key={key}
            variant="outline"
            className={`text-xs ${
              isPositive
                ? "border-green-500/50 text-green-500"
                : "border-red-500/50 text-red-500"
            }`}
          >
            <Icon className="h-3 w-3 mr-1" />
            {isPositive ? "+" : ""}
            {value} {config.label}
          </Badge>
        );
      })}
    </div>
  );
}

const categoryColors: Record<string, string> = {
  career: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  health: "bg-red-500/20 text-red-400 border-red-500/30",
  financial: "bg-green-500/20 text-green-400 border-green-500/30",
  social: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  random: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  industry: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export function EventNotificationModal() {
  const { data: pendingEvent, isLoading } = usePendingEvent();
  const chooseOption = useChooseEventOption();
  const [selectedOption, setSelectedOption] = useState<"a" | "b" | null>(null);

  if (isLoading || !pendingEvent) return null;

  const event = pendingEvent.random_events;
  if (!event) return null;

  const handleChoose = async (choice: "a" | "b") => {
    setSelectedOption(choice);
    await chooseOption.mutateAsync({
      playerEventId: pendingEvent.id,
      choice,
    });
  };

  const categoryClass = categoryColors[event.category] || categoryColors.random;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <Badge variant="outline" className={categoryClass}>
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)} Event
            </Badge>
          </div>
          <DialogTitle className="text-xl">{event.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {event.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Card
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedOption === "a" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => !chooseOption.isPending && handleChoose("a")}
          >
            <CardContent className="p-4">
              <div className="font-medium">{event.option_a_text}</div>
              <EffectDisplay effects={event.option_a_effects} label="Option A" />
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedOption === "b" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => !chooseOption.isPending && handleChoose("b")}
          >
            <CardContent className="p-4">
              <div className="font-medium">{event.option_b_text}</div>
              <EffectDisplay effects={event.option_b_effects} label="Option B" />
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Your choice's outcome will be applied tomorrow</span>
        </div>

        {chooseOption.isPending && (
          <div className="flex justify-center py-2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
