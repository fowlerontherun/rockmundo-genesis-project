import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Loader2, RotateCcw, Save, Trash2, Type, Upload } from "lucide-react";

type ViewSide = "front" | "back";
type ElementKind = "image" | "text";

type DesignElement = {
  id: string;
  type: ElementKind;
  src?: string;
  text?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color?: string;
  fontSize?: number;
};

interface TShirtDesignerNewProps {
  bandId: string;
  onSave?: (designId: string) => void;
  existingDesignId?: string;
}

const PRODUCT_OPTIONS = [
  { value: "Graphic Tee", label: "Graphic Tee", shape: "tee" },
  { value: "Heavyweight Tee", label: "Heavyweight Tee", shape: "tee" },
  { value: "Long Sleeve Tee", label: "Long Sleeve Tee", shape: "long" },
  { value: "Premium Hoodie", label: "Premium Hoodie", shape: "hoodie" },
  { value: "Zip Hoodie", label: "Zip Hoodie", shape: "hoodie" },
  { value: "Tour Crewneck", label: "Tour Crewneck", shape: "crewneck" },
  { value: "Football Shirt", label: "Football Shirt", shape: "tee" },
  { value: "Tour Tote Bag", label: "Tote Bag", shape: "tote" },
  { value: "Band Poster", label: "Poster", shape: "poster" },
  { value: "Mug", label: "Mug", shape: "mug" },
] as const;

const COLORS = [
  { label: "Black", value: "#171717" },
  { label: "White", value: "#f8fafc" },
  { label: "Washed Black", value: "#404040" },
  { label: "Navy", value: "#172554" },
  { label: "Cream", value: "#f5f0df" },
  { label: "Red", value: "#991b1b" },
  { label: "Forest", value: "#14532d" },
  { label: "Royal Blue", value: "#1d4ed8" },
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ProductSilhouette({ shape, color }: { shape: string; color: string }) {
  if (shape === "poster") {
    return <div className="absolute inset-[8%_18%] rounded-sm border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }} />;
  }
  if (shape === "tote") {
    return (
      <div className="absolute left-[20%] right-[20%] top-[24%] bottom-[13%] rounded-b-xl border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }}>
        <div className="absolute left-[24%] right-[24%] -top-[24%] h-[28%] rounded-t-[999px] border-[10px] border-b-0 border-black/20" />
      </div>
    );
  }
  if (shape === "mug") {
    return (
      <div className="absolute left-[20%] right-[25%] top-[27%] bottom-[24%] rounded-b-3xl rounded-t-lg border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }}>
        <div className="absolute -right-[30%] top-[18%] h-[55%] w-[34%] rounded-r-full border-8 border-l-0 border-black/20" />
      </div>
    );
  }

  const longSleeve = shape === "long" || shape === "hoodie" || shape === "crewneck";
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[27%] right-[27%] top-[18%] bottom-[10%] rounded-b-3xl border-4 border-black/20 shadow-xl" style={{ backgroundColor: color }} />
      <div className={`absolute top-[20%] h-[25%] ${longSleeve ? "left-[8%] w-[23%] rotate-[16deg]" : "left-[14%] w-[20%] rotate-[25deg]"} rounded-xl border-4 border-black/20`} style={{ backgroundColor: color }} />
      <div className={`absolute top-[20%] h-[25%] ${longSleeve ? "right-[8%] w-[23%] -rotate-[16deg]" : "right-[14%] w-[20%] -rotate-[25deg]"} rounded-xl border-4 border-black/20`} style={{ backgroundColor: color }} />
      {shape === "hoodie" ? <div className="absolute left-[37%] right-[37%] top-[10%] h-[18%] rounded-t-full border-4 border-black/20" style={{ backgroundColor: color }} /> : null}
      <div className="absolute left-1/2 top-[17%] h-[7%] w-[13%] -translate-x-1/2 rounded-b-full border-b-4 border-black/20 bg-background/40" />
    </div>
  );
}

