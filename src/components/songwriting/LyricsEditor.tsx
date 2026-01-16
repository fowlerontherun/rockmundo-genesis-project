import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronUp, ChevronDown, Trash2, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LyricsSection {
  id: string;
  type: string;
  label: string;
  content: string;
}

interface LyricsEditorProps {
  sections: LyricsSection[];
  onChange: (sections: LyricsSection[]) => void;
  disabled?: boolean;
}

const SECTION_TYPES = [
  { id: 'intro', label: 'Intro', typicalLines: '2-4 lines' },
  { id: 'verse', label: 'Verse', typicalLines: '6-8 lines' },
  { id: 'prechorus', label: 'Pre-Chorus', typicalLines: '2-4 lines' },
  { id: 'chorus', label: 'Chorus', typicalLines: '4-6 lines' },
  { id: 'bridge', label: 'Bridge', typicalLines: '4 lines' },
  { id: 'hook', label: 'Hook', typicalLines: '2-4 lines' },
  { id: 'outro', label: 'Outro', typicalLines: '2-4 lines' },
  { id: 'breakdown', label: 'Breakdown', typicalLines: '4 lines' },
  { id: 'instrumental', label: 'Instrumental', typicalLines: 'describe mood' },
];

const DEFAULT_SECTIONS: LyricsSection[] = [
  { id: 'verse1', type: 'verse', label: 'Verse 1', content: '' },
  { id: 'chorus1', type: 'chorus', label: 'Chorus', content: '' },
  { id: 'verse2', type: 'verse', label: 'Verse 2', content: '' },
];

// Parse existing lyrics text into structured sections
export function parseLyricsToSections(lyrics: string): LyricsSection[] {
  if (!lyrics || !lyrics.trim()) {
    return [...DEFAULT_SECTIONS];
  }

  const sections: LyricsSection[] = [];
  const sectionRegex = /\[(.*?)\]/g;
  let lastIndex = 0;
  let match;
  let sectionCounter: Record<string, number> = {};

  while ((match = sectionRegex.exec(lyrics)) !== null) {
    // Get content before this section (if any, skip it)
    const sectionHeader = match[1].toLowerCase().trim();
    const startOfContent = match.index + match[0].length;
    
    // Find the next section header or end of string
    const nextMatch = sectionRegex.exec(lyrics);
    const endOfContent = nextMatch ? nextMatch.index : lyrics.length;
    sectionRegex.lastIndex = startOfContent; // Reset to continue from here
    
    const content = lyrics.substring(startOfContent, endOfContent).trim();
    
    // Determine section type
    let type = 'verse';
    let label = match[1].trim();
    
    if (sectionHeader.includes('verse')) {
      type = 'verse';
    } else if (sectionHeader.includes('chorus')) {
      type = 'chorus';
    } else if (sectionHeader.includes('pre-chorus') || sectionHeader.includes('prechorus')) {
      type = 'prechorus';
    } else if (sectionHeader.includes('bridge')) {
      type = 'bridge';
    } else if (sectionHeader.includes('intro')) {
      type = 'intro';
    } else if (sectionHeader.includes('outro')) {
      type = 'outro';
    } else if (sectionHeader.includes('hook')) {
      type = 'hook';
    } else if (sectionHeader.includes('breakdown')) {
      type = 'breakdown';
    } else if (sectionHeader.includes('instrumental')) {
      type = 'instrumental';
    }
    
    // Generate unique ID
    sectionCounter[type] = (sectionCounter[type] || 0) + 1;
    const id = `${type}${sectionCounter[type]}`;
    
    sections.push({ id, type, label, content });
    lastIndex = endOfContent;
  }

  // If no sections found, try to create default structure
  if (sections.length === 0 && lyrics.trim()) {
    // Put all lyrics in first verse
    return [
      { id: 'verse1', type: 'verse', label: 'Verse 1', content: lyrics.trim() },
      { id: 'chorus1', type: 'chorus', label: 'Chorus', content: '' },
      { id: 'verse2', type: 'verse', label: 'Verse 2', content: '' },
    ];
  }

  return sections.length > 0 ? sections : [...DEFAULT_SECTIONS];
}

