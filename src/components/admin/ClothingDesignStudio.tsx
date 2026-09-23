import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Layers3, Palette, Scissors, Sparkles, Shirt, Wand2 } from "lucide-react";
import { GarmentSurfaceEditor } from "@/components/admin/clothing/GarmentSurfaceEditor";
import { GARMENT_TEMPLATES, inferGarmentTemplateKey } from "@/features/clothing-preview/garmentTemplates";

export type DetailLayerType = "decal" | "graphic" | "text" | "patch" | "embroidery" | "trim" | "studs" | "zip" | "buttons" | "distress" | "stitching" | "badge";

export interface ClothingDesignConfig {
  garment: {
    templateKey: string;
    silhouette: string;
    cut: string;
    length: string;
    sleeve: string;
    collar: string;
    closure: string;
    hem: string;
    asymmetry: boolean;
    widthScale: number;
    bodyLengthScale: number;
    sleeveLengthScale: number;
    sleeveWidthScale: number;
    waistScale: number;
    flare: number;
  };
  material: {
    fabric: string;
    primaryColor: string;
    secondaryColor: string;
    roughness: number;
    sheen: number;
    metallic: number;
    textureScale: number;
    thickness: number;
  };
  pattern: {
    type: string;
    color: string;
    secondaryColor: string;
    scale: number;
    rotation: number;
    opacity: number;
    repeat: string;
  };
  fit: {
    fit: string;
    waist: string;
    rise: string;
    drape: number;
    oversized: number;
    taper: number;
  };
  wear: {
    condition: string;
    fade: number;
    distress: number;
    dirt: number;
    tears: number;
  };
  render: {
    layer: number;
    depthOffset: number;
    bodyOffsetY: number;
    bodyOffsetX: number;
    scale: number;
    castShadow: boolean;
  };
  zones: Array<{ id: string; name: string; color: string; playerEditable: boolean }>;
  details: Array<{
    id: string;
    type: DetailLayerType;
    name: string;
    zone: string;
    color: string;
    secondaryColor: string;
    text?: string;
    asset?: string;
    scale: number;
    rotation: number;
    opacity: number;
    offsetX: number;
    offsetY: number;
    surface?: "front" | "back" | "left-sleeve" | "right-sleeve";
    widthScale?: number;
    heightScale?: number;
  }>;
  variants: Array<{ name: string; primaryColor: string; secondaryColor: string; pattern: string; material: string }>;
}

export const DEFAULT_CLOTHING_DESIGN: ClothingDesignConfig = {
  garment: { templateKey: "tshirt", silhouette: "classic", cut: "regular", length: "standard", sleeve: "standard", collar: "crew", closure: "none", hem: "straight", asymmetry: false, widthScale: 100, bodyLengthScale: 100, sleeveLengthScale: 100, sleeveWidthScale: 100, waistScale: 100, flare: 0 },
  material: { fabric: "cotton", primaryColor: "#111111", secondaryColor: "#ffffff", roughness: 65, sheen: 10, metallic: 0, textureScale: 100, thickness: 50 },
  pattern: { type: "solid", color: "#111111", secondaryColor: "#ffffff", scale: 100, rotation: 0, opacity: 100, repeat: "tile" },
  fit: { fit: "regular", waist: "natural", rise: "mid", drape: 50, oversized: 0, taper: 25 },
  wear: { condition: "new", fade: 0, distress: 0, dirt: 0, tears: 0 },
  render: { layer: 10, depthOffset: 0, bodyOffsetY: 0, bodyOffsetX: 0, scale: 100, castShadow: true },
  zones: [
    { id: "main", name: "Main fabric", color: "#111111", playerEditable: true },
    { id: "trim", name: "Trim", color: "#ffffff", playerEditable: true },
  ],
  details: [],
  variants: [],
};

