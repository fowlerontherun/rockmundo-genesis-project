import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Type, Image as ImageIcon, Trash2, Copy, ArrowUp, ArrowDown, Upload, Undo2, Redo2, Loader2, RotateCw, ClipboardPaste, Maximize2 } from "lucide-react";
import { garmentTemplate, inferGarmentTemplateKey } from "@/features/clothing-preview/garmentTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  fontStyle?: "block" | "punk" | "script" | "metal" | "varsity" | "clean";
  outlineColor?: string;
  letterSpacing?: number;
}

interface Props {
  category?: string;
  templateKey?: string;
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
const MOTIFS = ["rockmundo-mark", "star", "lightning", "vinyl-record", "stripe"];
const TEXT_STYLES = ["block", "punk", "script", "metal", "varsity", "clean"] as const;

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

export function GarmentSurfaceEditor({ category, templateKey, layers, onChange }: Props) {
  const template = garmentTemplate(templateKey || inferGarmentTemplateKey(category));
  const availableSurfaces = SURFACES.filter(entry => template?.surfaces.includes(entry.key) ?? true);
  const [surface, setSurface] = useState<GarmentSurface>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [past, setPast] = useState<GarmentSurfaceLayer[][]>([]);
  const [future, setFuture] = useState<GarmentSurfaceLayer[][]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [constrainToSafeArea, setConstrainToSafeArea] = useState(true);
  const [copiedLayer, setCopiedLayer] = useState<GarmentSurfaceLayer | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<{
    mode: "resize" | "rotate";
    id: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    centerX: number;
    centerY: number;
    startRotation: number;
    startAngle: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleLayers = useMemo(
    () => layers.filter(layer => (layer.surface || "front") === surface),
    [layers, surface],
  );
  const selected = layers.find(layer => layer.id === selectedId) || null;

  const remember = () => {
    setPast(history => [...history.slice(-29), layers]);
    setFuture([]);
  };

  const commit = (next: GarmentSurfaceLayer[]) => {
    remember();
    onChange(next);
  };

  const updateLayer = (id: string, patch: Partial<GarmentSurfaceLayer>, record = true) => {
    const next = layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer);
    if (record) commit(next);
    else onChange(next);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(history => history.slice(0, -1));
    setFuture(history => [layers, ...history].slice(0, 30));
    onChange(previous);
    setSelectedId(null);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(history => history.slice(1));
    setPast(history => [...history.slice(-29), layers]);
    onChange(next);
    setSelectedId(null);
  };

  const addLayer = (type: "text" | "graphic", asset?: string) => {
    const layer: GarmentSurfaceLayer = {
      id: crypto.randomUUID(),
      type,
      name: type === "text" ? "New text" : "New graphic",
      zone: "main",
      color: "#ffffff",
      secondaryColor: "#000000",
      text: type === "text" ? "ROCKMUNDO" : undefined,
      asset: type === "graphic" ? (asset || "rockmundo-mark") : undefined,
      scale: 100,
      rotation: 0,
      opacity: 100,
      offsetX: 0,
      offsetY: 0,
      surface,
      widthScale: 100,
      heightScale: 100,
      fontStyle: type === "text" ? "block" : undefined,
      outlineColor: type === "text" ? "#000000" : undefined,
      letterSpacing: type === "text" ? 0 : undefined,
    };
    commit([...layers, layer]);
    setSelectedId(layer.id);
  };

  const moveFromPointer = (event: React.PointerEvent, id: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 200 - 100;
    const y = 100 - ((event.clientY - rect.top) / rect.height) * 200;
    const snap = (value: number) => snapToGrid ? Math.round(value / 10) * 10 : Math.round(value);
    const xLimit = constrainToSafeArea ? (surface.includes("sleeve") ? 48 : 58) : 90;
    const yLimit = constrainToSafeArea ? 62 : 90;
    updateLayer(id, {
      offsetX: clamp(snap(x), -xLimit, xLimit),
      offsetY: clamp(snap(y), -yLimit, yLimit),
    }, false);
  };

  const onPointerDown = (event: React.PointerEvent, id: string) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    remember();
    setSelectedId(id);
    moveFromPointer(event, id);
  };

