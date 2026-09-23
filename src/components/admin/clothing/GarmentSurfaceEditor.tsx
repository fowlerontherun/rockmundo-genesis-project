import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Type, Image as ImageIcon, Trash2, Copy } from "lucide-react";

export type GarmentSurface = "front" | "back" | "left-sleeve" | "right-sleeve";

export interface GarmentSurfaceLayer {
  id: string;
  type: string;
  name: string;
  zone: string;
  color: string;
  secondaryColor?: string;
  text?: string;
  asset?: string;
  scale?: number;
  rotation?: number;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  surface?: GarmentSurface;
  widthScale?: number;
  heightScale?: number;
}

interface Props {
  category?: string;
  layers: GarmentSurfaceLayer[];
  onChange: (layers: GarmentSurfaceLayer[]) => void;
}

const SURFACES: Array<{ key: GarmentSurface; label: string }> = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left-sleeve", label: "Left sleeve" },
  { key: "right-sleeve", label: "Right sleeve" },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function garmentOutline(category: string | undefined, surface: GarmentSurface) {
  const cat = String(category || "t-shirt").toLowerCase();
  if (surface.includes("sleeve")) {
    return "M32 12 C25 28 20 54 18 92 L82 92 C80 54 75 28 68 12 Z";
  }
  if (/skirt|dress/.test(cat)) return "M30 10 L70 10 L88 92 L12 92 Z";
  if (/pants|jeans|shorts/.test(cat)) return "M28 10 L72 10 L68 92 L52 92 L50 48 L48 92 L32 92 Z";
  if (/hoodie|jacket|coat/.test(cat)) return "M28 12 L39 5 L61 5 L72 12 L90 30 L75 39 L70 92 L30 92 L25 39 L10 30 Z";
  return "M30 12 L40 5 L60 5 L70 12 L90 31 L76 40 L69 92 L31 92 L24 40 L10 31 Z";
}

