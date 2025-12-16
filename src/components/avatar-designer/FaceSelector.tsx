import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface FaceSelectorProps {
  // Eyes
  selectedEyeStyle: string;
  eyeColor: string;
  eyeSize: number;
  eyeSpacing: number;
  eyeTilt: number;
  onEyeStyleChange: (style: string) => void;
  onEyeColorChange: (color: string) => void;
  onEyeSizeChange: (size: number) => void;
  onEyeSpacingChange: (spacing: number) => void;
  onEyeTiltChange: (tilt: number) => void;
  
  // Eyebrows
  eyebrowStyle: string;
  eyebrowColor: string;
  eyebrowThickness: number;
  onEyebrowStyleChange: (style: string) => void;
  onEyebrowColorChange: (color: string) => void;
  onEyebrowThicknessChange: (thickness: number) => void;
  
  // Nose
  selectedNoseStyle: string;
  noseWidth: number;
  noseLength: number;
  noseBridge: number;
  onNoseStyleChange: (style: string) => void;
  onNoseWidthChange: (width: number) => void;
  onNoseLengthChange: (length: number) => void;
  onNoseBridgeChange: (bridge: number) => void;
  
  // Mouth
  selectedMouthStyle: string;
  lipFullness: number;
  lipWidth: number;
  lipColor: string;
  onMouthStyleChange: (style: string) => void;
  onLipFullnessChange: (fullness: number) => void;
  onLipWidthChange: (width: number) => void;
  onLipColorChange: (color: string) => void;
  
  // Face Structure
  faceWidth: number;
  faceLength: number;
  jawShape: string;
  cheekbone: number;
  chinProminence: number;
  onFaceWidthChange: (width: number) => void;
  onFaceLengthChange: (length: number) => void;
  onJawShapeChange: (shape: string) => void;
  onCheekboneChange: (cheekbone: number) => void;
  onChinProminenceChange: (chin: number) => void;
  
  // Ears
  earSize: number;
  earAngle: number;
  onEarSizeChange: (size: number) => void;
  onEarAngleChange: (angle: number) => void;
  
  // Extras
  selectedBeardStyle: string | null;
  selectedTattooStyle: string | null;
  selectedScarStyle: string | null;
  onBeardStyleChange: (style: string | null) => void;
  onTattooStyleChange: (style: string | null) => void;
  onScarStyleChange: (style: string | null) => void;
  
  // Purchase
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

const eyeColors = [
  { name: 'Brown', value: '#2d1a0a' },
  { name: 'Dark Brown', value: '#1a0f05' },
  { name: 'Hazel', value: '#8b7355' },
  { name: 'Green', value: '#3d5c3d' },
  { name: 'Blue', value: '#4a6fa5' },
  { name: 'Gray', value: '#6b7b8c' },
  { name: 'Amber', value: '#c4a35a' },
  { name: 'Ice Blue', value: '#8fa4c4' },
];

const eyebrowStyles = [
  { id: 'thin', name: 'Thin', icon: '—' },
  { id: 'normal', name: 'Normal', icon: '━' },
  { id: 'thick', name: 'Thick', icon: '▬' },
  { id: 'arched', name: 'Arched', icon: '⌒' },
  { id: 'straight', name: 'Straight', icon: '═' },
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

const lipColors = [
  { name: 'Natural', value: '#c4777f' },
  { name: 'Rose', value: '#d4848c' },
  { name: 'Dark', value: '#8b5a5a' },
  { name: 'Light', value: '#e0a0a8' },
  { name: 'Coral', value: '#e07878' },
  { name: 'Berry', value: '#a05060' },
];

const jawShapes = [
  { id: 'round', name: 'Round', icon: '○' },
  { id: 'square', name: 'Square', icon: '□' },
  { id: 'pointed', name: 'Pointed', icon: '▽' },
  { id: 'oval', name: 'Oval', icon: '◯' },
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

const StyleGrid = ({
  title,
  styles,
  selectedId,
  onChange,
}: {
  title: string;
  styles: { id: string | null; name: string; icon: string }[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) => (
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

const ColorPicker = ({
  title,
  colors,
  selectedColor,
  onChange,
}: {
  title: string;
  colors: { name: string; value: string }[];
  selectedColor: string;
  onChange: (color: string) => void;
}) => (
  <Card>
    <CardHeader className="py-3">
      <CardTitle className="text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent className="py-2">
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all",
              selectedColor === color.value
                ? "border-primary ring-2 ring-primary/50 scale-110"
                : "border-transparent hover:border-muted-foreground/50"
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
    </CardContent>
  </Card>
);

export const FaceSelector = (props: FaceSelectorProps) => {
  return (
    <Tabs defaultValue="structure" className="w-full">
      <TabsList className="w-full grid grid-cols-4 mb-4">
        <TabsTrigger value="structure" className="text-xs">Structure</TabsTrigger>
        <TabsTrigger value="eyes" className="text-xs">Eyes</TabsTrigger>
        <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
        <TabsTrigger value="extras" className="text-xs">Extras</TabsTrigger>
      </TabsList>

      <TabsContent value="structure" className="space-y-4 mt-0">
        {/* Face Shape */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Face Shape</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Face Width"
              value={props.faceWidth}
              min={0.85}
              max={1.15}
              step={0.01}
              onChange={props.onFaceWidthChange}
            />
            <SliderWithLabel
              label="Face Length"
              value={props.faceLength}
              min={0.9}
              max={1.1}
              step={0.01}
              onChange={props.onFaceLengthChange}
            />
          </CardContent>
        </Card>

        {/* Jaw */}
        <StyleGrid
          title="Jaw Shape"
          styles={jawShapes}
          selectedId={props.jawShape}
          onChange={(id) => props.onJawShapeChange(id || 'round')}
        />

        {/* Cheeks & Chin */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Cheeks & Chin</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Cheekbone Prominence"
              value={props.cheekbone}
              min={0}
              max={1}
              step={0.05}
              onChange={props.onCheekboneChange}
              centerValue={0.5}
              displayMultiplier={200}
            />
            <SliderWithLabel
              label="Chin Prominence"
              value={props.chinProminence}
              min={0}
              max={1}
              step={0.05}
              onChange={props.onChinProminenceChange}
              centerValue={0.5}
              displayMultiplier={200}
            />
          </CardContent>
        </Card>

        {/* Ears */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Ears</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Ear Size"
              value={props.earSize}
              min={0.7}
              max={1.3}
              step={0.05}
              onChange={props.onEarSizeChange}
            />
            <SliderWithLabel
              label="Ear Angle"
              value={props.earAngle}
              min={-0.3}
              max={0.3}
              step={0.05}
              onChange={props.onEarAngleChange}
              centerValue={0}
              displayMultiplier={100}
              unit="°"
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="eyes" className="space-y-4 mt-0">
        {/* Eye Style */}
        <StyleGrid
          title="Eye Shape"
          styles={eyeStyles}
          selectedId={props.selectedEyeStyle}
          onChange={(id) => props.onEyeStyleChange(id || 'default')}
        />

        {/* Eye Color */}
        <ColorPicker
          title="Eye Color"
          colors={eyeColors}
          selectedColor={props.eyeColor}
          onChange={props.onEyeColorChange}
        />

        {/* Eye Adjustments */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Eye Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Eye Size"
              value={props.eyeSize}
              min={0.8}
              max={1.2}
              step={0.02}
              onChange={props.onEyeSizeChange}
            />
            <SliderWithLabel
              label="Eye Spacing"
              value={props.eyeSpacing}
              min={0.8}
              max={1.2}
              step={0.02}
              onChange={props.onEyeSpacingChange}
            />
            <SliderWithLabel
              label="Eye Tilt"
              value={props.eyeTilt}
              min={-0.2}
              max={0.2}
              step={0.02}
              onChange={props.onEyeTiltChange}
              centerValue={0}
              displayMultiplier={100}
              unit="°"
            />
          </CardContent>
        </Card>

        {/* Eyebrows */}
        <StyleGrid
          title="Eyebrow Style"
          styles={eyebrowStyles}
          selectedId={props.eyebrowStyle}
          onChange={(id) => props.onEyebrowStyleChange(id || 'normal')}
        />

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Eyebrow Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Eyebrow Thickness"
              value={props.eyebrowThickness}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={props.onEyebrowThicknessChange}
            />
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Eyebrow Color</span>
              <div className="flex flex-wrap gap-2">
                {['#1a1a1a', '#2d1a0a', '#4a3020', '#8b7355', '#d4a574', '#f5deb3'].map((color) => (
                  <button
                    key={color}
                    onClick={() => props.onEyebrowColorChange(color)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      props.eyebrowColor === color
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-transparent hover:border-muted-foreground/50"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="features" className="space-y-4 mt-0">
        {/* Nose */}
        <StyleGrid
          title="Nose Shape"
          styles={noseStyles}
          selectedId={props.selectedNoseStyle}
          onChange={(id) => props.onNoseStyleChange(id || 'default')}
        />

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Nose Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Nose Width"
              value={props.noseWidth}
              min={0.8}
              max={1.2}
              step={0.02}
              onChange={props.onNoseWidthChange}
            />
            <SliderWithLabel
              label="Nose Length"
              value={props.noseLength}
              min={0.8}
              max={1.2}
              step={0.02}
              onChange={props.onNoseLengthChange}
            />
            <SliderWithLabel
              label="Nose Bridge"
              value={props.noseBridge}
              min={0}
              max={1}
              step={0.05}
              onChange={props.onNoseBridgeChange}
              centerValue={0.5}
              displayMultiplier={200}
            />
          </CardContent>
        </Card>

        {/* Mouth */}
        <StyleGrid
          title="Mouth Shape"
          styles={mouthStyles}
          selectedId={props.selectedMouthStyle}
          onChange={(id) => props.onMouthStyleChange(id || 'default')}
        />

        <ColorPicker
          title="Lip Color"
          colors={lipColors}
          selectedColor={props.lipColor}
          onChange={props.onLipColorChange}
        />

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Lip Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            <SliderWithLabel
              label="Lip Fullness"
              value={props.lipFullness}
              min={0.7}
              max={1.3}
              step={0.05}
              onChange={props.onLipFullnessChange}
            />
            <SliderWithLabel
              label="Lip Width"
              value={props.lipWidth}
              min={0.8}
              max={1.2}
              step={0.05}
              onChange={props.onLipWidthChange}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="extras" className="space-y-4 mt-0">
        <StyleGrid
          title="Facial Hair"
          styles={beardStyles}
          selectedId={props.selectedBeardStyle}
          onChange={props.onBeardStyleChange}
        />
        <StyleGrid
          title="Tattoos"
          styles={tattooStyles}
          selectedId={props.selectedTattooStyle}
          onChange={props.onTattooStyleChange}
        />
        <StyleGrid
          title="Scars"
          styles={scarStyles}
          selectedId={props.selectedScarStyle}
          onChange={props.onScarStyleChange}
        />
      </TabsContent>
    </Tabs>
  );
};