  const startResize = (event: React.PointerEvent, layer: GarmentSurfaceLayer) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    remember();
    transformRef.current = {
      mode: "resize",
      id: layer.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: Number(layer.widthScale || 100),
      startHeight: Number(layer.heightScale || 100),
      centerX: rect.left + rect.width * (0.5 + clamp(Number(layer.offsetX || 0), -90, 90) / 200),
      centerY: rect.top + rect.height * (0.5 - clamp(Number(layer.offsetY || 0), -90, 90) / 200),
      startRotation: Number(layer.rotation || 0),
      startAngle: 0,
    };
  };

  const startRotate = (event: React.PointerEvent, layer: GarmentSurfaceLayer) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    remember();
    const centerX = rect.left + rect.width * (0.5 + clamp(Number(layer.offsetX || 0), -90, 90) / 200);
    const centerY = rect.top + rect.height * (0.5 - clamp(Number(layer.offsetY || 0), -90, 90) / 200);
    transformRef.current = {
      mode: "rotate",
      id: layer.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: Number(layer.widthScale || 100),
      startHeight: Number(layer.heightScale || 100),
      centerX,
      centerY,
      startRotation: Number(layer.rotation || 0),
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
  };

  const continueTransform = (event: React.PointerEvent) => {
    const active = transformRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!active || !rect) return false;
    if (active.mode === "resize") {
      const dx = ((event.clientX - active.startX) / rect.width) * 220;
      const dy = ((event.clientY - active.startY) / rect.height) * 220;
      updateLayer(active.id, {
        widthScale: clamp(Math.round(active.startWidth + dx), 20, 250),
        heightScale: clamp(Math.round(active.startHeight + dy), 20, 250),
      }, false);
    } else {
      const angle = Math.atan2(event.clientY - active.centerY, event.clientX - active.centerX);
      const delta = (angle - active.startAngle) * 180 / Math.PI;
      const rotation = snapToGrid ? Math.round((active.startRotation + delta) / 5) * 5 : Math.round(active.startRotation + delta);
      updateLayer(active.id, { rotation: clamp(rotation, -180, 180) }, false);
    }
    return true;
  };

  const finishTransform = () => {
    transformRef.current = null;
  };

  const pasteCopiedLayer = () => {
    if (!copiedLayer) return;
    const copy: GarmentSurfaceLayer = {
      ...copiedLayer,
      id: crypto.randomUUID(),
      name: `${copiedLayer.name} copy`,
      surface,
      offsetX: clamp(Number(copiedLayer.offsetX || 0) + 10, -90, 90),
      offsetY: clamp(Number(copiedLayer.offsetY || 0) - 10, -90, 90),
    };
    commit([...layers, copy]);
    setSelectedId(copy.id);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "c" && selected) {
        event.preventDefault();
        setCopiedLayer({ ...selected });
        return;
      }
      if (modifier && event.key.toLowerCase() === "v" && copiedLayer) {
        event.preventDefault();
        pasteCopiedLayer();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        commit(layers.filter(layer => layer.id !== selected.id));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copiedLayer, future, layers, past, selected, surface]);

  const uploadArtwork = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) throw new Error("Use PNG, JPG, WEBP or SVG artwork.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Artwork must be 10 MB or smaller.");
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) throw new Error("You need to be signed in to upload artwork.");
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const uploadPath = `${data.user.id}/clothing-skins/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("merch-artwork").upload(uploadPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    return supabase.storage.from("merch-artwork").getPublicUrl(uploadPath).data.publicUrl;
  };

  const handleArtworkFile = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const asset = await uploadArtwork(file);
      addLayer("graphic", asset);
      toast.success("Artwork added to garment");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Artwork upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {availableSurfaces.map(entry => (
          <Button key={entry.key} type="button" size="sm" variant={surface === entry.key ? "default" : "outline"} onClick={() => { setSurface(entry.key); setSelectedId(null); }}>
            {entry.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!past.length} onClick={undo} title="Undo"><Undo2 className="h-4 w-4"/></Button>
        <Button type="button" size="sm" variant="outline" disabled={!future.length} onClick={redo} title="Redo"><Redo2 className="h-4 w-4"/></Button>
        <Button type="button" size="sm" variant={snapToGrid ? "default" : "outline"} onClick={() => setSnapToGrid(value => !value)}>Snap 10</Button>
        <Button type="button" size="sm" variant={showSafeArea ? "default" : "outline"} onClick={() => setShowSafeArea(value => !value)}>Safe area</Button>
        <Button type="button" size="sm" variant={constrainToSafeArea ? "default" : "outline"} onClick={() => setConstrainToSafeArea(value => !value)}>Keep inside</Button>
        <Button type="button" size="sm" variant="outline" disabled={!copiedLayer} onClick={pasteCopiedLayer}><ClipboardPaste className="h-4 w-4 mr-1"/>Paste</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => addLayer("text")}><Type className="h-4 w-4 mr-1"/>Text</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => addLayer("graphic")}><ImageIcon className="h-4 w-4 mr-1"/>Graphic</Button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={event => void handleArtworkFile(event.target.files?.[0])}/>
        <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : <Upload className="h-4 w-4 mr-1"/>}Upload artwork
        </Button>
        {MOTIFS.map(motif => <Button key={motif} type="button" size="sm" variant="ghost" onClick={() => addLayer("graphic", motif)} className="text-xs capitalize">{motif.replaceAll("-", " ")}</Button>)}
      </div>
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
      <div
        ref={canvasRef}
        className="relative min-h-[520px] overflow-hidden rounded-xl border bg-[#0f1720] select-none touch-none"
        onPointerMove={event => {
          if (continueTransform(event)) return;
          if (!selectedId || event.buttons !== 1) return;
          moveFromPointer(event, selectedId);
        }}
        onPointerUp={finishTransform}
        onPointerCancel={finishTransform}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-12" preserveAspectRatio="xMidYMid meet">
          <path d={garmentOutline(category, surface)} fill="#242f3d" stroke="#718096" strokeWidth="1.2" />
          <path d={garmentOutline(category, surface)} fill="none" stroke="#94a3b8" strokeDasharray="2 2" strokeWidth=".45" opacity=".6" />
          {showSafeArea && <rect x="24" y="22" width="52" height="60" rx="2" fill="none" stroke="#22c55e" strokeWidth=".55" strokeDasharray="2 1.5" opacity=".75"/>}
        </svg>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">{surface.replace("-", " ")}</Badge>
          <span className="text-[11px] text-slate-400">Drag items directly on the garment · handles resize/rotate · Ctrl/Cmd C/V/Z</span>
        </div>

        {visibleLayers.map(layer => {
          const x = 50 + clamp(Number(layer.offsetX || 0), -90, 90) / 2;
          const y = 50 - clamp(Number(layer.offsetY || 0), -90, 90) / 2;
          const width = 90 * clamp(Number(layer.scale || 100) / 100, .15, 3) * clamp(Number(layer.widthScale || 100) / 100, .2, 2.5);
          const height = 52 * clamp(Number(layer.scale || 100) / 100, .15, 3) * clamp(Number(layer.heightScale || 100) / 100, .2, 2.5);
          const isSelected = selectedId === layer.id;
          return <div
            key={layer.id}
            role="button"
            tabIndex={0}
            className={`absolute flex items-center justify-center border-2 text-xs font-bold shadow-sm cursor-move ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-white/30"}`}
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
            <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none">
              {layer.type === "text" ? (layer.text || "Text") : /^https?:\/\//.test(String(layer.asset || "")) ? <img src={layer.asset} alt={layer.name || "Uploaded artwork"} className="h-full w-full object-contain pointer-events-none" draggable={false}/> : (layer.asset || layer.name || "Graphic")}
            </div>
            {isSelected && <>
              <span className="absolute -right-2 -bottom-2 h-4 w-4 rounded-sm border-2 border-background bg-primary shadow cursor-nwse-resize" title="Resize" onPointerDown={event => startResize(event, layer)}><Maximize2 className="h-3 w-3 text-primary-foreground"/></span>
              <span className="absolute left-1/2 -top-7 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-background bg-primary shadow cursor-grab flex items-center justify-center" title="Rotate" onPointerDown={event => startRotate(event, layer)}><RotateCw className="h-3 w-3 text-primary-foreground"/></span>
            </>}
          </div>;
        })}
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between"><div className="font-medium text-sm">Selected layer</div><Badge variant="outline">{visibleLayers.length} on surface</Badge></div>
        {!selected ? <p className="text-xs text-muted-foreground">Select an item on the garment, or add text/graphics above.</p> : <>
          <div className="space-y-2"><Label>Name</Label><Input value={selected.name} onChange={event => updateLayer(selected.id, { name: event.target.value })}/></div>
          {selected.type === "text" && <>
            <div className="space-y-2"><Label>Text</Label><Input value={selected.text || ""} onChange={event => updateLayer(selected.id, { text: event.target.value })}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Text style</Label><Select value={selected.fontStyle || "block"} onValueChange={value => updateLayer(selected.id, { fontStyle: value as GarmentSurfaceLayer["fontStyle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEXT_STYLES.map(style => <SelectItem key={style} value={style} className="capitalize">{style}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Outline</Label><Input type="color" value={selected.outlineColor || "#000000"} onChange={event => updateLayer(selected.id, { outlineColor: event.target.value })}/></div>
            </div>
          </>}
          {selected.type !== "text" && <div className="space-y-2"><Label>Asset / motif</Label><Input value={selected.asset || ""} onChange={event => updateLayer(selected.id, { asset: event.target.value })}/></div>}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">X</Label><Input type="number" min={-90} max={90} value={selected.offsetX || 0} onChange={event => updateLayer(selected.id, { offsetX: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Y</Label><Input type="number" min={-90} max={90} value={selected.offsetY || 0} onChange={event => updateLayer(selected.id, { offsetY: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Width %</Label><Input type="number" min={20} max={250} value={selected.widthScale || 100} onChange={event => updateLayer(selected.id, { widthScale: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Height %</Label><Input type="number" min={20} max={250} value={selected.heightScale || 100} onChange={event => updateLayer(selected.id, { heightScale: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Rotation</Label><Input type="number" min={-180} max={180} value={selected.rotation || 0} onChange={event => updateLayer(selected.id, { rotation: Number(event.target.value) })}/></div>
            <div className="space-y-1"><Label className="text-xs">Opacity</Label><Input type="number" min={5} max={100} value={selected.opacity ?? 100} onChange={event => updateLayer(selected.id, { opacity: Number(event.target.value) })}/></div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => updateLayer(selected.id, { offsetX: 0 })}>Centre X</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => updateLayer(selected.id, { offsetY: 0 })}>Centre Y</Button>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" disabled={layers.indexOf(selected) === layers.length - 1} onClick={() => {
              const index = layers.indexOf(selected);
              if (index < 0 || index === layers.length - 1) return;
              const next = [...layers];
              [next[index], next[index + 1]] = [next[index + 1], next[index]];
              commit(next);
            }} title="Bring forward"><ArrowUp className="h-4 w-4"/></Button>
            <Button type="button" size="sm" variant="outline" disabled={layers.indexOf(selected) <= 0} onClick={() => {
              const index = layers.indexOf(selected);
              if (index <= 0) return;
              const next = [...layers];
              [next[index], next[index - 1]] = [next[index - 1], next[index]];
              commit(next);
            }} title="Send backward"><ArrowDown className="h-4 w-4"/></Button>
            <Button type="button" size="sm" variant="outline" onClick={() => {
              setCopiedLayer({ ...selected });
              toast.success("Layer copied");
            }} title="Copy"><Copy className="h-4 w-4"/></Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => { commit(layers.filter(layer => layer.id !== selected.id)); setSelectedId(null); }}><Trash2 className="h-4 w-4"/></Button>
          </div>
        </>}
      </div>
    </div>
  </div>;
}
