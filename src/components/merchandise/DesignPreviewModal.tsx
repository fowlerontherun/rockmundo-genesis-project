import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shirt, Edit, Package, Calendar } from "lucide-react";
import { format } from "date-fns";

interface DesignPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: {
    id: string;
    design_name: string;
    preview_image_url?: string | null;
    back_preview_url?: string | null;
    background_color?: string;
    created_at: string;
  } | null;
  onEdit?: (designId: string) => void;
  onCreateStock?: (designId: string, designName: string) => void;
}

export const DesignPreviewModal = ({
  open,
  onOpenChange,
  design,
  onEdit,
  onCreateStock,
}: DesignPreviewModalProps) => {
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');

  if (!design) return null;

  const frontImage = design.preview_image_url;
  const backImage = design.back_preview_url;
  const hasBackDesign = !!backImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5" />
            {design.design_name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {design.background_color || 'Custom'}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created {format(new Date(design.created_at), 'MMM d, yyyy')}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Design Preview */}
        <div className="space-y-4">
          {hasBackDesign && (
            <Tabs value={viewSide} onValueChange={(v) => setViewSide(v as 'front' | 'back')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="front">Front</TabsTrigger>
                <TabsTrigger value="back">Back</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {viewSide === 'front' && frontImage ? (
              <img 
                src={frontImage} 
                alt={`${design.design_name} - Front`}
                className="w-full h-full object-contain"
              />
            ) : viewSide === 'back' && backImage ? (
              <img 
                src={backImage} 
                alt={`${design.design_name} - Back`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Shirt className="h-16 w-16 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No preview available</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {onEdit && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  onEdit(design.id);
                  onOpenChange(false);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Design
              </Button>
            )}
            {onCreateStock && (
              <Button 
                className="flex-1"
                onClick={() => {
                  onCreateStock(design.id, design.design_name);
                  onOpenChange(false);
                }}
              >
                <Package className="h-4 w-4 mr-2" />
                Create Stock
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
