import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut, Eye, User, Maximize2, Move3D } from "lucide-react";

interface EnhancedViewControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleAutoRotate: () => void;
  onSetView: (view: 'face' | 'upper' | 'full') => void;
  autoRotate: boolean;
}

export const EnhancedViewControls = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleAutoRotate,
  onSetView,
  autoRotate,
}: EnhancedViewControlsProps) => {
  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-between z-10">
      {/* Zoom Controls */}
      <div className="flex gap-1.5 bg-background/90 backdrop-blur-md rounded-lg p-1.5 border border-border/50 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          className="h-9 w-9 hover:bg-muted"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          className="h-9 w-9 hover:bg-muted"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px bg-border/50 my-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onResetView}
          className="h-9 w-9 hover:bg-muted"
          title="Reset View"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* View Presets */}
      <div className="flex gap-1.5 bg-background/90 backdrop-blur-md rounded-lg p-1.5 border border-border/50 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetView('face')}
          className="h-9 px-3 text-xs font-medium hover:bg-muted"
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Face
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetView('upper')}
          className="h-9 px-3 text-xs font-medium hover:bg-muted"
        >
          <User className="h-3.5 w-3.5 mr-1.5" />
          Upper
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetView('full')}
          className="h-9 px-3 text-xs font-medium hover:bg-muted"
        >
          <Move3D className="h-3.5 w-3.5 mr-1.5" />
          Full
        </Button>
      </div>

      {/* Auto Rotate Toggle */}
      <div className="bg-background/90 backdrop-blur-md rounded-lg p-1.5 border border-border/50 shadow-lg">
        <Button
          variant={autoRotate ? "default" : "ghost"}
          size="icon"
          onClick={onToggleAutoRotate}
          className={`h-9 w-9 ${autoRotate ? '' : 'hover:bg-muted'}`}
          title={autoRotate ? "Stop Rotation" : "Auto Rotate"}
        >
          <RotateCw 
            className={`h-4 w-4 ${autoRotate ? 'animate-spin' : ''}`} 
            style={{ animationDuration: '2.5s' }} 
          />
        </Button>
      </div>
    </div>
  );
};
