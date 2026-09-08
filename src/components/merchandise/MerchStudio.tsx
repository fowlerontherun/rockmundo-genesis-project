import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMerchRequirements } from "@/hooks/useMerchRequirements";
import { supabase } from "@/integrations/supabase/client";
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Copy,
  ImagePlus,
  Layers3,
  Loader2,
  Move,
  RotateCcw,
  Save,
  Trash2,
  Type,
  Upload,
} from "lucide-react";

type ViewSide = "front" | "back";
type DesignElement = {
  id: string;
  type: "image" | "text";
  src?: string;
  text?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color?: string;
  fontSize?: number;
};

type DesignData = {
  version?: number;
  productType?: string;
  garmentColor?: string;
  frontElements?: DesignElement[];
  backElements?: DesignElement[];
};

type ArtworkAsset = { id: string; name: string; url: string };

interface MerchStudioProps {
  bandId: string;
  existingDesignId?: string | null;
  onSave?: (designId: string) => void;
  onClearEditing?: () => void;
}

const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");

const shapeForProduct = (itemType: string) => {
  const name = itemType.toLowerCase();
  if (name.includes("poster") || name.includes("print") || name.includes("setlist") || name.includes("programme")) return "poster";
  if (name.includes("tote")) return "tote";
  if (name.includes("mug") || name.includes("glass") || name.includes("bottle")) return "mug";
  if (name.includes("hoodie")) return "hoodie";
  if (name.includes("crewneck") || name.includes("sweatshirt")) return "crewneck";
  if (name.includes("long sleeve")) return "long";
  if (name.includes("cap") || name.includes("beanie")) return "cap";
  return "tee";
};

const safeZoneForShape = (shape: string) => {
  if (shape === "poster") return { left: 22, top: 14, width: 56, height: 72 };
  if (shape === "mug") return { left: 28, top: 34, width: 42, height: 32 };
  if (shape === "cap") return { left: 30, top: 38, width: 40, height: 24 };
  if (shape === "tote") return { left: 27, top: 32, width: 46, height: 45 };
  return { left: 34, top: 28, width: 32, height: 46 };
};

function ProductSilhouette({ shape, color }: { shape: string; color: string }) {
  if (shape === "poster") return <div className="absolute inset-[8%_18%] rounded-sm border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }} />;
  if (shape === "tote") return <div className="absolute left-[20%] right-[20%] top-[24%] bottom-[13%] rounded-b-xl border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }}><div className="absolute left-[24%] right-[24%] -top-[24%] h-[28%] rounded-t-[999px] border-[10px] border-b-0 border-black/20" /></div>;
  if (shape === "mug") return <div className="absolute left-[20%] right-[25%] top-[27%] bottom-[24%] rounded-b-3xl rounded-t-lg border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }}><div className="absolute -right-[30%] top-[18%] h-[55%] w-[34%] rounded-r-full border-8 border-l-0 border-black/20" /></div>;
  if (shape === "cap") return <div className="absolute left-[20%] right-[20%] top-[33%] h-[28%] rounded-t-full rounded-b-xl border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }}><div className="absolute left-[55%] top-[55%] h-[20%] w-[45%] rounded-r-full border-4 border-black/20" style={{ backgroundColor: color }} /></div>;
  const longSleeve = shape === "long" || shape === "hoodie" || shape === "crewneck";
  return <div className="absolute inset-0"><div className="absolute left-[27%] right-[27%] top-[18%] bottom-[10%] rounded-b-3xl border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }} /><div className={`absolute top-[20%] h-[25%] ${longSleeve ? "left-[8%] w-[23%] rotate-[16deg]" : "left-[14%] w-[20%] rotate-[25deg]"} rounded-xl border-4 border-black/20`} style={{ backgroundColor: color }} /><div className={`absolute top-[20%] h-[25%] ${longSleeve ? "right-[8%] w-[23%] -rotate-[16deg]" : "right-[14%] w-[20%] -rotate-[25deg]"} rounded-xl border-4 border-black/20`} style={{ backgroundColor: color }} />{shape === "hoodie" ? <div className="absolute left-[37%] right-[37%] top-[10%] h-[18%] rounded-t-full border-4 border-black/20" style={{ backgroundColor: color }} /> : null}</div>;
}