function DesignLayer({ element, selected, onSelect, onMove }: {
  element: DesignElement;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const style: React.CSSProperties = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    transform: `translate(-50%, -50%) scale(${element.scale}) rotate(${element.rotation}deg)`,
    transformOrigin: "center",
  };

  return (
    <div
      className={`absolute cursor-move select-none rounded ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""}`}
      style={style}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        dragRef.current = { startX: event.clientX, startY: event.clientY, x: element.x, y: element.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        const parent = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!parent) return;
        const dx = ((event.clientX - dragRef.current.startX) / parent.width) * 100;
        const dy = ((event.clientY - dragRef.current.startY) / parent.height) * 100;
        onMove(Math.min(84, Math.max(16, dragRef.current.x + dx)), Math.min(78, Math.max(22, dragRef.current.y + dy)));
      }}
      onPointerUp={() => { dragRef.current = null; }}
    >
      {element.type === "image" && element.src ? (
        <img src={element.src} alt="Uploaded artwork" className="pointer-events-none max-h-36 max-w-36 object-contain drop-shadow-md" draggable={false} />
      ) : (
        <div
          className="pointer-events-none whitespace-nowrap px-2 py-1 text-center font-black uppercase tracking-wide drop-shadow"
          style={{ color: element.color ?? "#ffffff", fontSize: element.fontSize ?? 24 }}
        >
          {element.text}
        </div>
      )}
    </div>
  );
}