export function GarmentSurfaceEditor({ category, layers, onChange }: Props) {
  const [surface, setSurface] = useState<GarmentSurface>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const visibleLayers = useMemo(
    () => layers.filter(layer => (layer.surface || "front") === surface),
    [layers, surface],
  );
  const selected = layers.find(layer => layer.id === selectedId) || null;

  const updateLayer = (id: string, patch: Partial<GarmentSurfaceLayer>) =>
    onChange(layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer));

  const addLayer = (type: "text" | "graphic") => {
    const layer: GarmentSurfaceLayer = {
      id: crypto.randomUUID(),
      type,
      name: type === "text" ? "New text" : "New graphic",
      zone: "main",
      color: "#ffffff",
      secondaryColor: "#000000",
      text: type === "text" ? "ROCKMUNDO" : undefined,
      asset: type === "graphic" ? "rockmundo-mark" : undefined,
      scale: 100,
      rotation: 0,
      opacity: 100,
      offsetX: 0,
      offsetY: 0,
      surface,
      widthScale: 100,
      heightScale: 100,
    };
    onChange([...layers, layer]);
    setSelectedId(layer.id);
  };

  const moveFromPointer = (event: React.PointerEvent, id: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 200 - 100;
    const y = 100 - ((event.clientY - rect.top) / rect.height) * 200;
    updateLayer(id, {
      offsetX: Math.round(clamp(x, -90, 90)),
      offsetY: Math.round(clamp(y, -90, 90)),
    });
  };

  const onPointerDown = (event: React.PointerEvent, id: string) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(id);
    moveFromPointer(event, id);
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {SURFACES.map(entry => (
          <Button key={entry.key} type="button" size="sm" variant={surface === entry.key ? "default" : "outline"} onClick={() => { setSurface(entry.key); setSelectedId(null); }}>
            {entry.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => addLayer("text")}><Type className="h-4 w-4 mr-1"/>Text</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => addLayer("graphic")}><ImageIcon className="h-4 w-4 mr-1"/>Graphic</Button>
      </div>
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
      <div
        ref={canvasRef}
        className="relative min-h-[520px] overflow-hidden rounded-xl border bg-[#0f1720] select-none touch-none"
        onPointerMove={event => {
          if (!selectedId || event.buttons !== 1) return;
          moveFromPointer(event, selectedId);
        }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-12" preserveAspectRatio="xMidYMid meet">
          <path d={garmentOutline(category, surface)} fill="#242f3d" stroke="#718096" strokeWidth="1.2" />
          <path d={garmentOutline(category, surface)} fill="none" stroke="#94a3b8" strokeDasharray="2 2" strokeWidth=".45" opacity=".6" />
        </svg>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">{surface.replace("-", " ")}</Badge>
          <span className="text-[11px] text-slate-400">Drag items directly on the garment</span>
        </div>

        {visibleLayers.map(layer => {
          const x = 50 + clamp(Number(layer.offsetX || 0), -90, 90) / 2;
          const y = 50 - clamp(Number(layer.offsetY || 0), -90, 90) / 2;
          const width = 90 * clamp(Number(layer.scale || 100) / 100, .15, 3) * clamp(Number(layer.widthScale || 100) / 100, .2, 2.5);
          const height = 52 * clamp(Number(layer.scale || 100) / 100, .15, 3) * clamp(Number(layer.heightScale || 100) / 100, .2, 2.5);
          const isSelected = selectedId === layer.id;
          return <button
            key={layer.id}
            type="button"
            className={`absolute flex items-center justify-center border-2 text-xs font-bold shadow-sm cursor-move overflow-hidden ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-white/30"}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width,
              height,
              transform: `translate(-50%, -50%) rotate(${Number(layer.rotation || 0)}deg)`,
              color: layer.color,
              opacity: clamp(Number(layer.opacity ?? 100) / 100, .05, 1),
              background: layer.type === "text" ? "transparent" : "rgba(255,255,255,.08)",
            }}
            onPointerDown={event => onPointerDown(event, layer.id)}
          >
            {layer.type === "text" ? (layer.text || "Text") : (layer.asset || layer.name || "Graphic")}
          </button>;
        })}
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between"><div className="font-medium text-sm">Selected layer</div><Badge variant="outline">{visibleLayers.length} on surface</Badge></div>
        {!selected ? <p className="text-xs text-muted-foreground">Select an item on the garment, or add text/graphics above.</p> : <>
          <div className="space-y-2"><Label>Name</Label><Input value={selected.name} onChange={event => updateLayer(selected.id, { name: event.target.value })}/></div>
          {selected.type === "text" && <div className="space-y-2"><Label>Text</Label><Input value={selected.text || ""} onChange={event => updateLayer(selected.id, { text: event.target.value })}/></div>}
          {selected.type !== "text" && <div className="space-y-2"><Label>Asset / motif</Label><Input value={selected.asset || ""} onChange={event => updateLayer(selected.id, { asset: event.target.value })}/></div>}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">X</Label><Input type="number" min={-90} max={90} value={selected.offsetX || 0} onChange={event => updateLayer(selected.id, { offsetX: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Y</Label><Input type="number" min={-90} max={90} value={selected.offsetY || 0} onChange={event => updateLayer(selected.id, { offsetY: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Width %</Label><Input type="number" min={20} max={250} value={selected.widthScale || 100} onChange={event => updateLayer(selected.id, { widthScale: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Height %</Label><Input type="number" min={20} max={250} value={selected.heightScale || 100} onChange={event => updateLayer(selected.id, { heightScale: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Rotation</Label><Input type="number" min={-180} max={180} value={selected.rotation || 0} onChange={event => updateLayer(selected.id, { rotation: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Opacity</Label><Input type="number" min={5} max={100} value={selected.opacity ?? 100} onChange={event => updateLayer(selected.id, { opacity: Number(event.target.value) })}/></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => {
              const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} copy`, offsetX: clamp(Number(selected.offsetX || 0) + 8, -90, 90), offsetY: clamp(Number(selected.offsetY || 0) - 8, -90, 90) };
              onChange([...layers, copy]);
              setSelectedId(copy.id);
            }}><Copy className="h-4 w-4 mr-1"/>Duplicate</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => { onChange(layers.filter(layer => layer.id !== selected.id)); setSelectedId(null); }}><Trash2 className="h-4 w-4"/></Button>
          </div>
        </>}
      </div>
    </div>
  </div>;
}
