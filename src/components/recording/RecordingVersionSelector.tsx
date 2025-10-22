import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Disc3, Music2, Radio } from "lucide-react";

interface RecordingVersionSelectorProps {
  song: any;
  onSelectVersion: (version: 'standard' | 'remix' | 'acoustic') => void;
  selectedVersion?: 'standard' | 'remix' | 'acoustic';
}

const VERSION_OPTIONS = [
  {
    id: 'standard' as const,
    label: 'Standard Re-Recording',
    icon: Disc3,
    description: 'Record a fresh take of the original version',
    badge: 'Original',
  },
  {
    id: 'remix' as const,
    label: 'Remix Version',
    icon: Radio,
    description: 'Create a remixed version with new production',
    badge: 'Remix',
  },
  {
    id: 'acoustic' as const,
    label: 'Acoustic Version',
    icon: Music2,
    description: 'Record a stripped-down acoustic arrangement',
    badge: 'Acoustic',
  },
];

export const RecordingVersionSelector = ({ 
  song, 
  onSelectVersion, 
  selectedVersion 
}: RecordingVersionSelectorProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          "{song.title}" has already been recorded
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose how you'd like to re-record this song:
        </p>
      </div>

      <div className="grid gap-4">
        {VERSION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedVersion === option.id;
          
          return (
            <Card
              key={option.id}
              className={`transition-all cursor-pointer hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelectVersion(option.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{option.label}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isSelected ? 'default' : 'secondary'}>
                    {option.badge}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <Button
                  variant={isSelected ? 'default' : 'outline'}
                  className="w-full"
                  size="sm"
                >
                  {isSelected ? 'Selected' : 'Select Version'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