const FABRICS = ["cotton", "denim", "leather", "suede", "silk", "satin", "velvet", "wool", "canvas", "mesh", "nylon", "vinyl", "latex", "sequins", "metallic", "faux-fur"];
const PATTERNS = ["solid", "stripes", "checks", "tartan", "polka-dot", "floral", "paisley", "camouflage", "animal", "tie-dye", "gradient", "geometric", "stars", "flames", "custom-print"];
const SILHOUETTES = ["classic", "boxy", "slim", "oversized", "cropped", "longline", "fitted", "relaxed", "structured", "draped", "asymmetric"];
const CUTS = ["regular", "slim", "skinny", "relaxed", "oversized", "tailored", "cropped", "drop-shoulder", "high-waist", "low-rise"];
const COLLARS = ["none", "crew", "v-neck", "scoop", "polo", "shirt", "mandarin", "turtleneck", "hood", "lapel", "biker"];
const SLEEVES = ["none", "cap", "short", "elbow", "three-quarter", "long", "rolled", "bell", "raglan"];
const CLOSURES = ["none", "buttons", "zip", "double-zip", "snaps", "lace", "buckle", "hook", "wrap"];
const CONDITIONS = ["new", "washed", "faded", "vintage", "distressed", "heavily-distressed", "stage-worn"];
const DETAIL_TYPES: DetailLayerType[] = ["decal", "graphic", "text", "patch", "embroidery", "trim", "studs", "zip", "buttons", "distress", "stitching", "badge"];

const CATEGORY_PRESETS: Record<string, Partial<ClothingDesignConfig["garment"]>> = {
  "t-shirt": { silhouette: "classic", cut: "regular", length: "standard", sleeve: "short", collar: "crew", closure: "none", hem: "straight", widthScale: 100, bodyLengthScale: 100, sleeveLengthScale: 100, sleeveWidthScale: 100, waistScale: 96, flare: 0 },
  shirt: { silhouette: "fitted", cut: "tailored", length: "standard", sleeve: "long", collar: "shirt", closure: "buttons", hem: "curved", widthScale: 98, bodyLengthScale: 104, sleeveLengthScale: 100, sleeveWidthScale: 92, waistScale: 90, flare: 0 },
  "tank-top": { silhouette: "fitted", cut: "slim", length: "standard", sleeve: "none", collar: "scoop", closure: "none", hem: "straight", widthScale: 94, bodyLengthScale: 96, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 90, flare: 0 },
  hoodie: { silhouette: "relaxed", cut: "relaxed", length: "standard", sleeve: "long", collar: "hood", closure: "none", hem: "ribbed", widthScale: 108, bodyLengthScale: 106, sleeveLengthScale: 108, sleeveWidthScale: 112, waistScale: 98, flare: 0 },
  sweater: { silhouette: "relaxed", cut: "regular", length: "standard", sleeve: "long", collar: "crew", closure: "none", hem: "ribbed", widthScale: 104, bodyLengthScale: 102, sleeveLengthScale: 104, sleeveWidthScale: 106, waistScale: 96, flare: 0 },
  jacket: { silhouette: "structured", cut: "tailored", length: "standard", sleeve: "long", collar: "lapel", closure: "zip", hem: "straight", widthScale: 106, bodyLengthScale: 102, sleeveLengthScale: 104, sleeveWidthScale: 108, waistScale: 94, flare: 0 },
  coat: { silhouette: "structured", cut: "tailored", length: "long", sleeve: "long", collar: "lapel", closure: "buttons", hem: "straight", widthScale: 110, bodyLengthScale: 138, sleeveLengthScale: 108, sleeveWidthScale: 112, waistScale: 100, flare: 6 },
  vest: { silhouette: "fitted", cut: "tailored", length: "standard", sleeve: "none", collar: "v-neck", closure: "buttons", hem: "pointed", widthScale: 96, bodyLengthScale: 96, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 86, flare: 0 },
  dress: { silhouette: "fitted", cut: "tailored", length: "standard", sleeve: "short", collar: "scoop", closure: "none", hem: "straight", widthScale: 98, bodyLengthScale: 108, sleeveLengthScale: 95, sleeveWidthScale: 94, waistScale: 82, flare: 42 },
  skirt: { silhouette: "a-line", cut: "regular", length: "standard", sleeve: "none", collar: "none", closure: "zip", hem: "straight", widthScale: 100, bodyLengthScale: 100, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 82, flare: 48 },
  pants: { silhouette: "classic", cut: "regular", length: "standard", sleeve: "none", collar: "none", closure: "zip", hem: "straight", widthScale: 100, bodyLengthScale: 100, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 92, flare: 0 },
  jeans: { silhouette: "classic", cut: "slim", length: "standard", sleeve: "none", collar: "none", closure: "zip", hem: "straight", widthScale: 98, bodyLengthScale: 100, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 90, flare: 0 },
  shorts: { silhouette: "classic", cut: "regular", length: "short", sleeve: "none", collar: "none", closure: "zip", hem: "straight", widthScale: 100, bodyLengthScale: 72, sleeveLengthScale: 40, sleeveWidthScale: 70, waistScale: 92, flare: 0 },
};

