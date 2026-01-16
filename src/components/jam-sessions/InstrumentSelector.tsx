import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Guitar, Mic, Piano, Drum } from "lucide-react";

// Available instruments for jam sessions
export const JAM_INSTRUMENTS = [
  // Strings
  { value: "instruments_basic_acoustic_guitar", label: "Acoustic Guitar", icon: "guitar" },
  { value: "instruments_basic_electric_guitar", label: "Electric Guitar", icon: "guitar" },
  { value: "instruments_basic_classical_guitar", label: "Classical Guitar", icon: "guitar" },
  { value: "instruments_basic_bass_guitar", label: "Bass Guitar", icon: "bass" },
  { value: "instruments_basic_violin", label: "Violin", icon: "strings" },
  { value: "instruments_basic_cello", label: "Cello", icon: "strings" },
  { value: "instruments_basic_ukulele", label: "Ukulele", icon: "strings" },
  { value: "instruments_basic_banjo", label: "Banjo", icon: "strings" },
  // Keys
  { value: "instruments_basic_keyboard", label: "Keyboard", icon: "keys" },
  { value: "instruments_basic_piano", label: "Piano", icon: "keys" },
  { value: "instruments_basic_synthesizer", label: "Synthesizer", icon: "keys" },
  { value: "instruments_basic_organ", label: "Organ", icon: "keys" },
  // Drums & Percussion
  { value: "instruments_basic_drums", label: "Drums", icon: "drums" },
  { value: "instruments_basic_percussion", label: "Percussion", icon: "drums" },
  { value: "instruments_basic_cajon", label: "Cajon", icon: "drums" },
  { value: "instruments_basic_congas", label: "Congas", icon: "drums" },
  // Vocals
  { value: "instruments_basic_vocals", label: "Lead Vocals", icon: "vocals" },
  { value: "instruments_basic_backup_vocals", label: "Backup Vocals", icon: "vocals" },
  // Winds
  { value: "instruments_basic_saxophone", label: "Saxophone", icon: "winds" },
  { value: "instruments_basic_trumpet", label: "Trumpet", icon: "winds" },
  { value: "instruments_basic_trombone", label: "Trombone", icon: "winds" },
  { value: "instruments_basic_clarinet", label: "Clarinet", icon: "winds" },
  { value: "instruments_basic_flute", label: "Flute", icon: "winds" },
  // DJ
  { value: "instruments_basic_turntables", label: "DJ / Turntables", icon: "dj" },
];

interface InstrumentSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const getIconForType = (iconType: string) => {
  switch (iconType) {
    case "guitar":
    case "bass":
    case "strings":
      return <Guitar className="h-4 w-4" />;
    case "vocals":
      return <Mic className="h-4 w-4" />;
    case "keys":
      return <Piano className="h-4 w-4" />;
    case "drums":
      return <Drum className="h-4 w-4" />;
    default:
      return <Guitar className="h-4 w-4" />;
  }
};

export const InstrumentSelector = ({ value, onChange, disabled }: InstrumentSelectorProps) => {
  const selectedInstrument = JAM_INSTRUMENTS.find(i => i.value === value);

  return (
    <div className="space-y-2">
      <Label>Your Instrument</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select your instrument">
            {selectedInstrument && (
              <div className="flex items-center gap-2">
                {getIconForType(selectedInstrument.icon)}
                <span>{selectedInstrument.label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {JAM_INSTRUMENTS.map((instrument) => (
            <SelectItem key={instrument.value} value={instrument.value}>
              <div className="flex items-center gap-2">
                {getIconForType(instrument.icon)}
                <span>{instrument.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
