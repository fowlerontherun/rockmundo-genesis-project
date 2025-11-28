import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Path } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TShirtColorPicker } from "./TShirtColorPicker";

interface TShirtDesignerProps {
  bandId: string;
  onSave?: (designId: string) => void;
  existingDesignId?: string;
}

export const TShirtDesigner = ({ bandId, onSave, existingDesignId }: TShirtDesignerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [tshirtColor, setTshirtColor] = useState<string>("#ffffff");
  const [designName, setDesignName] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 400,
      height: 500,
      backgroundColor: "#f5f5f5",
    });

    // Draw t-shirt with initial color
    drawTShirt(canvas, tshirtColor);

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Load existing design if provided
  useEffect(() => {
    if (!fabricCanvas || !existingDesignId) return;
    loadDesign(existingDesignId);
  }, [fabricCanvas, existingDesignId]);

  // Update t-shirt color when changed
  useEffect(() => {
    if (!fabricCanvas) return;
    drawTShirt(fabricCanvas, tshirtColor);
  }, [tshirtColor, fabricCanvas]);

  const drawTShirt = (canvas: FabricCanvas, color: string) => {
    // Remove existing t-shirt shapes
    const existingShapes = canvas.getObjects().filter((obj: any) => 
      obj.id === "tshirt-body" || obj.id === "tshirt-shadow"
    );
    existingShapes.forEach(shape => canvas.remove(shape));

    // Enhanced t-shirt silhouette with better proportions
    const bodyPath = `
      M 100,80 
      L 100,50 C 100,35 105,25 115,20 
      L 135,15 C 140,12 145,8 148,0 
      L 252,0 C 255,8 260,12 265,15 
      L 285,20 C 295,25 300,35 300,50 
      L 300,80 
      L 320,95 L 320,140 
      L 305,140 L 305,480 C 305,490 300,495 290,495 
      L 110,495 C 100,495 95,490 95,480 
L 95,140 L 80,140 L 80,95 Z
    `;

    // Shadow/depth effect
    const shadow = new Path(bodyPath, {
      fill: 'rgba(0, 0, 0, 0.1)',
      stroke: '',
      selectable: false,
      evented: false,
      left: 2,
      top: 2,
    });
    (shadow as any).id = 'tshirt-shadow';
    canvas.add(shadow);

    // Main t-shirt body with selected color
    const body = new Path(bodyPath, {
      fill: color,
      stroke: '#00000020',
      strokeWidth: 1,
      selectable: false,
      evented: false,
    });
    (body as any).id = 'tshirt-body';
    canvas.add(body);

    // Move t-shirt to back but keep above shadow
    canvas.sendObjectToBack(body);
    canvas.sendObjectToBack(shadow);
    canvas.renderAll();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;

    const currentImages = fabricCanvas.getObjects().filter((obj: any) => 
      obj.type === 'image' && obj.id !== 'tshirt-body' && obj.id !== 'tshirt-shadow'
    ).length;
    const remainingSlots = 10 - currentImages;

    if (files.length > remainingSlots) {
      toast({
        title: "Too many images",
        description: `You can only add ${remainingSlots} more image(s). Maximum is 10 images per design.`,
        variant: "destructive",
      });
      return;
    }

    Array.from(files).forEach((file, index) => {
      if (index >= remainingSlots) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const imgUrl = event.target?.result as string;
        FabricImage.fromURL(imgUrl).then((img) => {
          img.scaleToWidth(100);
          img.set({
            left: 150 + (index * 20),
            top: 150 + (index * 20),
          });
          fabricCanvas.add(img);
          setImageCount(fabricCanvas.getObjects().filter((obj: any) => 
            obj.type === 'image' && obj.id !== 'tshirt-body' && obj.id !== 'tshirt-shadow'
          ).length);
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    const disallowedIds = ['tshirt-body', 'tshirt-shadow'];
    if (activeObject && !disallowedIds.includes((activeObject as any).id)) {
      fabricCanvas.remove(activeObject);
      setImageCount(fabricCanvas.getObjects().filter((obj: any) => 
        obj.type === 'image' && !disallowedIds.includes((obj as any).id)
      ).length);
      toast({
        title: "Image removed",
        description: "Selected image has been deleted from the design.",
      });
    }
  };

  const handleSaveDesign = async () => {
    if (!fabricCanvas || !designName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a design name before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Get canvas as JSON
      const designData = fabricCanvas.toJSON();
      
      // Get canvas as data URL for preview
      const previewDataUrl = fabricCanvas.toDataURL({
        multiplier: 1,
        format: 'png',
        quality: 0.8,
      });

      // Save to database
      const { data, error } = await supabase
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

  const loadDesign = async (designId: string) => {
    if (!fabricCanvas) return;

    try {
      const { data, error } = await supabase
        .from('tshirt_designs')
        .select('*')
        .eq('id', designId)
        .single();

      if (error) throw error;

      if (data) {
        setDesignName(data.design_name);
        setTshirtColor(data.background_color || "#ffffff");
        
        // Load the design data into canvas
        const designJson = typeof data.design_data === 'string' 
          ? JSON.parse(data.design_data) 
          : data.design_data;
        
        fabricCanvas.loadFromJSON(designJson, () => {
          fabricCanvas.renderAll();
          const disallowedIds = ['tshirt-body', 'tshirt-shadow'];
          setImageCount(fabricCanvas.getObjects().filter((obj: any) => 
            obj.type === 'image' && !disallowedIds.includes((obj as any).id)
          ).length);
        });
      }
    } catch (error: any) {
      toast({
        title: "Load failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom T-Shirt Designer</CardTitle>
        <CardDescription>
          Design your custom t-shirt by uploading and positioning images. Custom designs get a 1% sales boost!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Canvas */}
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden bg-muted/20">
              <canvas ref={canvasRef} />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={imageCount >= 10}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Images ({imageCount}/10)
              </Button>
              <Button onClick={handleDeleteSelected} variant="outline">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>

          {/* Controls */}
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

            <TShirtColorPicker
              selectedColor={tshirtColor}
              onColorChange={setTshirtColor}
            />

            <div className="space-y-2">
              <Label>Instructions</Label>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Upload up to 10 images</li>
                <li>Click and drag images to reposition</li>
                <li>Use corner handles to resize</li>
                <li>Rotate by dragging the rotation handle</li>
                <li>Click an image and use Delete button to remove</li>
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
