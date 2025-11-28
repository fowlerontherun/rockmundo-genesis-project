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

    // Realistic t-shirt silhouette with proper proportions
    const bodyPath = `
      M 150,40
      C 145,30 140,25 130,20
      L 110,15 C 105,13 100,10 95,5
      L 90,0 L 75,0
      C 70,15 65,25 60,35
      L 55,45 C 50,55 48,65 48,75
      L 48,120
      L 55,120 L 60,420
      C 60,435 65,445 75,450
      L 325,450 C 335,445 340,435 340,420
      L 345,120 L 352,120
      L 352,75 C 352,65 350,55 345,45
      L 340,35 C 335,25 330,15 325,0
      L 310,0 L 305,5
      C 300,10 295,13 290,15
      L 270,20 C 260,25 255,30 250,40
      Z
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
