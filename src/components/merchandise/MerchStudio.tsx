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
import { MerchProductMockup } from "@/components/merchandise/MerchProductMockup";
import { shapeForMerchProduct } from "@/components/merchandise/merchProductShape";
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Copy,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  Move,
  RotateCcw,
  Save,
  Trash2,
  Type,
  Unlock,
  Upload,
} from "lucide-react";

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
  areaElements?: Record<string, DesignElement[]>;
};

type ArtworkAsset = { id: string; name: string; url: string };
type PrintZone = { left: number; top: number; width: number; height: number };

interface MerchStudioProps {
  bandId: string;
  existingDesignId?: string | null;
  onSave?: (designId: string) => void;
  onClearEditing?: () => void;
}

const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
const normaliseArea = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");
const prettyArea = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const zoneForSurface = (shape: string, area: string): PrintZone => {
  const surface = normaliseArea(area);
  if (surface.includes("sleeve")) {
    const right = surface.includes("right");
    return { left: right ? 71 : 12, top: 31, width: 17, height: 31 };
  }
  if (surface.includes("chest")) return { left: 39, top: 31, width: 22, height: 20 };
  if (surface.includes("pocket")) return { left: 53, top: 34, width: 12, height: 14 };
  if (surface.includes("wrap")) {
    if (["mug", "glass", "bottle"].includes(shape)) return { left: 24, top: 35, width: 52, height: 30 };
    return { left: 20, top: 25, width: 60, height: 50 };
  }
  if (shape === "poster" || shape === "flat") return { left: 22, top: 14, width: 56, height: 72 };
  if (shape === "booklet") return { left: 28, top: 20, width: 44, height: 60 };
  if (shape === "vinyl") return { left: 27, top: 27, width: 46, height: 46 };
  if (shape === "keyring") return { left: 36, top: 37, width: 28, height: 28 };
  if (shape === "pick") return { left: 38, top: 35, width: 24, height: 30 };
  if (shape === "pin") return { left: 37, top: 36, width: 26, height: 26 };
  if (shape === "pin-set") return { left: 27, top: 28, width: 46, height: 44 };
  if (shape === "sticker") return { left: 33, top: 32, width: 34, height: 34 };
  if (shape === "patch") return { left: 32, top: 33, width: 36, height: 34 };
  if (shape === "lanyard") return { left: 39, top: 35, width: 22, height: 32 };
  if (shape === "bundle") return { left: 28, top: 28, width: 44, height: 44 };
  if (shape === "mug") return { left: 27, top: 36, width: 42, height: 28 };
  if (shape === "glass") return { left: 34, top: 34, width: 32, height: 33 };
  if (shape === "bottle") return { left: 38, top: 36, width: 24, height: 34 };
  if (shape === "cap") return { left: 33, top: 39, width: 34, height: 21 };
  if (shape === "beanie") return { left: 35, top: 42, width: 30, height: 22 };
  if (shape === "tote") return { left: 28, top: 34, width: 44, height: 42 };
  if (shape === "football") return { left: 34, top: 29, width: 32, height: 45 };
  return { left: 34, top: 29, width: 32, height: 45 };
};

