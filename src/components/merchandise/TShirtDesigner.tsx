import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Path } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Save, Undo, Redo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TShirtDesignerProps {
  bandId: string;
  onSave?: (designId: string) => void;
  existingDesignId?: string;
}

export const TShirtDesigner = ({ bandId, onSave, existingDesignId }: TShirtDesignerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<"white" | "black">("white");
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
      backgroundColor: backgroundColor === "white" ? "#ffffff" : "#000000",
    });

    // Draw t-shirt outline
    drawTShirtOutline(canvas, backgroundColor);

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

  // Update background when color changes
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.backgroundColor = backgroundColor === "white" ? "#ffffff" : "#000000";
    fabricCanvas.renderAll();
    drawTShirtOutline(fabricCanvas, backgroundColor);
  }, [backgroundColor, fabricCanvas]);

  const drawTShirtOutline = (canvas: FabricCanvas, bgColor: "white" | "black") => {
    // Remove existing outline
    const existingOutline = canvas.getObjects().find((obj: any) => obj.id === "tshirt-outline");
    if (existingOutline) {
      canvas.remove(existingOutline);
    }

    // Draw t-shirt shape using SVG path
    const outlineColor = bgColor === "white" ? "#cccccc" : "#444444";
    const tshirtPath = `M 100,50 L 100,30 C 100,20 110,10 120,10 L 140,10 C 145,10 150,5 150,0 L 250,0 C 250,5 255,10 260,10 L 280,10 C 290,10 300,20 300,30 L 300,50 L 320,80 L 320,150 L 310,150 L 310,500 L 90,500 L 90,150 L 80,150 L 80,80 Z`;
    
    const path = new Path(tshirtPath, {
      fill: 'transparent',
      stroke: outlineColor,
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    (path as any).id = 'tshirt-outline';

    canvas.add(path);
    canvas.bringObjectToFront(path);
    canvas.renderAll();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;

    const currentImages = fabricCanvas.getObjects().filter((obj: any) => obj.type === 'image' && obj.id !== 'tshirt-outline').length;
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
          setImageCount(fabricCanvas.getObjects().filter((obj: any) => obj.type === 'image' && obj.id !== 'tshirt-outline').length);
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
    if (activeObject && (activeObject as any).id !== 'tshirt-outline') {
      fabricCanvas.remove(activeObject);
      setImageCount(fabricCanvas.getObjects().filter((obj: any) => obj.type === 'image' && obj.id !== 'tshirt-outline').length);
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
          background_color: backgroundColor,
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
        setBackgroundColor(data.background_color as "white" | "black");
        
        // Load the design data into canvas
        const designJson = typeof data.design_data === 'string' 
          ? JSON.parse(data.design_data) 
          : data.design_data;
        
        fabricCanvas.loadFromJSON(designJson, () => {
          fabricCanvas.renderAll();
          setImageCount(fabricCanvas.getObjects().filter((obj: any) => obj.type === 'image' && obj.id !== 'tshirt-outline').length);
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

            <div className="space-y-2">
              <Label>T-Shirt Color</Label>
              <RadioGroup
                value={backgroundColor}
                onValueChange={(value) => setBackgroundColor(value as "white" | "black")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="white" id="white" />
                  <Label htmlFor="white" className="cursor-pointer">White</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="black" id="black" />
                  <Label htmlFor="black" className="cursor-pointer">Black</Label>
                </div>
              </RadioGroup>
            </div>

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
