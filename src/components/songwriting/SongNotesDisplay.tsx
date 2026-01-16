import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Music2, Palette, Users, Lightbulb } from "lucide-react";

interface CoWriter {
  id: string;
  name: string;
  role?: string | null;
  familiarity?: string | null;
  split?: number;
}

interface CreativeBrief {
  genre?: string;
  writing_mode?: string;
  co_writers?: CoWriter[];
  producers?: string[];
  session_musicians?: string[];
  inspiration_modifiers?: string[];
  mood_modifiers?: string[];
}

interface SongTheme {
  name?: string;
  mood?: string;
  description?: string;
}

interface ChordProgression {
  name?: string;
  progression?: string;
}

interface SongNotesDisplayProps {
  genre?: string;
  theme?: SongTheme | null;
  chordProgression?: ChordProgression | null;
  creativeBrief?: CreativeBrief | null;
  additionalNotes: string;
  onAdditionalNotesChange: (notes: string) => void;
  disabled?: boolean;
}

export const SongNotesDisplay = ({
  genre,
  theme,
  chordProgression,
  creativeBrief,
  additionalNotes,
  onAdditionalNotesChange,
  disabled = false
}: SongNotesDisplayProps) => {
  // Auto-generated notes from collected data
  const autoNotes = useMemo(() => {
    const parts: { icon: React.ReactNode; label: string; value: string }[] = [];
    
    if (genre) {
      parts.push({ 
        icon: <Music2 className="h-3.5 w-3.5" />, 
        label: 'Genre', 
        value: genre 
      });
    }
    
    if (theme?.name) {
      parts.push({ 
        icon: <Lightbulb className="h-3.5 w-3.5" />, 
        label: 'Theme', 
        value: `${theme.name}${theme.mood ? ` (${theme.mood})` : ''}` 
      });
    }
    
    if (chordProgression?.name || chordProgression?.progression) {
      parts.push({ 
        icon: <Music2 className="h-3.5 w-3.5" />, 
        label: 'Chords', 
        value: chordProgression.name 
          ? `${chordProgression.name}${chordProgression.progression ? ` - ${chordProgression.progression}` : ''}`
          : chordProgression.progression || ''
      });
    }
    
    if (creativeBrief?.mood_modifiers?.length) {
      parts.push({ 
        icon: <Palette className="h-3.5 w-3.5" />, 
        label: 'Mood', 
        value: creativeBrief.mood_modifiers.join(', ') 
      });
    }
    
    if (creativeBrief?.inspiration_modifiers?.length) {
      parts.push({ 
        icon: <Lightbulb className="h-3.5 w-3.5" />, 
        label: 'Inspiration', 
        value: creativeBrief.inspiration_modifiers.join(', ') 
      });
    }
    
    if (creativeBrief?.co_writers?.length) {
      const coWriterNames = creativeBrief.co_writers.map(w => w.name).join(', ');
      parts.push({ 
        icon: <Users className="h-3.5 w-3.5" />, 
        label: 'Co-Writers', 
        value: coWriterNames 
      });
    }
    
    if (creativeBrief?.session_musicians?.length) {
      parts.push({ 
        icon: <Users className="h-3.5 w-3.5" />, 
        label: 'Musicians', 
        value: creativeBrief.session_musicians.join(', ') 
      });
    }
    
    if (creativeBrief?.writing_mode) {
      const modeLabels: Record<string, string> = {
        'solo': 'Solo Writing',
        'topline': 'Top-line Session',
        'track-led': 'Track-led Production',
        'camp': 'Writing Camp'
      };
      parts.push({ 
        icon: <FileText className="h-3.5 w-3.5" />, 
        label: 'Mode', 
        value: modeLabels[creativeBrief.writing_mode] || creativeBrief.writing_mode 
      });
    }
    
    return parts;
  }, [genre, theme, chordProgression, creativeBrief]);

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        📝 Song Notes
      </Label>
      
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        {autoNotes.length > 0 ? (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Auto-populated from your choices
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {autoNotes.map((note, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">{note.icon}</span>
                  <div>
                    <span className="font-medium">{note.label}:</span>{' '}
                    <span className="text-muted-foreground">{note.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Select genre, theme, and creative options to auto-populate song notes.
          </p>
        )}
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label htmlFor="additional-notes" className="text-sm">
          Additional Notes
        </Label>
        <Textarea
          id="additional-notes"
          value={additionalNotes}
          onChange={(e) => onAdditionalNotesChange(e.target.value)}
          placeholder="Add production ideas, lyrical themes, reference tracks, or any other notes for this song..."
          className="min-h-20"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          These notes will be used to guide AI lyrics generation and help you remember your creative vision.
        </p>
      </div>
    </div>
  );
};

// Helper function to generate song notes text for AI prompt
export function generateSongNotesForAI(
  genre?: string,
  theme?: SongTheme | null,
  chordProgression?: ChordProgression | null,
  creativeBrief?: CreativeBrief | null,
  additionalNotes?: string
): string {
  const parts: string[] = [];
  
  if (genre) parts.push(`Genre: ${genre}`);
  if (theme?.name) parts.push(`Theme: ${theme.name}${theme.mood ? ` - ${theme.mood}` : ''}`);
  if (theme?.description) parts.push(`Theme Description: ${theme.description}`);
  if (chordProgression?.name) parts.push(`Chord Progression: ${chordProgression.name}`);
  if (chordProgression?.progression) parts.push(`Chords: ${chordProgression.progression}`);
  if (creativeBrief?.mood_modifiers?.length) parts.push(`Mood: ${creativeBrief.mood_modifiers.join(', ')}`);
  if (creativeBrief?.inspiration_modifiers?.length) parts.push(`Inspiration: ${creativeBrief.inspiration_modifiers.join(', ')}`);
  if (creativeBrief?.co_writers?.length) {
    const writers = creativeBrief.co_writers.map(w => `${w.name}${w.role ? ` (${w.role})` : ''}`).join(', ');
    parts.push(`Collaborators: ${writers}`);
  }
  if (creativeBrief?.session_musicians?.length) parts.push(`Session Musicians: ${creativeBrief.session_musicians.join(', ')}`);
  if (additionalNotes?.trim()) parts.push(`\nAdditional Notes:\n${additionalNotes.trim()}`);
  
  return parts.join('\n');
}
