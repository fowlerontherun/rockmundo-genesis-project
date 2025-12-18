import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Save, RotateCcw, ZoomIn, ZoomOut, Move, Type, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TShirtColorPicker } from "./TShirtColorPicker";
import { cn } from "@/lib/utils";

interface DesignElement {
  id: string;
  type: "image" | "text";
  src?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

interface TShirtDesignerNewProps {
  bandId: string;
  onSave?: (designId: string) => void;
  existingDesignId?: string;
}

const TSHIRT_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#1a1a1a" },
  { name: "Navy", value: "#1e3a8a" },
  { name: "Gray", value: "#6b7280" },
  { name: "Red", value: "#dc2626" },
  { name: "Forest Green", value: "#15803d" },
  { name: "Royal Blue", value: "#2563eb" },
  { name: "Purple", value: "#9333ea" },
];

const PRINT_AREA = {
  front: { x: 85, y: 100, width: 130, height: 160 },
  back: { x: 85, y: 90, width: 130, height: 180 },
};

export const TShirtDesignerNew = ({ bandId, onSave, existingDesignId }: TShirtDesignerNewProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tshirtColor, setTshirtColor] = useState<string>("#ffffff");
  const [designName, setDesignName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeView, setActiveView] = useState<"front" | "back">("front");
  const [frontElements, setFrontElements] = useState<DesignElement[]>([]);
  const [backElements, setBackElements] = useState<DesignElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

  const currentElements = activeView === "front" ? frontElements : backElements;
  const setCurrentElements = activeView === "front" ? setFrontElements : setBackElements;
  const printArea = PRINT_AREA[activeView];

  const generateId = () => `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - currentElements.filter(el => el.type === "image").length;
    if (files.length > remainingSlots) {
      toast({
        title: "Too many images",
        description: `You can add ${remainingSlots} more image(s). Max 5 per side.`,
        variant: "destructive",
      });
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxSize = 80;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          
          const newElement: DesignElement = {
            id: generateId(),
            type: "image",
            src: event.target?.result as string,
            x: printArea.x + printArea.width / 2 - (img.width * scale) / 2,
            y: printArea.y + printArea.height / 2 - (img.height * scale) / 2,
            width: img.width * scale,
            height: img.height * scale,
            rotation: 0,
            scale: 1,
          };
          setCurrentElements(prev => [...prev, newElement]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentElements, printArea, setCurrentElements, toast]);

  const addTextElement = useCallback(() => {
    const newElement: DesignElement = {
      id: generateId(),
      type: "text",
      text: "Your Text",
      x: printArea.x + printArea.width / 2 - 40,
      y: printArea.y + printArea.height / 2 - 10,
      width: 80,
      height: 24,
      rotation: 0,
      scale: 1,
      fontSize: 16,
      fontFamily: "Arial",
      color: tshirtColor === "#ffffff" || tshirtColor === "#1a1a1a" ? 
        (tshirtColor === "#ffffff" ? "#000000" : "#ffffff") : "#ffffff",
    };
    setCurrentElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  }, [printArea, setCurrentElements, tshirtColor]);

  const handleMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    setIsDragging(true);
    
    const element = currentElements.find(el => el.id === elementId);
    if (element) {
      const rect = (e.currentTarget as HTMLElement).closest('.design-canvas')?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left - element.x,
          y: e.clientY - rect.top - element.y,
        });
      }
    }
  }, [currentElements]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;

    setCurrentElements(prev => prev.map(el => 
      el.id === selectedElementId
        ? { ...el, x: Math.max(printArea.x, Math.min(newX, printArea.x + printArea.width - el.width)), 
            y: Math.max(printArea.y, Math.min(newY, printArea.y + printArea.height - el.height)) }
        : el
    ));
  }, [isDragging, selectedElementId, dragOffset, printArea, setCurrentElements]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const deleteSelectedElement = useCallback(() => {
    if (selectedElementId) {
      setCurrentElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
      toast({ title: "Element removed" });
    }
  }, [selectedElementId, setCurrentElements, toast]);

  const updateSelectedElement = useCallback((updates: Partial<DesignElement>) => {
    if (selectedElementId) {
      setCurrentElements(prev => prev.map(el =>
        el.id === selectedElementId ? { ...el, ...updates } : el
      ));
    }
  }, [selectedElementId, setCurrentElements]);

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a design name.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const designData = {
        frontElements,
        backElements,
        tshirtColor,
      };

      // Create a simple preview by describing the design
      const previewDataUrl = `data:text/plain,Design:${designName}`;

      const { data, error } = await (supabase as any)
        .from('tshirt_designs')
        .insert({
          band_id: bandId,
          design_name: designName,
          background_color: tshirtColor,
          design_data: designData,
          preview_image_url: previewDataUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Design saved!",
        description: `"${designName}" has been saved successfully.`,
      });

      if (onSave && data) {
        onSave(data.id);
      }
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedElement = currentElements.find(el => el.id === selectedElementId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Custom T-Shirt Designer
          <Badge variant="secondary">New</Badge>
        </CardTitle>
        <CardDescription>
          Create front and back designs. Custom designs get a quality boost!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Design Canvas */}
          <div className="space-y-4">
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "front" | "back")}>
              <TabsList className="w-full">
                <TabsTrigger value="front" className="flex-1">Front</TabsTrigger>
                <TabsTrigger value="back" className="flex-1">Back</TabsTrigger>
              </TabsList>
            </Tabs>

            <div 
              className="design-canvas relative border rounded-lg overflow-hidden bg-muted/30 mx-auto"
              style={{ width: 300, height: 380 }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => setSelectedElementId(null)}
            >
              {/* T-Shirt SVG */}
              <svg viewBox="0 0 300 380" className="absolute inset-0 w-full h-full">
                {/* T-Shirt Shape */}
                <path
                  d={activeView === "front" 
                    ? "M75 30 L45 50 L20 90 L50 100 L60 70 L60 350 L240 350 L240 70 L250 100 L280 90 L255 50 L225 30 L190 30 C185 50 165 65 150 65 C135 65 115 50 110 30 Z"
                    : "M75 30 L45 50 L20 90 L50 100 L60 70 L60 350 L240 350 L240 70 L250 100 L280 90 L255 50 L225 30 L190 30 C185 40 165 50 150 50 C135 50 115 40 110 30 Z"
                  }
                  fill={tshirtColor}
                  stroke="hsl(var(--border))"
                  strokeWidth="2"
                />
                {/* Collar */}
                {activeView === "front" && (
                  <path
                    d="M110 30 C115 50 135 65 150 65 C165 65 185 50 190 30"
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth="1.5"
                  />
                )}
                {/* Print Area Guide */}
                <rect
                  x={printArea.x}
                  y={printArea.y}
                  width={printArea.width}
                  height={printArea.height}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                  opacity="0.5"
                />
              </svg>

              {/* Design Elements */}
              {currentElements.map((element) => (
                <div
                  key={element.id}
                  className={cn(
                    "absolute cursor-move select-none",
                    selectedElementId === element.id && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, element.id)}
                >
                  {element.type === "image" && element.src && (
                    <img
                      src={element.src}
                      alt="Design"
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  )}
                  {element.type === "text" && (
                    <div
                      className="w-full h-full flex items-center justify-center pointer-events-none"
                      style={{
                        fontSize: element.fontSize,
                        fontFamily: element.fontFamily,
                        color: element.color,
                        fontWeight: "bold",
                      }}
                    >
                      {element.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Tools */}
            <div className="flex gap-2 flex-wrap justify-center">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                disabled={currentElements.filter(el => el.type === "image").length >= 5}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Image ({currentElements.filter(el => el.type === "image").length}/5)
              </Button>
              <Button onClick={addTextElement} variant="outline" size="sm">
                <Type className="h-4 w-4 mr-2" />
                Add Text
              </Button>
              <Button 
                onClick={deleteSelectedElement} 
                variant="outline" 
                size="sm"
                disabled={!selectedElementId}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="design-name">Design Name</Label>
              <Input
                id="design-name"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="Enter design name..."
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-3">
              <Label>T-Shirt Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {TSHIRT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setTshirtColor(color.value)}
                    className={cn(
                      "aspect-square rounded-lg border-2 transition-all hover:scale-105",
                      tshirtColor === color.value
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-border hover:border-primary/50"
                    )}
                    title={color.name}
                  >
                    <div
                      className="h-full w-full rounded-md"
                      style={{ backgroundColor: color.value }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Element Controls */}
            {selectedElement && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Element Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedElement.type === "text" && (
                    <>
                      <div className="space-y-2">
                        <Label>Text</Label>
                        <Input
                          value={selectedElement.text || ""}
                          onChange={(e) => updateSelectedElement({ text: e.target.value })}
                          placeholder="Enter text..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Font Size: {selectedElement.fontSize}px</Label>
                        <input
                          type="range"
                          min="10"
                          max="48"
                          value={selectedElement.fontSize || 16}
                          onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label>Scale: {Math.round(selectedElement.scale * 100)}%</Label>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={selectedElement.scale * 100}
                      onChange={(e) => updateSelectedElement({ scale: parseInt(e.target.value) / 100 })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rotation: {selectedElement.rotation}°</Label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={selectedElement.rotation}
                      onChange={(e) => updateSelectedElement({ rotation: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click and drag elements to position</li>
                <li>Select an element to adjust size/rotation</li>
                <li>Design both front and back</li>
                <li>Stay within the dashed print area</li>
              </ul>
            </div>

            <Button
              onClick={handleSaveDesign}
              disabled={isSaving || !designName.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Design"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
