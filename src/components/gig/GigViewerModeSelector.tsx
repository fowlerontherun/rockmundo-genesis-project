import { Button } from "@/components/ui/button";
import { Tv, FileText } from "lucide-react";

interface GigViewerModeSelectorProps {
  mode: '3d' | 'text';
  onModeChange: (mode: '3d' | 'text') => void;
  disabled?: boolean;
}

export const GigViewerModeSelector = ({ mode, onModeChange, disabled }: GigViewerModeSelectorProps) => {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
      <Button
        variant={mode === '3d' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('3d')}
        disabled={disabled}
        className="gap-2"
      >
        <Tv className="h-4 w-4" />
        <span className="hidden sm:inline">3D View</span>
      </Button>
      <Button
        variant={mode === 'text' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('text')}
        disabled={disabled}
        className="gap-2"
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Commentary</span>
      </Button>
    </div>
  );
};