function DesignLayer({ element, selected, onSelect, onMove }: { element: DesignElement; selected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void }) {
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  return <div className={`absolute cursor-move select-none rounded ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""}`} style={{ left: `${element.x}%`, top: `${element.y}%`, transform: `translate(-50%, -50%) scale(${element.scale}) rotate(${element.rotation}deg)`, transformOrigin: "center" }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(); dragRef.current = { startX: event.clientX, startY: event.clientY, x: element.x, y: element.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!dragRef.current) return; const parent = event.currentTarget.parentElement?.getBoundingClientRect(); if (!parent) return; const dx = ((event.clientX - dragRef.current.startX) / parent.width) * 100; const dy = ((event.clientY - dragRef.current.startY) / parent.height) * 100; onMove(Math.min(86, Math.max(14, dragRef.current.x + dx)), Math.min(82, Math.max(18, dragRef.current.y + dy))); }} onPointerUp={() => { dragRef.current = null; }}>
    {element.type === "image" && element.src ? <img src={element.src} alt="Uploaded artwork" className="pointer-events-none max-h-40 max-w-40 object-contain drop-shadow-md" draggable={false} /> : <div className="pointer-events-none whitespace-nowrap px-2 py-1 text-center font-black uppercase tracking-wide drop-shadow" style={{ color: element.color ?? "#fff", fontSize: element.fontSize ?? 24 }}>{element.text}</div>}
  </div>;
}

const loadPreviewImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Unable to load artwork for preview"));
  image.src = src;
});