function NumberSlider({ label, value, min = 0, max = 100, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return <div className="space-y-2"><div className="flex justify-between"><Label>{label}</Label><span className="text-xs text-muted-foreground">{value}</span></div><Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} /></div>;
}

function FieldSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (v: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{values.map(v => <SelectItem key={v} value={v} className="capitalize">{v.replaceAll("-", " ")}</SelectItem>)}</SelectContent></Select></div>;
}

export function ClothingDesignStudio({ value, onChange, category }: { value: ClothingDesignConfig; onChange: (value: ClothingDesignConfig) => void; category?: string }) {
  const set = <K extends keyof ClothingDesignConfig>(key: K, patch: Partial<ClothingDesignConfig[K]>) => onChange({ ...value, [key]: { ...(value[key] as any), ...patch } });
  const addZone = () => onChange({ ...value, zones: [...value.zones, { id: `zone_${Date.now()}`, name: "New zone", color: "#ffffff", playerEditable: true }] });
  const addDetail = () => onChange({ ...value, details: [...value.details, { id: crypto.randomUUID(), type: "graphic", name: "New detail", zone: value.zones[0]?.id || "main", color: "#ffffff", secondaryColor: "#000000", scale: 100, rotation: 0, opacity: 100, offsetX: 0, offsetY: 0, surface: "front", widthScale: 100, heightScale: 100 }] });
  const addVariant = () => onChange({ ...value, variants: [...value.variants, { name: `Variant ${value.variants.length + 1}`, primaryColor: value.material.primaryColor, secondaryColor: value.material.secondaryColor, pattern: value.pattern.type, material: value.material.fabric }] });
  const preset = CATEGORY_PRESETS[String(category || "").toLowerCase()];
  const applyCategoryPreset = () => {
    if (!preset) return;
    onChange({ ...value, garment: { ...value.garment, ...preset, templateKey: inferGarmentTemplateKey(category) } });
  };

  return <div className="space-y-5">
    {preset && <Card className="border-primary/20 bg-primary/5"><CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-sm font-medium">Recommended {String(category).replaceAll("-", " ")} proportions</div><p className="text-xs text-muted-foreground">Start from body-safe proportions for this garment type, then fine tune every measurement below.</p></div>
      <Button type="button" size="sm" variant="outline" onClick={applyCategoryPreset}><Wand2 className="h-4 w-4 mr-1"/>Apply garment preset</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Scissors className="h-4 w-4"/>Garment construction</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="space-y-2"><Label>Garment template</Label><Select value={value.garment.templateKey || inferGarmentTemplateKey(category)} onValueChange={v=>set("garment",{templateKey:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GARMENT_TEMPLATES.map(template=><SelectItem key={template.key} value={template.key}>{template.label}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground">Controls the base garment family used by the renderer.</p></div>
      <FieldSelect label="Silhouette" value={value.garment.silhouette} values={SILHOUETTES} onChange={v=>set("garment",{silhouette:v})}/>
      <FieldSelect label="Cut" value={value.garment.cut} values={CUTS} onChange={v=>set("garment",{cut:v})}/>
      <FieldSelect label="Sleeve" value={value.garment.sleeve} values={SLEEVES} onChange={v=>set("garment",{sleeve:v})}/>
      <FieldSelect label="Collar / neck" value={value.garment.collar} values={COLLARS} onChange={v=>set("garment",{collar:v})}/>
      <FieldSelect label="Closure" value={value.garment.closure} values={CLOSURES} onChange={v=>set("garment",{closure:v})}/>
      <div className="space-y-2"><Label>Length</Label><Input value={value.garment.length} onChange={e=>set("garment",{length:e.target.value})}/></div>
      <div className="space-y-2"><Label>Hem</Label><Input value={value.garment.hem} onChange={e=>set("garment",{hem:e.target.value})}/></div>
      <div className="flex items-end gap-2 pb-2"><Switch checked={value.garment.asymmetry} onCheckedChange={v=>set("garment",{asymmetry:v})}/><Label>Asymmetric</Label></div>
      <NumberSlider label="Body width %" value={value.garment.widthScale ?? 100} min={70} max={140} onChange={v=>set("garment",{widthScale:v})}/>
      <NumberSlider label="Body length %" value={value.garment.bodyLengthScale ?? 100} min={65} max={150} onChange={v=>set("garment",{bodyLengthScale:v})}/>
      <NumberSlider label="Sleeve length %" value={value.garment.sleeveLengthScale ?? 100} min={40} max={160} onChange={v=>set("garment",{sleeveLengthScale:v})}/>
      <NumberSlider label="Sleeve width %" value={value.garment.sleeveWidthScale ?? 100} min={60} max={150} onChange={v=>set("garment",{sleeveWidthScale:v})}/>
      <NumberSlider label="Waist / hem width %" value={value.garment.waistScale ?? 100} min={60} max={150} onChange={v=>set("garment",{waistScale:v})}/>
      <NumberSlider label="Flare %" value={value.garment.flare ?? 0} min={0} max={100} onChange={v=>set("garment",{flare:v})}/>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4"/>Material & surface</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <FieldSelect label="Fabric" value={value.material.fabric} values={FABRICS} onChange={v=>set("material",{fabric:v})}/>
      <div className="space-y-2"><Label>Primary colour</Label><Input type="color" value={value.material.primaryColor} onChange={e=>set("material",{primaryColor:e.target.value})}/></div>
      <div className="space-y-2"><Label>Secondary colour</Label><Input type="color" value={value.material.secondaryColor} onChange={e=>set("material",{secondaryColor:e.target.value})}/></div>
      <NumberSlider label="Texture scale" value={value.material.textureScale} min={20} max={300} onChange={v=>set("material",{textureScale:v})}/>
      <NumberSlider label="Roughness" value={value.material.roughness} onChange={v=>set("material",{roughness:v})}/>
      <NumberSlider label="Sheen" value={value.material.sheen} onChange={v=>set("material",{sheen:v})}/>
      <NumberSlider label="Metallic" value={value.material.metallic} onChange={v=>set("material",{metallic:v})}/>
      <NumberSlider label="Thickness" value={value.material.thickness} onChange={v=>set("material",{thickness:v})}/>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4"/>Pattern & print</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <FieldSelect label="Pattern" value={value.pattern.type} values={PATTERNS} onChange={v=>set("pattern",{type:v})}/>
      <div className="space-y-2"><Label>Pattern colour</Label><Input type="color" value={value.pattern.color} onChange={e=>set("pattern",{color:e.target.value})}/></div>
      <div className="space-y-2"><Label>Accent colour</Label><Input type="color" value={value.pattern.secondaryColor} onChange={e=>set("pattern",{secondaryColor:e.target.value})}/></div>
      <FieldSelect label="Repeat" value={value.pattern.repeat} values={["tile","mirror","stretch","single"]} onChange={v=>set("pattern",{repeat:v})}/>
      <NumberSlider label="Pattern scale" value={value.pattern.scale} min={10} max={400} onChange={v=>set("pattern",{scale:v})}/>
      <NumberSlider label="Rotation" value={value.pattern.rotation} min={-180} max={180} onChange={v=>set("pattern",{rotation:v})}/>
      <NumberSlider label="Opacity" value={value.pattern.opacity} onChange={v=>set("pattern",{opacity:v})}/>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4"/>Fit, drape & wear</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <FieldSelect label="Fit" value={value.fit.fit} values={["skinny","slim","regular","relaxed","oversized"]} onChange={v=>set("fit",{fit:v})}/>
      <FieldSelect label="Condition" value={value.wear.condition} values={CONDITIONS} onChange={v=>set("wear",{condition:v})}/>
      <NumberSlider label="Drape" value={value.fit.drape} onChange={v=>set("fit",{drape:v})}/>
      <NumberSlider label="Oversize" value={value.fit.oversized} onChange={v=>set("fit",{oversized:v})}/>
      <NumberSlider label="Taper" value={value.fit.taper} onChange={v=>set("fit",{taper:v})}/>
      <NumberSlider label="Fade" value={value.wear.fade} onChange={v=>set("wear",{fade:v})}/>
      <NumberSlider label="Distress" value={value.wear.distress} onChange={v=>set("wear",{distress:v})}/>
      <NumberSlider label="Tears" value={value.wear.tears} onChange={v=>set("wear",{tears:v})}/>
    </CardContent></Card>

    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Layers3 className="h-4 w-4"/>Customisation zones</CardTitle><Button type="button" size="sm" variant="outline" onClick={addZone}><Plus className="h-4 w-4 mr-1"/>Zone</Button></CardHeader><CardContent className="space-y-3">
      {value.zones.map((zone,i)=><div key={zone.id} className="grid grid-cols-[1fr_130px_auto_auto] gap-2 items-center"><Input value={zone.name} onChange={e=>{const zones=[...value.zones]; zones[i]={...zone,name:e.target.value}; onChange({...value,zones});}}/><Input type="color" value={zone.color} onChange={e=>{const zones=[...value.zones]; zones[i]={...zone,color:e.target.value}; onChange({...value,zones});}}/><div className="flex items-center gap-2"><Switch checked={zone.playerEditable} onCheckedChange={checked=>{const zones=[...value.zones]; zones[i]={...zone,playerEditable:checked}; onChange({...value,zones});}}/><span className="text-xs">Player editable</span></div><Button type="button" size="icon" variant="ghost" onClick={()=>onChange({...value,zones:value.zones.filter((_,idx)=>idx!==i)})}><Trash2 className="h-4 w-4"/></Button></div>)}
    </CardContent></Card>

    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4"/>Visual garment surface designer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Design directly on the front, back and sleeves. Drag elements on the garment and the live 3D preview updates from the same saved detail data.</p>
        <GarmentSurfaceEditor
          category={category}
          templateKey={value.garment.templateKey}
          layers={value.details}
          onChange={details => onChange({ ...value, details: details as ClothingDesignConfig["details"] })}
        />
      </CardContent>
    </Card>

    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4"/>Advanced detail layers <Badge variant="secondary">{value.details.length}/24</Badge></CardTitle><Button type="button" size="sm" variant="outline" onClick={addDetail} disabled={value.details.length>=24}><Plus className="h-4 w-4 mr-1"/>Detail</Button></CardHeader><CardContent className="space-y-4">
      {value.details.length===0 && <p className="text-sm text-muted-foreground">Layer graphics, text, patches, embroidery, zips, studs, trims, stitching and distressing over the base garment.</p>}
      {value.details.map((detail,i)=><div key={detail.id} className="rounded-lg border p-3 space-y-3"><div className="flex items-center justify-between"><div className="flex gap-2"><Badge>{i+1}</Badge><Input className="h-8" value={detail.name} onChange={e=>{const details=[...value.details]; details[i]={...detail,name:e.target.value}; onChange({...value,details});}}/></div><Button type="button" size="icon" variant="ghost" onClick={()=>onChange({...value,details:value.details.filter((_,idx)=>idx!==i)})}><Trash2 className="h-4 w-4"/></Button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FieldSelect label="Type" value={detail.type} values={DETAIL_TYPES} onChange={v=>{const details=[...value.details]; details[i]={...detail,type:v as DetailLayerType}; onChange({...value,details});}}/>
        <FieldSelect label="Zone" value={detail.zone} values={value.zones.map(z=>z.id)} onChange={v=>{const details=[...value.details]; details[i]={...detail,zone:v}; onChange({...value,details});}}/>
        <FieldSelect label="Surface" value={detail.surface || "front"} values={["front","back","left-sleeve","right-sleeve"]} onChange={v=>{const details=[...value.details]; details[i]={...detail,surface:v as any}; onChange({...value,details});}}/>
        <div className="space-y-2"><Label>Colour</Label><Input type="color" value={detail.color} onChange={e=>{const details=[...value.details]; details[i]={...detail,color:e.target.value}; onChange({...value,details});}}/></div>
        {(detail.type==="text"||detail.type==="graphic"||detail.type==="decal"||detail.type==="badge") && <div className="space-y-2"><Label>{detail.type==="text"?"Text":"Asset / motif"}</Label><Input value={detail.type==="text"?(detail.text||""):(detail.asset||"")} onChange={e=>{const details=[...value.details]; details[i]=detail.type==="text"?{...detail,text:e.target.value}:{...detail,asset:e.target.value}; onChange({...value,details});}}/></div>}
        <NumberSlider label="Scale" value={detail.scale} min={10} max={300} onChange={v=>{const details=[...value.details]; details[i]={...detail,scale:v}; onChange({...value,details});}}/>
        <NumberSlider label="Rotation" value={detail.rotation} min={-180} max={180} onChange={v=>{const details=[...value.details]; details[i]={...detail,rotation:v}; onChange({...value,details});}}/>
        <NumberSlider label="Opacity" value={detail.opacity} onChange={v=>{const details=[...value.details]; details[i]={...detail,opacity:v}; onChange({...value,details});}}/>
        <NumberSlider label="Horizontal position" value={detail.offsetX} min={-100} max={100} onChange={v=>{const details=[...value.details]; details[i]={...detail,offsetX:v}; onChange({...value,details});}}/>
        <NumberSlider label="Vertical position" value={detail.offsetY} min={-100} max={100} onChange={v=>{const details=[...value.details]; details[i]={...detail,offsetY:v}; onChange({...value,details});}}/>
        <NumberSlider label="Width %" value={detail.widthScale ?? 100} min={20} max={250} onChange={v=>{const details=[...value.details]; details[i]={...detail,widthScale:v}; onChange({...value,details});}}/>
        <NumberSlider label="Height %" value={detail.heightScale ?? 100} min={20} max={250} onChange={v=>{const details=[...value.details]; details[i]={...detail,heightScale:v}; onChange({...value,details});}}/>
      </div></div>)}
    </CardContent></Card>

    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Named variants <Badge variant="secondary">{value.variants.length}/40</Badge></CardTitle><Button type="button" size="sm" variant="outline" onClick={addVariant} disabled={value.variants.length>=40}><Plus className="h-4 w-4 mr-1"/>Variant</Button></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Create curated colour/material/pattern combinations from one base garment without duplicating the clothing item.</p>
      {value.variants.map((variant,i)=><div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center"><Input value={variant.name} onChange={e=>{const variants=[...value.variants]; variants[i]={...variant,name:e.target.value}; onChange({...value,variants});}}/><Input type="color" value={variant.primaryColor} onChange={e=>{const variants=[...value.variants]; variants[i]={...variant,primaryColor:e.target.value}; onChange({...value,variants});}}/><Input type="color" value={variant.secondaryColor} onChange={e=>{const variants=[...value.variants]; variants[i]={...variant,secondaryColor:e.target.value}; onChange({...value,variants});}}/><Select value={variant.pattern} onValueChange={v=>{const variants=[...value.variants]; variants[i]={...variant,pattern:v}; onChange({...value,variants});}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PATTERNS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Select value={variant.material} onValueChange={v=>{const variants=[...value.variants]; variants[i]={...variant,material:v}; onChange({...value,variants});}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FABRICS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Button type="button" size="icon" variant="ghost" onClick={()=>onChange({...value,variants:value.variants.filter((_,idx)=>idx!==i)})}><Trash2 className="h-4 w-4"/></Button></div>)}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Avatar rendering</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <NumberSlider label="Layer order" value={value.render.layer} min={0} max={50} onChange={v=>set("render",{layer:v})}/>
      <NumberSlider label="Depth offset" value={value.render.depthOffset} min={-20} max={20} onChange={v=>set("render",{depthOffset:v})}/>
      <NumberSlider label="Horizontal offset" value={value.render.bodyOffsetX} min={-50} max={50} onChange={v=>set("render",{bodyOffsetX:v})}/>
      <NumberSlider label="Vertical offset" value={value.render.bodyOffsetY} min={-50} max={50} onChange={v=>set("render",{bodyOffsetY:v})}/>
      <NumberSlider label="Scale" value={value.render.scale} min={50} max={150} onChange={v=>set("render",{scale:v})}/>
      <div className="flex items-end gap-2 pb-2"><Switch checked={value.render.castShadow} onCheckedChange={v=>set("render",{castShadow:v})}/><Label>Cast shadow</Label></div>
    </CardContent></Card>
  </div>;
}
