import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FaceOption {
  id: string;
  name: string;
  feature_type: string;
  price: number | null;
  is_premium: boolean | null;
  shape_config: Record<string, unknown> | null;
}

interface FaceSelectorProps {
  faceOptions: FaceOption[];
  selectedEyeStyle: string;
  selectedNoseStyle: string;
  selectedMouthStyle: string;
  selectedBeardStyle: string | null;
  selectedTattooStyle: string | null;
  selectedScarStyle: string | null;
  onEyeStyleChange: (style: string) => void;
  onNoseStyleChange: (style: string) => void;
  onMouthStyleChange: (style: string) => void;
  onBeardStyleChange: (style: string | null) => void;
  onTattooStyleChange: (style: string | null) => void;
  onScarStyleChange: (style: string | null) => void;
  isItemOwned: (id: string) => boolean;
  onPurchase: (id: string, price: number) => void;
}

const eyeStyles = [
  { id: 'default', name: 'Normal', icon: '👁️' },
  { id: 'wide', name: 'Wide', icon: '😲' },
  { id: 'narrow', name: 'Narrow', icon: '😑' },
  { id: 'almond', name: 'Almond', icon: '👀' },
  { id: 'round', name: 'Round', icon: '🔵' },
];

const noseStyles = [
  { id: 'default', name: 'Normal', icon: '👃' },
  { id: 'small', name: 'Small', icon: '·' },
  { id: 'wide', name: 'Wide', icon: '◇' },
  { id: 'pointed', name: 'Pointed', icon: '▽' },
  { id: 'button', name: 'Button', icon: '○' },
];

const mouthStyles = [
  { id: 'default', name: 'Normal', icon: '👄' },
  { id: 'wide', name: 'Wide', icon: '😀' },
  { id: 'thin', name: 'Thin', icon: '😐' },
  { id: 'full', name: 'Full', icon: '💋' },
  { id: 'smirk', name: 'Smirk', icon: '😏' },
];

const beardStyles = [
  { id: null, name: 'None', icon: '🧑' },
  { id: 'stubble', name: 'Stubble', icon: '🧔' },
  { id: 'goatee', name: 'Goatee', icon: '🎭' },
  { id: 'full', name: 'Full Beard', icon: '🧔‍♂️' },
  { id: 'mustache', name: 'Mustache', icon: '🥸' },
  { id: 'mutton', name: 'Mutton Chops', icon: '👨' },
];

const tattooStyles = [
  { id: null, name: 'None', icon: '✨' },
  { id: 'Sleeve Tattoo', name: 'Sleeve', icon: '💪' },
  { id: 'Neck Tattoo', name: 'Neck', icon: '🎵' },
  { id: 'Face Tattoo', name: 'Face', icon: '🌟' },
  { id: 'Back Piece', name: 'Back', icon: '🎨' },
];

const scarStyles = [
  { id: null, name: 'None', icon: '✨' },
  { id: 'Cheek Scar', name: 'Cheek', icon: '⚔️' },
  { id: 'Eye Scar', name: 'Eye', icon: '👁️' },
  { id: 'Lip Scar', name: 'Lip', icon: '💋' },
  { id: 'Forehead Scar', name: 'Forehead', icon: '⚡' },
];

export const FaceSelector = ({
  selectedEyeStyle,
  selectedNoseStyle,
  selectedMouthStyle,
  selectedBeardStyle,
  selectedTattooStyle,
  selectedScarStyle,
  onEyeStyleChange,
  onNoseStyleChange,
  onMouthStyleChange,
  onBeardStyleChange,
  onTattooStyleChange,
  onScarStyleChange,
}: FaceSelectorProps) => {
  const renderStyleGrid = (
    title: string,
    styles: { id: string | null; name: string; icon: string }[],
    selectedId: string | null,
    onChange: (id: string | null) => void
  ) => (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {styles.map((style) => (
            <button
              key={style.id || 'none'}
              onClick={() => onChange(style.id)}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                selectedId === style.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <span className="text-xl mb-1">{style.icon}</span>
              <span className="text-[10px] font-medium">{style.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderStyleGrid('Eye Style', eyeStyles, selectedEyeStyle, (id) => onEyeStyleChange(id || 'default'))}
      {renderStyleGrid('Nose Style', noseStyles, selectedNoseStyle, (id) => onNoseStyleChange(id || 'default'))}
      {renderStyleGrid('Mouth Style', mouthStyles, selectedMouthStyle, (id) => onMouthStyleChange(id || 'default'))}
      {renderStyleGrid('Facial Hair', beardStyles, selectedBeardStyle, onBeardStyleChange)}
      {renderStyleGrid('Tattoos', tattooStyles, selectedTattooStyle, onTattooStyleChange)}
      {renderStyleGrid('Scars', scarStyles, selectedScarStyle, onScarStyleChange)}
    </div>
  );
};
