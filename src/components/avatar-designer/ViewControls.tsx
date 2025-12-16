import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut, Eye, User, Maximize2 } from "lucide-react";

interface ViewControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleAutoRotate: () => void;
  onSetView: (view: 'face' | 'upper' | 'full') => void;
  autoRotate: boolean;
}

export const ViewControls = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleAutoRotate,
  onSetView,
  autoRotate,
}: ViewControlsProps) => {
  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-between z-10">
      {/* Zoom Controls */}
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          onClick={onZoomOut}
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={onZoomIn}
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={onResetView}
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          title="Reset View"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* View Presets */}
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSetView('face')}
          className="h-8 px-2 text-xs bg-background/80 backdrop-blur-sm"
        >
          <Eye className="h-3 w-3 mr-1" />
          Face
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSetView('upper')}
          className="h-8 px-2 text-xs bg-background/80 backdrop-blur-sm"
        >
          <User className="h-3 w-3 mr-1" />
          Upper
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSetView('full')}
          className="h-8 px-2 text-xs bg-background/80 backdrop-blur-sm"
        >
          Full
        </Button>
      </div>

      {/* Auto Rotate Toggle */}
      <Button
        variant={autoRotate ? "default" : "secondary"}
        size="icon"
        onClick={onToggleAutoRotate}
        className="h-8 w-8 bg-background/80 backdrop-blur-sm"
        title={autoRotate ? "Stop Rotation" : "Auto Rotate"}
      >
        <RotateCw className={`h-4 w-4 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
      </Button>
    </div>
  );
};