function DesignLayer({ element, selected, onSelect, onMove }: { element: DesignElement; selected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void }) {
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  return <div
    className={`absolute cursor-move select-none rounded ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""}`}
    style={{ left: `${element.x}%`, top: `${element.y}%`, transform: `translate(-50%, -50%) scale(${element.scale}) rotate(${element.rotation}deg)`, transformOrigin: "center" }}
    onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(); dragRef.current = { startX: event.clientX, startY: event.clientY, x: element.x, y: element.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={(event) => { if (!dragRef.current) return; const parent = event.currentTarget.parentElement?.getBoundingClientRect(); if (!parent) return; const dx = ((event.clientX - dragRef.current.startX) / parent.width) * 100; const dy = ((event.clientY - dragRef.current.startY) / parent.height) * 100; onMove(dragRef.current.x + dx, dragRef.current.y + dy); }}
    onPointerUp={() => { dragRef.current = null; }}
  >
    {element.type === "image" && element.src ? <img src={element.src} alt="Uploaded artwork" className="pointer-events-none max-h-40 max-w-40 object-contain drop-shadow-md" draggable={false} /> : <div className="pointer-events-none whitespace-nowrap px-2 py-1 text-center font-black uppercase tracking-wide drop-shadow" style={{ color: element.color ?? "#fff", fontSize: element.fontSize ?? 24 }}>{element.text}</div>}
  </div>;
}

export const MerchStudio = ({ bandId, existingDesignId, onSave, onClearEditing }: MerchStudioProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: requirements = [], isLoading: loadingCatalogue } = useMerchRequirements();
  const personalisable = useMemo(() => requirements.filter((item) => item.is_personalisable && (item.product_kind ?? "physical") === "physical"), [requirements]);
  const [productType, setProductType] = useState("");
  const [designName, setDesignName] = useState("");
  const [baseColor, setBaseColor] = useState("#171717");
  const [activeArea, setActiveArea] = useState("front");
  const [areaElements, setAreaElements] = useState<Record<string, DesignElement[]>>({ front: [], back: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [constrainToPrintArea, setConstrainToPrintArea] = useState(false);

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
        seen.add(row.artwork_url); assets.push({ id: row.id, name: row.design_name ?? "Saved artwork", url: row.artwork_url }); return assets;
      }, []);
    },
    enabled: Boolean(bandId),
  });

  useEffect(() => {
    if (!existingDesign) return;
    const data = (existingDesign.design_data ?? {}) as DesignData;
    const legacy = {
      front: Array.isArray(data.frontElements) ? data.frontElements : [],
      back: Array.isArray(data.backElements) ? data.backElements : [],
    };
    setDesignName(existingDesign.design_name ?? "");
    setProductType(data.productType ?? existingDesign.product_type ?? personalisable[0]?.item_type ?? "");
    setBaseColor(data.garmentColor ?? existingDesign.background_color ?? "#171717");
    setAreaElements(data.areaElements && typeof data.areaElements === "object" ? { ...legacy, ...data.areaElements } : legacy);
    setActiveArea("front"); setSelectedId(null);
  }, [existingDesign, personalisable]);

  const product = personalisable.find((item) => item.item_type === productType) ?? personalisable[0];
  const shape = shapeForMerchProduct(productType);
  const printAreas = useMemo(() => {
    const configured = (product?.print_areas?.length ? product.print_areas : ["front", "back"]).map(normaliseArea);
    return Array.from(new Set(configured.length ? configured : ["front"]));
  }, [product]);
  const zone = zoneForSurface(shape, activeArea);
  const colors = product?.colour_options?.length ? product.colour_options : ["#171717", "#f8fafc", "#404040", "#172554", "#991b1b", "#14532d"];
  const currentElements = areaElements[activeArea] ?? [];
  const selectedIndex = currentElements.findIndex((element) => element.id === selectedId);
  const selected = selectedIndex >= 0 ? currentElements[selectedIndex] : null;
  const recommended = Number(product?.recommended_retail_price ?? 0);
  const minimumRetail = Number(product?.minimum_retail_price ?? 0);

  useEffect(() => {
    if (!printAreas.includes(activeArea)) setActiveArea(printAreas[0] ?? "front");
  }, [activeArea, printAreas]);

  const setCurrentElements = (updater: (elements: DesignElement[]) => DesignElement[]) => {
    setAreaElements((all) => ({ ...all, [activeArea]: updater(all[activeArea] ?? []) }));
  };

  const clampPoint = (x: number, y: number) => {
    if (!constrainToPrintArea) return { x: Math.min(90, Math.max(10, x)), y: Math.min(90, Math.max(10, y)) };
    const padX = Math.min(6, zone.width / 4); const padY = Math.min(6, zone.height / 4);
    return {
      x: Math.min(zone.left + zone.width - padX, Math.max(zone.left + padX, x)),
      y: Math.min(zone.top + zone.height - padY, Math.max(zone.top + padY, y)),
    };
  };

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    setCurrentElements((elements) => elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element));
  };

  const addText = () => {
    const element: DesignElement = { id: makeId(), type: "text", text: "YOUR BAND", x: zone.left + zone.width / 2, y: zone.top + zone.height / 2, scale: 1, rotation: 0, color: String(baseColor).toLowerCase() === "white" || baseColor === "#f8fafc" ? "#111827" : "#ffffff", fontSize: 24 };
    setCurrentElements((elements) => [...elements, element]); setSelectedId(element.id);
  };

  const addArtwork = (src: string) => {
    const element: DesignElement = { id: makeId(), type: "image", src, x: zone.left + zone.width / 2, y: zone.top + zone.height / 2, scale: 1, rotation: 0 };
    setCurrentElements((elements) => [...elements, element]); setSelectedId(element.id);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const point = clampPoint(selected.x + 3, selected.y + 3);
    const duplicate = { ...selected, id: makeId(), ...point };
    setCurrentElements((elements) => [...elements, duplicate]); setSelectedId(duplicate.id);
  };

  const reorderSelected = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const target = Math.max(0, Math.min(currentElements.length - 1, selectedIndex + direction));
    if (target === selectedIndex) return;
    const next = [...currentElements]; const [item] = next.splice(selectedIndex, 1); next.splice(target, 0, item);
    setAreaElements((all) => ({ ...all, [activeArea]: next }));
  };

  const copyToNextArea = () => {
    if (printAreas.length < 2) return;
    const index = printAreas.indexOf(activeArea); const target = printAreas[(index + 1) % printAreas.length];
    const targetZone = zoneForSurface(shape, target);
    const sourceCentre = { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 };
    const targetCentre = { x: targetZone.left + targetZone.width / 2, y: targetZone.top + targetZone.height / 2 };
    const cloned = currentElements.map((element) => ({ ...element, id: makeId(), x: element.x - sourceCentre.x + targetCentre.x, y: element.y - sourceCentre.y + targetCentre.y }));
    setAreaElements((all) => ({ ...all, [target]: cloned }));
    toast({ title: "Surface copied", description: `Copied ${prettyArea(activeArea)} layout to ${prettyArea(target)}.` });
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
    if (!remaining) return toast({ title: "Artwork limit reached", description: "You can place up to eight image layers on each print surface.", variant: "destructive" });
    setIsUploading(true);
    try {
      for (const file of Array.from(files).slice(0, remaining)) addArtwork(await uploadArtwork(file));
      toast({ title: "Artwork uploaded", description: `Artwork added to ${prettyArea(activeArea)}.` });
    } catch (error) { toast({ title: "Artwork upload failed", description: error instanceof Error ? error.message : "Upload failed", variant: "destructive" }); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      const step = event.shiftKey ? 5 : 1;
      let next = { x: selected.x, y: selected.y };
      if (event.key === "ArrowLeft") next.x -= step;
      if (event.key === "ArrowRight") next.x += step;
      if (event.key === "ArrowUp") next.y -= step;
      if (event.key === "ArrowDown") next.y += step;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); updateSelected(clampPoint(next.x, next.y)); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      if (event.key === "Delete" || event.key === "Backspace") { setCurrentElements((elements) => elements.filter((item) => item.id !== selected.id)); setSelectedId(null); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, activeArea, constrainToPrintArea, zone.left, zone.top, zone.width, zone.height]);

  const saveDesign = async () => {
    if (!bandId) return toast({ title: "No band selected", description: "Select or join a band before saving merchandise.", variant: "destructive" });
    if (!productType) return toast({ title: "Choose a product", description: "Select a merchandise product before saving.", variant: "destructive" });
    if (!designName.trim()) return toast({ title: "Name your design", description: "Add a name before saving.", variant: "destructive" });
    const allElements = Object.values(areaElements).flat();
    if (!allElements.length) return toast({ title: "Add a design", description: "Upload artwork or add text before saving.", variant: "destructive" });
    setIsSaving(true);
    try {
      const firstArtwork = allElements.find((element) => element.type === "image")?.src ?? null;
      const payload = {
        band_id: bandId,
        design_name: designName.trim(),
        background_color: baseColor,
        product_type: productType,
        artwork_url: firstArtwork,
        preview_image_url: null,
        preview_data_url: null,
        design_data: {
          version: 6,
          productType,
          garmentColor: baseColor,
          frontElements: areaElements.front ?? [],
          backElements: areaElements.back ?? [],
          areaElements,
        },
      };
      const query = (supabase as any).from("tshirt_designs");
      const { data, error } = existingDesignId ? await query.update(payload).eq("id", existingDesignId).eq("band_id", bandId).select("id").single() : await query.insert(payload).select("id").single();
      if (error) throw error;
      toast({ title: existingDesignId ? "Design updated" : "Merch design saved", description: `${designName.trim()} now includes ${Object.keys(areaElements).filter((area) => areaElements[area]?.length).length} designed print surface(s).` });
      onSave?.(data.id);
    } catch (error: any) {
      const message = error?.message || error?.details || error?.hint || "Unable to save design";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  if (loadingCatalogue || loadingExisting) return <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  if (!personalisable.length) return <Card><CardHeader><CardTitle>Merch Studio</CardTitle><CardDescription>No personalisable physical products are configured in the catalogue.</CardDescription></CardHeader></Card>;

  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Merch Studio</CardTitle><CardDescription>Design every configured print surface with product-specific safe zones and reusable artwork.</CardDescription></div><div className="flex gap-2"><Badge variant="secondary">{personalisable.length} products</Badge>{existingDesignId ? <Button size="sm" variant="outline" onClick={onClearEditing}>New design</Button> : null}</div></div></CardHeader>
    <CardContent className="grid gap-6 xl:grid-cols-[310px_1fr_320px]">
      <div className="space-y-4">
        <div className="space-y-2"><Label>Product</Label><Select value={productType} onValueChange={(value) => { setProductType(value); setSelectedId(null); setActiveArea("front"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{personalisable.map((item) => <SelectItem key={item.id} value={item.item_type}>{item.item_type}</SelectItem>)}</SelectContent></Select></div>
        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1"><p><span className="text-muted-foreground">Material:</span> {product?.base_material ?? "Standard"}</p><p><span className="text-muted-foreground">Supplier:</span> {product?.supplier_tier ?? "standard"}</p><p><span className="text-muted-foreground">Print surfaces:</span> {printAreas.map(prettyArea).join(", ")}</p>{recommended > 0 ? <p><span className="text-muted-foreground">Retail guide:</span> ${minimumRetail} minimum · ${recommended} recommended</p> : null}</div>
        <div className="space-y-2"><Label>Design name</Label><Input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="Tour Skull Tee" /></div>
        <div className="space-y-2"><Label>Base colour</Label><div className="flex flex-wrap gap-2">{colors.map((color) => <button key={color} type="button" title={color} onClick={() => setBaseColor(color)} className={`h-8 w-8 rounded-full border-2 ${baseColor === color ? "ring-2 ring-primary ring-offset-2" : ""}`} style={{ backgroundColor: color }} />)}</div></div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload className="mr-2 h-4 w-4" />{isUploading ? "Uploading..." : `Upload to ${prettyArea(activeArea)}`}</Button>
        <Button variant="outline" className="w-full" onClick={addText}><Type className="mr-2 h-4 w-4" />Add text</Button>
        <div className="space-y-2 rounded-lg border p-3 text-sm"><div className="flex items-center justify-between"><span>Show print zone</span><Button size="sm" variant={showSafeZone ? "secondary" : "ghost"} onClick={() => setShowSafeZone((v) => !v)}>{showSafeZone ? "On" : "Off"}</Button></div><div className="flex items-center justify-between"><span>Lock to print zone</span><Button size="sm" variant={constrainToPrintArea ? "secondary" : "ghost"} onClick={() => setConstrainToPrintArea((v) => !v)}>{constrainToPrintArea ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</Button></div></div>
        {artworkLibrary.length ? <div className="space-y-2"><Label>Artwork library</Label><div className="grid grid-cols-3 gap-2">{artworkLibrary.slice(0, 9).map((asset) => <button type="button" key={asset.id} title={asset.name} onClick={() => addArtwork(asset.url)} className="aspect-square overflow-hidden rounded-md border bg-muted/30 p-1 hover:ring-2 hover:ring-primary"><img src={asset.url} alt={asset.name} className="h-full w-full object-contain" /></button>)}</div></div> : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><Tabs value={activeArea} onValueChange={(value) => { setActiveArea(value); setSelectedId(null); }}><TabsList className="h-auto flex-wrap">{printAreas.map((area) => <TabsTrigger key={area} value={area} className="text-xs">{prettyArea(area)}{(areaElements[area] ?? []).length ? ` (${areaElements[area].length})` : ""}</TabsTrigger>)}</TabsList></Tabs><div className="flex gap-2">{printAreas.length > 1 ? <Button size="sm" variant="outline" onClick={copyToNextArea}><Copy className="mr-2 h-3.5 w-3.5" />Copy to next</Button> : null}<Badge variant="outline">{productType}</Badge></div></div>
        <div className="relative mx-auto aspect-square w-full max-w-[680px] overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/20 to-muted" onPointerDown={() => setSelectedId(null)}>
          <MerchProductMockup shape={shape} color={baseColor} area={activeArea} />
          {showSafeZone ? <div className="pointer-events-none absolute border-2 border-dashed border-primary/55 bg-primary/5" style={{ left: `${zone.left}%`, top: `${zone.top}%`, width: `${zone.width}%`, height: `${zone.height}%` }}><span className="absolute left-1 top-1 rounded bg-background/85 px-1 text-[10px] text-muted-foreground">{prettyArea(activeArea)} print zone</span></div> : null}
          {currentElements.map((element) => <DesignLayer key={element.id} element={element} selected={selectedId === element.id} onSelect={() => setSelectedId(element.id)} onMove={(x, y) => { const point = clampPoint(x, y); setCurrentElements((elements) => elements.map((item) => item.id === element.id ? { ...item, ...point } : item)); }} />)}
          {!currentElements.length ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground"><div><ImagePlus className="mx-auto mb-2 h-8 w-8" />Design the {prettyArea(activeArea)} surface</div></div> : null}
        </div>
        <p className="text-center text-xs text-muted-foreground">Each print surface is saved independently. Turn on the lock to keep artwork inside the supplier printable zone.</p>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="edit">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger></TabsList>
          <TabsContent value="edit" className="space-y-4 pt-2">
            <div className="rounded-lg border p-3"><p className="text-sm font-medium">Selected layer · {prettyArea(activeArea)}</p>{selected ? <div className="mt-3 space-y-4"><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => updateSelected({ x: zone.left + zone.width / 2 })}><AlignCenter className="mr-2 h-3.5 w-3.5" />Centre X</Button><Button size="sm" variant="outline" onClick={() => updateSelected({ y: zone.top + zone.height / 2 })}><Move className="mr-2 h-3.5 w-3.5" />Centre Y</Button></div><div><Label className="text-xs">Scale</Label><Slider value={[selected.scale]} min={0.2} max={3} step={0.05} onValueChange={([value]) => updateSelected({ scale: value })} /></div><div><Label className="text-xs">Rotation</Label><Slider value={[selected.rotation]} min={-180} max={180} step={1} onValueChange={([value]) => updateSelected({ rotation: value })} /></div>{selected.type === "text" ? <><div><Label className="text-xs">Text</Label><Input value={selected.text ?? ""} onChange={(e) => updateSelected({ text: e.target.value })} /></div><div><Label className="text-xs">Text colour</Label><Input type="color" value={selected.color ?? "#ffffff"} onChange={(e) => updateSelected({ color: e.target.value })} /></div><div><Label className="text-xs">Text size</Label><Slider value={[selected.fontSize ?? 24]} min={10} max={72} step={1} onValueChange={([value]) => updateSelected({ fontSize: value })} /></div></> : null}<div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={duplicateSelected}><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</Button><Button variant="destructive" size="sm" onClick={() => { setCurrentElements((elements) => elements.filter((item) => item.id !== selected.id)); setSelectedId(null); }}><Trash2 className="mr-2 h-3.5 w-3.5" />Remove</Button></div></div> : <p className="mt-2 text-xs text-muted-foreground">Select artwork or text to position, resize, rotate, duplicate or edit it.</p>}</div>
          </TabsContent>
          <TabsContent value="layers" className="space-y-2 pt-2">
            {currentElements.length ? currentElements.map((element, index) => <div key={element.id} className={`flex items-center gap-2 rounded-lg border p-2 ${selectedId === element.id ? "border-primary bg-primary/5" : ""}`}><button type="button" onClick={() => setSelectedId(element.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><Layers3 className="h-4 w-4 shrink-0" /><span className="truncate text-sm">{element.type === "text" ? element.text || "Text" : `Artwork ${index + 1}`}</span></button><Button size="icon" variant="ghost" disabled={index === currentElements.length - 1} onClick={() => { setSelectedId(element.id); setTimeout(() => reorderSelected(1), 0); }}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => { setSelectedId(element.id); setTimeout(() => reorderSelected(-1), 0); }}><ArrowDown className="h-4 w-4" /></Button></div>) : <p className="text-xs text-muted-foreground">No layers on this print surface yet.</p>}
          </TabsContent>
        </Tabs>
        <Button variant="outline" className="w-full" onClick={() => { setCurrentElements(() => []); setSelectedId(null); }}><RotateCcw className="mr-2 h-4 w-4" />Clear {prettyArea(activeArea)}</Button>
        <Button className="w-full" onClick={saveDesign} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving design..." : existingDesignId ? "Update design" : "Save design"}</Button>
      </div>
    </CardContent>
  </Card>;
};