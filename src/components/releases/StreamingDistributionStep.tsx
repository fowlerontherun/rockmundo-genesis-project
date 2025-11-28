import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Headphones } from "lucide-react";

interface StreamingDistributionStepProps {
  selectedPlatforms: string[];
  onPlatformsChange: (platforms: string[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function StreamingDistributionStep({
  selectedPlatforms,
  onPlatformsChange,
  onBack,
  onSubmit,
  isLoading
}: StreamingDistributionStepProps) {
  const { data: platforms } = useQuery({
    queryKey: ["streaming-platforms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("streaming_platforms")
        .select("*")
        .order("platform_name");
      return data || [];
    }
  });

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onPlatformsChange(selectedPlatforms.filter(id => id !== platformId));
    } else {
      onPlatformsChange([...selectedPlatforms, platformId]);
    }
  };

  const selectAll = () => {
    if (platforms) {
      onPlatformsChange(platforms.map(p => p.id));
    }
  };

  const clearAll = () => {
    onPlatformsChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-lg font-semibold">Select Streaming Platforms (Optional)</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
          <Button variant="outline" size="sm" onClick={clearAll}>Clear</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Your release will automatically be distributed to selected platforms when manufacturing completes.
        You can also manually distribute later from the Streaming Platforms page.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {platforms?.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          
          return (
            <Card
              key={platform.id}
              className={`p-4 cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}
              onClick={() => togglePlatform(platform.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={isSelected} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Headphones className="h-4 w-4" />
                    <div className="font-semibold">{platform.platform_name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${platform.base_payout_per_stream} per stream
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedPlatforms.length > 0 && (
        <Card className="p-4 bg-primary/5">
          <p className="text-sm font-medium">
            {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} selected for auto-distribution
          </p>
        </Card>
      )}

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? "Creating..." : "Create Release"}
        </Button>
      </div>
    </div>
  );
}