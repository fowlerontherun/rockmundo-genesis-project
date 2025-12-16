import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface BodySelectorProps {
  bodyType: 'slim' | 'average' | 'muscular' | 'heavy';
  height: number;
  skinTone: string;
  gender: string;
  onBodyTypeChange: (type: 'slim' | 'average' | 'muscular' | 'heavy') => void;
  onHeightChange: (height: number) => void;
  onSkinToneChange: (tone: string) => void;
  onGenderChange: (gender: string) => void;
}

const bodyTypes = [
  { id: 'slim', name: 'Slim', icon: '🧍' },
  { id: 'average', name: 'Average', icon: '🧑' },
  { id: 'muscular', name: 'Muscular', icon: '💪' },
  { id: 'heavy', name: 'Heavy', icon: '🏋️' },
] as const;

const genderOptions = [
  { id: 'male', name: 'Male', icon: '♂️' },
  { id: 'female', name: 'Female', icon: '♀️' },
  { id: 'non-binary', name: 'Non-binary', icon: '⚧️' },
  { id: 'other', name: 'Other', icon: '🌟' },
];

const skinTones = [
  { name: 'Pale', value: '#ffdbac' },
  { name: 'Fair', value: '#f5deb3' },
  { name: 'Light', value: '#f1c27d' },
  { name: 'Medium Light', value: '#e0ac69' },
  { name: 'Medium', value: '#c68642' },
  { name: 'Medium Dark', value: '#a5673f' },
  { name: 'Dark', value: '#8d5524' },
  { name: 'Deep', value: '#6b4423' },
  { name: 'Very Deep', value: '#4a3020' },
  { name: 'Ebony', value: '#3d2816' },
];

export const BodySelector = ({
  bodyType,
  height,
  skinTone,
  gender,
  onBodyTypeChange,
  onHeightChange,
  onSkinToneChange,
  onGenderChange,
}: BodySelectorProps) => {
  return (
    <div className="space-y-6">
      {/* Gender */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Gender</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-4 gap-3">
            {genderOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => onGenderChange(option.id)}
                className={cn(
                  "flex flex-col items-center p-3 rounded-lg border-2 transition-all",
                  gender === option.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <span className="text-2xl mb-1">{option.icon}</span>
                <span className="text-xs font-medium">{option.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skin Tone */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Skin Tone</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-5 gap-3">
            {skinTones.map((tone) => (
              <button
                key={tone.value}
                onClick={() => onSkinToneChange(tone.value)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all",
                  skinTone === tone.value
                    ? "border-primary ring-2 ring-primary/50 scale-110"
                    : "border-transparent hover:border-muted-foreground/50"
                )}
                style={{ backgroundColor: tone.value }}
                title={tone.name}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Body Type */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Body Type</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-4 gap-3">
            {bodyTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onBodyTypeChange(type.id)}
                className={cn(
                  "flex flex-col items-center p-3 rounded-lg border-2 transition-all",
                  bodyType === type.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <span className="text-2xl mb-1">{type.icon}</span>
                <span className="text-xs font-medium">{type.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Height */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Height</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="space-y-4">
            <Slider
              value={[height]}
              onValueChange={([val]) => onHeightChange(val)}
              min={0.85}
              max={1.15}
              step={0.01}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Short</span>
              <span className="font-medium text-foreground">
                {Math.round((height - 1) * 100)}%
              </span>
              <span>Tall</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