export const TShirtDesignerNew = ({ bandId, onSave, existingDesignId }: TShirtDesignerNewProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [productType, setProductType] = useState("Graphic Tee");
  const [designName, setDesignName] = useState("");
  const [garmentColor, setGarmentColor] = useState("#171717");
  const [activeView, setActiveView] = useState<ViewSide>("front");
  const [frontElements, setFrontElements] = useState<DesignElement[]>([]);
  const [backElements, setBackElements] = useState<DesignElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentElements = activeView === "front" ? frontElements : backElements;
  const setCurrentElements = activeView === "front" ? setFrontElements : setBackElements;
  const selected = currentElements.find((element) => element.id === selectedId) ?? null;
  const product = PRODUCT_OPTIONS.find((item) => item.value === productType) ?? PRODUCT_OPTIONS[0];
  const firstArtwork = useMemo(
    () => [...frontElements, ...backElements].find((element) => element.type === "image")?.src ?? null,
    [frontElements, backElements],
  );

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    setCurrentElements((elements) => elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element));
  };

  const addText = () => {
    const element: DesignElement = { id: makeId(), type: "text", text: "YOUR BAND", x: 50, y: 48, scale: 1, rotation: 0, color: garmentColor === "#f8fafc" ? "#111827" : "#ffffff", fontSize: 24 };
    setCurrentElements((elements) => [...elements, element]);
    setSelectedId(element.id);
  };

  const uploadArtwork = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) throw new Error("Use PNG, JPG, WEBP or SVG artwork.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Artwork must be 10 MB or smaller.");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("You need to be signed in to upload artwork.");
    const path = `${authData.user.id}/${bandId}/${makeId()}-${slugify(file.name)}`;
    const { error } = await supabase.storage.from("merch-artwork").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("merch-artwork").getPublicUrl(path).data.publicUrl;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 5 - currentElements.filter((element) => element.type === "image").length);
    if (remaining === 0) {
      toast({ title: "Artwork limit reached", description: "You can place up to five artwork layers on each side.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, remaining)) urls.push(await uploadArtwork(file));
      const additions = urls.map((src, index): DesignElement => ({ id: makeId(), type: "image", src, x: 50 + index * 3, y: 48 + index * 3, scale: 1, rotation: 0 }));
      setCurrentElements((elements) => [...elements, ...additions]);
      if (additions[0]) setSelectedId(additions[0].id);
      toast({ title: "Artwork uploaded", description: `${additions.length} reusable artwork layer${additions.length === 1 ? "" : "s"} added.` });
    } catch (error) {
      toast({ title: "Artwork upload failed", description: error instanceof Error ? error.message : "Upload failed.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setCurrentElements((elements) => elements.filter((element) => element.id !== selectedId));
    setSelectedId(null);
  };

  const resetSide = () => {
    setCurrentElements([]);
    setSelectedId(null);
  };

  const buildPreview = () => {
    const text = [...frontElements, ...backElements].find((element) => element.type === "text")?.text ?? designName;
    const escaped = (text || productType).replace(/[<>&"]/g, "");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f3f4f6"/><rect x="150" y="90" width="300" height="420" rx="40" fill="${garmentColor}"/><text x="300" y="300" text-anchor="middle" font-family="Arial" font-size="40" font-weight="700" fill="${garmentColor === "#f8fafc" ? "#111827" : "#ffffff"}">${escaped}</text><text x="300" y="555" text-anchor="middle" font-family="Arial" font-size="22" fill="#374151">${productType}</text></svg>`)}`;
  };

  const saveDesign = async () => {
    if (!designName.trim()) {
      toast({ title: "Name your design", description: "Add a product/design name before saving.", variant: "destructive" });
      return;
    }
    if (frontElements.length + backElements.length === 0) {
      toast({ title: "Add a design", description: "Upload artwork or add text before saving.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        band_id: bandId,
        design_name: designName.trim(),
        background_color: garmentColor,
        product_type: productType,
        artwork_url: firstArtwork,
        preview_image_url: buildPreview(),
        preview_data_url: buildPreview(),
        design_data: { version: 2, productType, garmentColor, frontElements, backElements },
      };

      const query = (supabase as any).from("tshirt_designs");
      const { data, error } = existingDesignId
        ? await query.update(payload).eq("id", existingDesignId).select("id").single()
        : await query.insert(payload).select("id").single();
      if (error) throw error;
      toast({ title: "Merch design saved", description: `${designName.trim()} can now be reused for product drops.` });
      onSave?.(data.id);
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unable to save design.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Merch Studio</CardTitle>
          <Badge variant="secondary">Artwork uploads</Badge>
          <Badge variant="outline">Reusable designs</Badge>
        </div>
        <CardDescription>
          Build a real product mock-up: choose the blank, upload your own artwork, drag it into place, add text and save the design for future drops.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <div className="space-y-3">
            <Tabs value={activeView} onValueChange={(value) => { setActiveView(value as ViewSide); setSelectedId(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="front">Front</TabsTrigger>
                <TabsTrigger value="back">Back</TabsTrigger>
              </TabsList>
            </Tabs>

            <div
              className="relative mx-auto aspect-[4/5] w-full max-w-[520px] overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/50 to-muted shadow-inner"
              onClick={() => setSelectedId(null)}
            >
              <ProductSilhouette shape={product.shape} color={garmentColor} />
              <div className="absolute left-[23%] right-[23%] top-[28%] bottom-[18%] rounded-xl border border-dashed border-white/35 bg-black/[0.03]">
                <span className="absolute left-2 top-2 text-[10px] font-medium uppercase tracking-widest text-white/50">print area</span>
              </div>
              {currentElements.map((element) => (
                <DesignLayer
                  key={element.id}
                  element={element}
                  selected={selectedId === element.id}
                  onSelect={() => setSelectedId(element.id)}
                  onMove={(x, y) => {
                    setCurrentElements((elements) => elements.map((entry) => entry.id === element.id ? { ...entry, x, y } : entry));
                  }}
                />
              ))}
              {currentElements.length === 0 ? (
                <div className="absolute inset-x-0 bottom-6 flex justify-center">
                  <Badge variant="secondary" className="gap-1"><ImagePlus className="h-3 w-3" /> Upload artwork or add text</Badge>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Design / drop name</Label>
              <Input value={designName} onChange={(event) => setDesignName(event.target.value)} placeholder="e.g. Shockmaster Autumn Tour Tee" />
            </div>

            <div className="space-y-2">
              <Label>Product colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((colour) => (
                  <button
                    key={colour.value}
                    type="button"
                    title={colour.label}
                    onClick={() => setGarmentColor(colour.value)}
                    className={`h-9 w-9 rounded-full border-2 shadow-sm ${garmentColor === colour.value ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                    style={{ backgroundColor: colour.value }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload artwork
              </Button>
              <Button type="button" variant="outline" onClick={addText}><Type className="mr-2 h-4 w-4" /> Add text</Button>
            </div>

            {selected ? (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Selected {selected.type === "image" ? "artwork" : "text"}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={removeSelected}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                </div>
                {selected.type === "text" ? (
                  <div className="space-y-2">
                    <Label>Text</Label>
                    <Input value={selected.text ?? ""} onChange={(event) => updateSelected({ text: event.target.value })} />
                    <Label>Text colour</Label>
                    <Input type="color" value={selected.color ?? "#ffffff"} onChange={(event) => updateSelected({ color: event.target.value })} className="h-10 p-1" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><Label>Scale</Label><span>{selected.scale.toFixed(1)}×</span></div>
                  <Slider value={[selected.scale]} min={0.35} max={2.2} step={0.05} onValueChange={([value]) => updateSelected({ scale: value })} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><Label>Rotation</Label><span>{selected.rotation}°</span></div>
                  <Slider value={[selected.rotation]} min={-180} max={180} step={1} onValueChange={([value]) => updateSelected({ rotation: value })} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Select artwork on the mock-up to resize or rotate it. Drag it directly on the product to reposition it.</div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={resetSide}><RotateCcw className="mr-2 h-4 w-4" /> Clear {activeView}</Button>
              <Button type="button" className="flex-1" onClick={() => void saveDesign()} disabled={isSaving || isUploading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save design
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Artwork</p><p className="font-medium">PNG · JPG · WEBP · SVG</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Maximum file</p><p className="font-medium">10 MB per image</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Saved asset</p><p className="font-medium">Reusable across future drops</p></div>
        </div>
      </CardContent>
    </Card>
  );
};