export const MerchStudio = ({ bandId, existingDesignId, onSave, onClearEditing }: MerchStudioProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: requirements = [], isLoading: loadingCatalogue } = useMerchRequirements();
  const personalisable = useMemo(() => requirements.filter((item) => item.is_personalisable && (item.product_kind ?? "physical") === "physical"), [requirements]);
  const [productType, setProductType] = useState("");
  const [designName, setDesignName] = useState("");
  const [baseColor, setBaseColor] = useState("#171717");
  const [activeView, setActiveView] = useState<ViewSide>("front");
  const [frontElements, setFrontElements] = useState<DesignElement[]>([]);
  const [backElements, setBackElements] = useState<DesignElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);

  useEffect(() => { if (!productType && personalisable[0]) setProductType(personalisable[0].item_type); }, [personalisable, productType]);

  const { data: existingDesign, isFetching: loadingExisting } = useQuery({
    queryKey: ["tshirt-design", existingDesignId],
    queryFn: async () => {
      if (!existingDesignId) return null;
      const { data, error } = await (supabase as any).from("tshirt_designs").select("*").eq("id", existingDesignId).eq("band_id", bandId).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(existingDesignId && bandId),
  });

  const { data: artworkLibrary = [] } = useQuery({
    queryKey: ["merch-artwork-library", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("tshirt_designs").select("id, design_name, artwork_url").eq("band_id", bandId).not("artwork_url", "is", null).order("updated_at", { ascending: false }).limit(24);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).reduce((assets: ArtworkAsset[], row: any) => {
        if (!row.artwork_url || seen.has(row.artwork_url)) return assets;
        seen.add(row.artwork_url);
        assets.push({ id: row.id, name: row.design_name ?? "Saved artwork", url: row.artwork_url });
        return assets;
      }, []);
    },
    enabled: Boolean(bandId),
  });

  useEffect(() => {
    if (!existingDesign) return;
    const data = (existingDesign.design_data ?? {}) as DesignData;
    setDesignName(existingDesign.design_name ?? "");
    setProductType(data.productType ?? existingDesign.product_type ?? personalisable[0]?.item_type ?? "");
    setBaseColor(data.garmentColor ?? existingDesign.background_color ?? "#171717");
    setFrontElements(Array.isArray(data.frontElements) ? data.frontElements : []);
    setBackElements(Array.isArray(data.backElements) ? data.backElements : []);
    setActiveView("front");
    setSelectedId(null);
  }, [existingDesign, personalisable]);

  const product = personalisable.find((item) => item.item_type === productType) ?? personalisable[0];
  const shape = shapeForProduct(productType);
  const safeZone = safeZoneForShape(shape);
  const colors = product?.colour_options?.length ? product.colour_options : ["#171717", "#f8fafc", "#404040", "#172554", "#991b1b", "#14532d"];
  const currentElements = activeView === "front" ? frontElements : backElements;
  const setCurrentElements = activeView === "front" ? setFrontElements : setBackElements;
  const selectedIndex = currentElements.findIndex((element) => element.id === selectedId);
  const selected = selectedIndex >= 0 ? currentElements[selectedIndex] : null;
  const printableSides = new Set((product?.print_areas ?? ["front", "back"]).map((v) => v.toLowerCase()));
  const recommended = Number(product?.recommended_retail_price ?? 0);
  const minimumRetail = Number(product?.minimum_retail_price ?? 0);

  useEffect(() => { if (activeView === "back" && !printableSides.has("back")) setActiveView("front"); }, [activeView, printableSides]);

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    setCurrentElements((elements) => elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element));
  };

  const addText = () => {
    const element: DesignElement = { id: makeId(), type: "text", text: "YOUR BAND", x: 50, y: 48, scale: 1, rotation: 0, color: baseColor === "#f8fafc" ? "#111827" : "#ffffff", fontSize: 24 };
    setCurrentElements((elements) => [...elements, element]);
    setSelectedId(element.id);
  };

  const addArtwork = (src: string) => {
    const element: DesignElement = { id: makeId(), type: "image", src, x: 50, y: 48, scale: 1, rotation: 0 };
    setCurrentElements((elements) => [...elements, element]);
    setSelectedId(element.id);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = { ...selected, id: makeId(), x: Math.min(82, selected.x + 4), y: Math.min(78, selected.y + 4) };
    setCurrentElements((elements) => [...elements, duplicate]);
    setSelectedId(duplicate.id);
  };

  const reorderSelected = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const target = Math.max(0, Math.min(currentElements.length - 1, selectedIndex + direction));
    if (target === selectedIndex) return;
    const next = [...currentElements];
    const [item] = next.splice(selectedIndex, 1);
    next.splice(target, 0, item);
    setCurrentElements(next);
  };

  const copySide = () => {
    const cloned = currentElements.map((element) => ({ ...element, id: makeId() }));
    if (activeView === "front") setBackElements(cloned); else setFrontElements(cloned);
    toast({ title: "Design copied", description: `Copied ${activeView} layout to the ${activeView === "front" ? "back" : "front"}.` });
  };

  const uploadArtwork = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) throw new Error("Use PNG, JPG, WEBP or SVG artwork.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Artwork must be 10 MB or smaller.");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("You need to be signed in to upload artwork.");
    const path = `${authData.user.id}/${bandId}/${makeId()}-${slugify(file.name)}`;
    const { error } = await supabase.storage.from("merch-artwork").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("merch-artwork").getPublicUrl(path).data.publicUrl;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 8 - currentElements.filter((element) => element.type === "image").length);
    if (!remaining) return toast({ title: "Artwork limit reached", description: "You can place up to eight image layers on each side.", variant: "destructive" });
    setIsUploading(true);
    try {
      for (const file of Array.from(files).slice(0, remaining)) addArtwork(await uploadArtwork(file));
      toast({ title: "Artwork uploaded", description: "Artwork is now available in this design and reusable from saved designs." });
    } catch (error) { toast({ title: "Artwork upload failed", description: error instanceof Error ? error.message : "Upload failed", variant: "destructive" }); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      const step = event.shiftKey ? 5 : 1;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") updateSelected({ x: Math.max(14, selected.x - step) });
      if (event.key === "ArrowRight") updateSelected({ x: Math.min(86, selected.x + step) });
      if (event.key === "ArrowUp") updateSelected({ y: Math.max(18, selected.y - step) });
      if (event.key === "ArrowDown") updateSelected({ y: Math.min(82, selected.y + step) });
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      if (event.key === "Delete" || event.key === "Backspace") {
        setCurrentElements((elements) => elements.filter((item) => item.id !== selected.id));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectedId, currentElements]);

  const buildPreview = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Preview rendering is unavailable");
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, 0, 600, 600);
    const previewSide = frontElements.length ? "front" : "back";
    const elements = previewSide === "front" ? frontElements : backElements;
    ctx.fillStyle = baseColor;
    if (shape === "poster") ctx.fillRect(110, 55, 380, 490);
    else if (shape === "mug") { ctx.beginPath(); ctx.roundRect(120, 170, 330, 270, 28); ctx.fill(); }
    else if (shape === "cap") { ctx.beginPath(); ctx.ellipse(300, 285, 175, 105, 0, Math.PI, 0); ctx.lineTo(475, 335); ctx.lineTo(125, 335); ctx.closePath(); ctx.fill(); }
    else if (shape === "tote") { ctx.beginPath(); ctx.roundRect(120, 145, 360, 370, 20); ctx.fill(); }
    else { ctx.beginPath(); ctx.roundRect(190, 120, 220, 390, 26); ctx.fill(); }
    for (const element of elements) {
      ctx.save();
      ctx.translate((element.x / 100) * 600, (element.y / 100) * 600);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.scale(element.scale, element.scale);
      if (element.type === "image" && element.src) {
        try {
          const image = await loadPreviewImage(element.src);
          const max = 150; const ratio = Math.min(max / image.width, max / image.height, 1);
          const w = image.width * ratio; const h = image.height * ratio;
          ctx.drawImage(image, -w / 2, -h / 2, w, h);
        } catch { /* keep save resilient */ }
      } else {
        ctx.fillStyle = element.color ?? "#fff";
        ctx.font = `800 ${element.fontSize ?? 24}px Arial, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(element.text ?? "", 0, 0);
      }
      ctx.restore();
    }
    ctx.fillStyle = "#374151"; ctx.font = "600 20px Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${productType} · ${previewSide}`, 300, 575);
    return canvas.toDataURL("image/png", 0.9);
  };

  const saveDesign = async () => {
    if (!designName.trim()) return toast({ title: "Name your design", description: "Add a name before saving.", variant: "destructive" });
    if (!frontElements.length && !backElements.length) return toast({ title: "Add a design", description: "Upload artwork or add text before saving.", variant: "destructive" });
    setIsSaving(true);
    try {
      const firstArtwork = [...frontElements, ...backElements].find((element) => element.type === "image")?.src ?? null;
      const preview = await buildPreview();
      const payload = { band_id: bandId, design_name: designName.trim(), background_color: baseColor, product_type: productType, artwork_url: firstArtwork, preview_image_url: preview, preview_data_url: preview, design_data: { version: 5, productType, garmentColor: baseColor, frontElements, backElements } };
      const query = (supabase as any).from("tshirt_designs");
      const { data, error } = existingDesignId ? await query.update(payload).eq("id", existingDesignId).eq("band_id", bandId).select("id").single() : await query.insert(payload).select("id").single();
      if (error) throw error;
      toast({ title: existingDesignId ? "Design updated" : "Merch design saved", description: `${designName.trim()} is ready to reuse for future drops.` });
      onSave?.(data.id);
    } catch (error) { toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unable to save design", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  if (loadingCatalogue || loadingExisting) return <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  if (!personalisable.length) return <Card><CardHeader><CardTitle>Merch Studio</CardTitle><CardDescription>No personalisable physical products are configured in the catalogue.</CardDescription></CardHeader></Card>;

  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Merch Studio</CardTitle><CardDescription>Build reusable merch artwork with product-aware print zones, layers and saved assets.</CardDescription></div><div className="flex gap-2"><Badge variant="secondary">{personalisable.length} products</Badge>{existingDesignId ? <Button size="sm" variant="outline" onClick={onClearEditing}>New design</Button> : null}</div></div></CardHeader>
    <CardContent className="grid gap-6 xl:grid-cols-[310px_1fr_320px]">
      <div className="space-y-4">
        <div className="space-y-2"><Label>Product</Label><Select value={productType} onValueChange={(value) => { setProductType(value); setSelectedId(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{personalisable.map((item) => <SelectItem key={item.id} value={item.item_type}>{item.item_type}</SelectItem>)}</SelectContent></Select></div>
        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1"><p><span className="text-muted-foreground">Material:</span> {product?.base_material ?? "Standard"}</p><p><span className="text-muted-foreground">Supplier:</span> {product?.supplier_tier ?? "standard"}</p><p><span className="text-muted-foreground">Print areas:</span> {(product?.print_areas ?? ["front", "back"]).join(", ")}</p>{recommended > 0 ? <p><span className="text-muted-foreground">Retail guide:</span> ${minimumRetail} minimum · ${recommended} recommended</p> : null}</div>
        <div className="space-y-2"><Label>Design name</Label><Input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="Tour Skull Tee" /></div>
        <div className="space-y-2"><Label>Base colour</Label><div className="flex flex-wrap gap-2">{colors.map((color) => <button key={color} type="button" title={color} onClick={() => setBaseColor(color)} className={`h-8 w-8 rounded-full border-2 ${baseColor === color ? "ring-2 ring-primary ring-offset-2" : ""}`} style={{ backgroundColor: color }} />)}</div></div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload className="mr-2 h-4 w-4" />{isUploading ? "Uploading..." : "Upload artwork"}</Button>
        <Button variant="outline" className="w-full" onClick={addText}><Type className="mr-2 h-4 w-4" />Add text</Button>
        <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Show safe print zone</span><Button size="sm" variant={showSafeZone ? "secondary" : "ghost"} onClick={() => setShowSafeZone((v) => !v)}>{showSafeZone ? "On" : "Off"}</Button></div>
        {artworkLibrary.length ? <div className="space-y-2"><Label>Artwork library</Label><div className="grid grid-cols-3 gap-2">{artworkLibrary.slice(0, 9).map((asset) => <button type="button" key={asset.id} title={asset.name} onClick={() => addArtwork(asset.url)} className="aspect-square overflow-hidden rounded-md border bg-muted/30 p-1 hover:ring-2 hover:ring-primary"><img src={asset.url} alt={asset.name} className="h-full w-full object-contain" /></button>)}</div></div> : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><Tabs value={activeView} onValueChange={(value) => { setActiveView(value as ViewSide); setSelectedId(null); }}><TabsList><TabsTrigger value="front">Front</TabsTrigger>{printableSides.has("back") ? <TabsTrigger value="back">Back</TabsTrigger> : null}</TabsList></Tabs><div className="flex gap-2">{printableSides.has("back") ? <Button size="sm" variant="outline" onClick={copySide}><Copy className="mr-2 h-3.5 w-3.5" />Copy side</Button> : null}<Badge variant="outline">{productType}</Badge></div></div>
        <div className="relative mx-auto aspect-square w-full max-w-[680px] overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/20 to-muted" onPointerDown={() => setSelectedId(null)}>
          <ProductSilhouette shape={shape} color={baseColor} />
          {showSafeZone ? <div className="pointer-events-none absolute border-2 border-dashed border-primary/50 bg-primary/5" style={{ left: `${safeZone.left}%`, top: `${safeZone.top}%`, width: `${safeZone.width}%`, height: `${safeZone.height}%` }}><span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[10px] text-muted-foreground">safe print area</span></div> : null}
          {currentElements.map((element) => <DesignLayer key={element.id} element={element} selected={selectedId === element.id} onSelect={() => setSelectedId(element.id)} onMove={(x, y) => setCurrentElements((elements) => elements.map((item) => item.id === element.id ? { ...item, x, y } : item))} />)}
          {!currentElements.length ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground"><div><ImagePlus className="mx-auto mb-2 h-8 w-8" />Upload artwork, reuse saved artwork or add text</div></div> : null}
        </div>
        <p className="text-center text-xs text-muted-foreground">Drag layers freely. Arrow keys nudge 1%; Shift + arrows nudges 5%. Ctrl/Cmd + D duplicates.</p>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="edit">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger></TabsList>
          <TabsContent value="edit" className="space-y-4 pt-2">
            <div className="rounded-lg border p-3"><p className="text-sm font-medium">Selected layer</p>{selected ? <div className="mt-3 space-y-4"><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => updateSelected({ x: 50 })}><AlignCenter className="mr-2 h-3.5 w-3.5" />Centre X</Button><Button size="sm" variant="outline" onClick={() => updateSelected({ y: 50 })}><Move className="mr-2 h-3.5 w-3.5" />Centre Y</Button></div><div><Label className="text-xs">Scale</Label><Slider value={[selected.scale]} min={0.2} max={3} step={0.05} onValueChange={([value]) => updateSelected({ scale: value })} /></div><div><Label className="text-xs">Rotation</Label><Slider value={[selected.rotation]} min={-180} max={180} step={1} onValueChange={([value]) => updateSelected({ rotation: value })} /></div>{selected.type === "text" ? <><div><Label className="text-xs">Text</Label><Input value={selected.text ?? ""} onChange={(e) => updateSelected({ text: e.target.value })} /></div><div><Label className="text-xs">Text colour</Label><Input type="color" value={selected.color ?? "#ffffff"} onChange={(e) => updateSelected({ color: e.target.value })} /></div><div><Label className="text-xs">Text size</Label><Slider value={[selected.fontSize ?? 24]} min={10} max={72} step={1} onValueChange={([value]) => updateSelected({ fontSize: value })} /></div></> : null}<div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={duplicateSelected}><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</Button><Button variant="destructive" size="sm" onClick={() => { setCurrentElements((elements) => elements.filter((item) => item.id !== selected.id)); setSelectedId(null); }}><Trash2 className="mr-2 h-3.5 w-3.5" />Remove</Button></div></div> : <p className="mt-2 text-xs text-muted-foreground">Select artwork or text to position, resize, rotate, duplicate or edit it.</p>}</div>
          </TabsContent>
          <TabsContent value="layers" className="space-y-2 pt-2">
            {currentElements.length ? currentElements.map((element, index) => <div key={element.id} className={`flex items-center gap-2 rounded-lg border p-2 ${selectedId === element.id ? "border-primary bg-primary/5" : ""}`}><button type="button" onClick={() => setSelectedId(element.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><Layers3 className="h-4 w-4 shrink-0" /><span className="truncate text-sm">{element.type === "text" ? element.text || "Text" : `Artwork ${index + 1}`}</span></button><Button size="icon" variant="ghost" disabled={index === currentElements.length - 1} onClick={() => { setSelectedId(element.id); setTimeout(() => reorderSelected(1), 0); }}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => { setSelectedId(element.id); setTimeout(() => reorderSelected(-1), 0); }}><ArrowDown className="h-4 w-4" /></Button></div>) : <p className="text-xs text-muted-foreground">No layers on this side yet.</p>}
          </TabsContent>
        </Tabs>
        <Button variant="outline" className="w-full" onClick={() => { setCurrentElements([]); setSelectedId(null); }}><RotateCcw className="mr-2 h-4 w-4" />Clear {activeView}</Button>
        <Button className="w-full" onClick={saveDesign} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Rendering preview..." : existingDesignId ? "Update design" : "Save design"}</Button>
      </div>
    </CardContent>
  </Card>;
};
