import { useState } from "react";
import { useRecordingProducers } from "@/hooks/useRecordingData";
import { ProducerCard } from "./ProducerCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music } from "lucide-react";
import type { RecordingProducer } from "@/hooks/useRecordingData";

interface ProducerSelectorProps {
  selectedProducer: RecordingProducer | null;
  onSelect: (producer: RecordingProducer) => void;
  songGenre?: string;
}

export const ProducerSelector = ({ selectedProducer, onSelect, songGenre }: ProducerSelectorProps) => {
  const [tierFilter, setTierFilter] = useState<string>("");
  const [genreFilter, setGenreFilter] = useState<string>("");

  const { data: producers, isLoading } = useRecordingProducers(genreFilter, tierFilter);

  // Self-produce option
  const selfProduceOption: RecordingProducer = {
    id: 'self-produce',
    name: 'Self-Produce',
    tier: 'budget',
    specialty_genre: 'All',
    cost_per_hour: 0,
    quality_bonus: -10,
    mixing_skill: 0,
    arrangement_skill: 0,
    bio: 'Record on your own without a professional producer. Lower quality but free.',
    past_works: ['Independent recordings', 'DIY sessions']
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading producers...</div>;
  }

  const allProducers = [selfProduceOption, ...(producers || [])];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Tiers</SelectItem>
            <SelectItem value="budget">Budget</SelectItem>
            <SelectItem value="mid">Mid-Tier</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="legendary">Legendary</SelectItem>
          </SelectContent>
        </Select>

        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Genres</SelectItem>
            <SelectItem value="Rock">Rock</SelectItem>
            <SelectItem value="Pop">Pop</SelectItem>
            <SelectItem value="Hip-Hop">Hip-Hop</SelectItem>
            <SelectItem value="Jazz">Jazz</SelectItem>
            <SelectItem value="Electronic">Electronic</SelectItem>
            <SelectItem value="R&B">R&B</SelectItem>
            <SelectItem value="Country">Country</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground flex items-center ml-auto">
          {allProducers.length} option{allProducers.length !== 1 ? 's' : ''} available
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
        {allProducers.map((producer) => (
          <ProducerCard
            key={producer.id}
            producer={producer}
            onSelect={onSelect}
            isSelected={selectedProducer?.id === producer.id}
          />
        ))}
      </div>
    </div>
  );
};
