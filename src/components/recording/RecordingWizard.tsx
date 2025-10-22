import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudioSelector } from "./StudioSelector";
import { SongSelector } from "./SongSelector";
import { ProducerSelector } from "./ProducerSelector";
import { SessionConfigurator } from "./SessionConfigurator";
import { RecordingVersionSelector } from "./RecordingVersionSelector";
import { Music, Mic2, Settings, CheckCircle, Disc3 } from "lucide-react";
import type { RecordingProducer } from "@/hooks/useRecordingData";

interface RecordingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentCityId: string;
  bandId?: string | null;
}

export const RecordingWizard = ({ open, onOpenChange, userId, currentCityId, bandId }: RecordingWizardProps) => {
  const [activeTab, setActiveTab] = useState("studio");
  const [selectedStudio, setSelectedStudio] = useState<any>(null);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [selectedProducer, setSelectedProducer] = useState<RecordingProducer | null>(null);
  const [recordingVersion, setRecordingVersion] = useState<'standard' | 'remix' | 'acoustic' | null>(null);

  const canProceedToSong = !!selectedStudio;
  const canProceedToVersion = canProceedToSong && !!selectedSong && selectedSong.status === 'recorded';
  const canProceedToProducer = (canProceedToSong && !!selectedSong && selectedSong.status !== 'recorded') || 
                                (canProceedToVersion && !!recordingVersion);
  const canProceedToConfig = canProceedToProducer && !!selectedProducer;

  const handleStudioSelect = (studio: any) => {
    setSelectedStudio(studio);
    setActiveTab("song");
  };

  const handleSongSelect = (song: any) => {
    setSelectedSong(song);
    if (song.status === 'recorded') {
      setActiveTab("version");
    } else {
      setActiveTab("producer");
    }
  };

  const handleVersionSelect = (version: 'standard' | 'remix' | 'acoustic') => {
    setRecordingVersion(version);
    setActiveTab("producer");
  };

  const handleProducerSelect = (producer: RecordingProducer) => {
    setSelectedProducer(producer);
    setActiveTab("config");
  };

  const handleSessionComplete = () => {
    onOpenChange(false);
    // Reset state
    setSelectedStudio(null);
    setSelectedSong(null);
    setSelectedProducer(null);
    setRecordingVersion(null);
    setActiveTab("studio");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            Record a Song
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className={`grid w-full ${selectedSong?.status === 'recorded' ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="studio" className="gap-2">
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">Studio</span>
              {selectedStudio && <CheckCircle className="h-3 w-3 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="song" disabled={!canProceedToSong} className="gap-2">
              <Mic2 className="h-4 w-4" />
              <span className="hidden sm:inline">Song</span>
              {selectedSong && <CheckCircle className="h-3 w-3 text-green-500" />}
            </TabsTrigger>
            {selectedSong?.status === 'recorded' && (
              <TabsTrigger value="version" disabled={!canProceedToVersion} className="gap-2">
                <Disc3 className="h-4 w-4" />
                <span className="hidden sm:inline">Version</span>
                {recordingVersion && <CheckCircle className="h-3 w-3 text-green-500" />}
              </TabsTrigger>
            )}
            <TabsTrigger value="producer" disabled={!canProceedToProducer} className="gap-2">
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">Producer</span>
              {selectedProducer && <CheckCircle className="h-3 w-3 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="config" disabled={!canProceedToConfig} className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configure</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="studio" className="mt-0">
              <StudioSelector
                cityId={currentCityId}
                selectedStudio={selectedStudio}
                onSelect={handleStudioSelect}
              />
            </TabsContent>

            <TabsContent value="song" className="mt-0">
              <SongSelector
                userId={userId}
                selectedSong={selectedSong}
                onSelect={handleSongSelect}
              />
            </TabsContent>

            {selectedSong?.status === 'recorded' && (
              <TabsContent value="version" className="mt-0">
                <RecordingVersionSelector
                  song={selectedSong}
                  onSelectVersion={handleVersionSelect}
                  selectedVersion={recordingVersion || undefined}
                />
              </TabsContent>
            )}

            <TabsContent value="producer" className="mt-0">
              <ProducerSelector
                selectedProducer={selectedProducer}
                onSelect={handleProducerSelect}
                songGenre={selectedSong?.genre}
              />
            </TabsContent>

            <TabsContent value="config" className="mt-0">
              <SessionConfigurator
                userId={userId}
                bandId={bandId}
                studio={selectedStudio}
                song={selectedSong}
                producer={selectedProducer!}
                recordingVersion={recordingVersion || undefined}
                onComplete={handleSessionComplete}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