// Convert structured sections back to lyrics text
export function sectionsToLyrics(sections: LyricsSection[]): string {
  return sections
    .map(section => `[${section.label}]\n${section.content}`)
    .join('\n\n');
}

export const LyricsEditor = ({ sections, onChange, disabled = false }: LyricsEditorProps) => {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || 'verse1');
  const [showFullView, setShowFullView] = useState(false);

  const activeSectionData = useMemo(() => 
    sections.find(s => s.id === activeSection) || sections[0],
    [sections, activeSection]
  );

  const handleSectionChange = (sectionId: string, content: string) => {
    const updated = sections.map(s => 
      s.id === sectionId ? { ...s, content } : s
    );
    onChange(updated);
  };

  const addSection = (type: string) => {
    const typeInfo = SECTION_TYPES.find(t => t.id === type);
    if (!typeInfo) return;

    // Count existing sections of this type
    const count = sections.filter(s => s.type === type).length + 1;
    const label = count > 1 ? `${typeInfo.label} ${count}` : typeInfo.label;
    const id = `${type}${count}_${Date.now()}`;

    const newSection: LyricsSection = {
      id,
      type,
      label,
      content: ''
    };

    onChange([...sections, newSection]);
    setActiveSection(id);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) return; // Keep at least one section
    
    const updated = sections.filter(s => s.id !== sectionId);
    onChange(updated);
    
    if (activeSection === sectionId) {
      setActiveSection(updated[0]?.id || '');
    }
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === sectionId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    
    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const totalWords = useMemo(() => {
    const allContent = sections.map(s => s.content).join(' ');
    return allContent.trim() ? allContent.trim().split(/\s+/).length : 0;
  }, [sections]);

  if (showFullView) {
    // Full lyrics view mode
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            🎵 Full Lyrics View
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFullView(false)}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Section View
          </Button>
        </div>
        <div className="rounded-md border bg-muted/30 p-4 space-y-4 max-h-96 overflow-y-auto">
          {sections.map(section => (
            <div key={section.id}>
              <Badge variant="outline" className="mb-2">{section.label}</Badge>
              <p className="whitespace-pre-wrap text-sm">
                {section.content || <span className="text-muted-foreground italic">No content yet</span>}
              </p>
            </div>
          ))}
        </div>
        <p className="text-right text-xs text-muted-foreground">{totalWords} words total</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          🎵 Lyrics
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFullView(true)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Full View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={disabled}>
                <Plus className="h-4 w-4 mr-1" />
                Add Section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SECTION_TYPES.map(type => (
                <DropdownMenuItem 
                  key={type.id} 
                  onClick={() => addSection(type.id)}
                >
                  <span>{type.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({type.typicalLines})</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="flex-wrap h-auto gap-1">
          {sections.map((section, index) => (
            <TabsTrigger 
              key={section.id} 
              value={section.id}
              className="text-xs px-2 py-1"
            >
              {section.label}
              {section.content && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({section.content.split(/\s+/).filter(Boolean).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map(section => (
          <TabsContent key={section.id} value={section.id} className="mt-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{section.label}</Badge>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={disabled || sections.indexOf(section) === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={disabled || sections.indexOf(section) === sections.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeSection(section.id)}
                    disabled={disabled || sections.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={section.content}
                onChange={(e) => handleSectionChange(section.id, e.target.value)}
                placeholder={`Write your ${section.label.toLowerCase()} lyrics here...`}
                className="min-h-32 font-mono text-sm"
                disabled={disabled}
              />
              <p className="text-right text-xs text-muted-foreground">
                {section.content.trim() ? section.content.trim().split(/\s+/).length : 0} words
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        {totalWords} words total across {sections.length} sections
      </p>
    </div>
  );
};
