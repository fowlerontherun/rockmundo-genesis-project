import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface BodySelectorProps {
  bodyType: 'slim' | 'average' | 'muscular' | 'heavy';
  height: number;
  skinTone: string;
  gender: string;
  weight: number;
  muscleDefinition: number;
  shoulderWidth: number;
  hipWidth: number;
  torsoLength: number;
  armLength: number;
  legLength: number;
  ageAppearance: 'young' | 'adult' | 'mature';
  onBodyTypeChange: (type: 'slim' | 'average' | 'muscular' | 'heavy') => void;
  onHeightChange: (height: number) => void;
  onSkinToneChange: (tone: string) => void;
  onGenderChange: (gender: string) => void;
  onWeightChange: (weight: number) => void;
  onMuscleDefinitionChange: (muscle: number) => void;
  onShoulderWidthChange: (width: number) => void;
  onHipWidthChange: (width: number) => void;
  onTorsoLengthChange: (length: number) => void;
  onArmLengthChange: (length: number) => void;
  onLegLengthChange: (length: number) => void;
  onAgeAppearanceChange: (age: 'young' | 'adult' | 'mature') => void;
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

const ageOptions = [
  { id: 'young', name: 'Young', icon: '🧒' },
  { id: 'adult', name: 'Adult', icon: '🧑' },
  { id: 'mature', name: 'Mature', icon: '🧓' },
] as const;

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

const SliderWithLabel = ({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  onChange,
  unit = '%',
  displayMultiplier = 100,
  centerValue = 1,
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step: number;
  onChange: (val: number) => void;
  unit?: string;
  displayMultiplier?: number;
  centerValue?: number;
}) => {
  const displayValue = Math.round((value - centerValue) * displayMultiplier);
  const displayText = displayValue >= 0 ? `+${displayValue}${unit}` : `${displayValue}${unit}`;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-primary">{displayText}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
};

export const BodySelector = ({
  bodyType,
  height,
  skinTone,
  gender,
  weight,
  muscleDefinition,
  shoulderWidth,
  hipWidth,
  torsoLength,
  armLength,
  legLength,
  ageAppearance,
  onBodyTypeChange,
  onHeightChange,
  onSkinToneChange,
  onGenderChange,
  onWeightChange,
  onMuscleDefinitionChange,
  onShoulderWidthChange,
  onHipWidthChange,
  onTorsoLengthChange,
  onArmLengthChange,
  onLegLengthChange,
  onAgeAppearanceChange,
}: BodySelectorProps) => {
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="w-full grid grid-cols-3 mb-4">
        <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
        <TabsTrigger value="build" className="text-xs">Build</TabsTrigger>
        <TabsTrigger value="proportions" className="text-xs">Proportions</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4 mt-0">
        {/* Gender */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Gender</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-4 gap-2">
              {genderOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onGenderChange(option.id)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                    gender === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="text-xl mb-1">{option.icon}</span>
                  <span className="text-[10px] font-medium">{option.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Age Appearance */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Age Appearance</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-3 gap-2">
              {ageOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onAgeAppearanceChange(option.id)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                    ageAppearance === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="text-xl mb-1">{option.icon}</span>
                  <span className="text-[10px] font-medium">{option.name}</span>
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
            <div className="grid grid-cols-4 gap-2">
              {bodyTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => onBodyTypeChange(type.id)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                    bodyType === type.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="text-xl mb-1">{type.icon}</span>
                  <span className="text-[10px] font-medium">{type.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="build" className="space-y-4 mt-0">
        {/* Height */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Height</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <SliderWithLabel
              label="Overall Height"
              value={height}
              min={0.8}
              max={1.2}
              step={0.01}
              onChange={onHeightChange}
            />
          </CardContent>
        </Card>

        {/* Weight / Mass */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Body Mass</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Weight"
              value={weight}
              min={0.7}
              max={1.3}
              step={0.01}
              onChange={onWeightChange}
            />
            <SliderWithLabel
              label="Muscle Definition"
              value={muscleDefinition}
              min={0}
              max={1}
              step={0.05}
              onChange={onMuscleDefinitionChange}
              centerValue={0.5}
              displayMultiplier={200}
            />
          </CardContent>
        </Card>

        {/* Upper Body */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Upper Body</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Shoulder Width"
              value={shoulderWidth}
              min={0.8}
              max={1.2}
              step={0.01}
              onChange={onShoulderWidthChange}
            />
            <SliderWithLabel
              label="Hip Width"
              value={hipWidth}
              min={0.8}
              max={1.2}
              step={0.01}
              onChange={onHipWidthChange}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="proportions" className="space-y-4 mt-0">
        {/* Torso */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Torso</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <SliderWithLabel
              label="Torso Length"
              value={torsoLength}
              min={0.85}
              max={1.15}
              step={0.01}
              onChange={onTorsoLengthChange}
            />
          </CardContent>
        </Card>

        {/* Limbs */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Limbs</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Arm Length"
              value={armLength}
              min={0.85}
              max={1.15}
              step={0.01}
              onChange={onArmLengthChange}
            />
            <SliderWithLabel
              label="Leg Length"
              value={legLength}
              min={0.85}
              max={1.15}
              step={0.01}
              onChange={onLegLengthChange}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};