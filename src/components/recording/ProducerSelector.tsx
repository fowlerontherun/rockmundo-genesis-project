import { useState } from "react";
import { useRecordingProducers } from "@/hooks/useRecordingData";
import { useAvailablePlayerProducers } from "@/hooks/useProducerCareer";
import { ProducerCard } from "./ProducerCard";
import { PlayerProducerCard } from "./PlayerProducerCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Music, User, Users } from "lucide-react";
import type { RecordingProducer } from "@/hooks/useRecordingData";
import { MUSIC_GENRES } from "@/data/genres";

interface ProducerSelectorProps {
  selectedProducer: RecordingProducer | null;
  onSelect: (producer: RecordingProducer) => void;
  songGenre?: string;
  studioCityId?: string;
}

export const ProducerSelector = ({ selectedProducer, onSelect, songGenre, studioCityId }: ProducerSelectorProps) => {
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [producerType, setProducerType] = useState<string>("all");

  const { data: npcProducers, isLoading: npcLoading } = useRecordingProducers(
    genreFilter === "all" ? undefined : genreFilter,
    tierFilter === "all" ? undefined : tierFilter
  );

  const { data: playerProducers, isLoading: playerLoading } = useAvailablePlayerProducers(
    studioCityId,
    genreFilter === "all" ? undefined : genreFilter
  );

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

  const isLoading = npcLoading || playerLoading;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading producers...</div>;
  }

  // Map player producers to RecordingProducer interface
  const mappedPlayerProducers: (RecordingProducer & { _playerData?: any })[] = (playerProducers || []).map(pp => ({
    id: `player-${pp.id}`,
    name: pp.display_name,
    tier: 'mid' as const,
    specialty_genre: pp.specialty_genre,
    cost_per_hour: pp.cost_per_hour,
    quality_bonus: pp.quality_bonus,
    mixing_skill: pp.mixing_skill,
    arrangement_skill: pp.arrangement_skill,
    bio: pp.bio,
    past_works: [`${pp.total_sessions} sessions`, `Rating: ${Number(pp.rating).toFixed(1)}`],
    _playerData: pp,
  }));

  const showNpc = producerType === 'all' || producerType === 'npc';
  const showPlayer = producerType === 'all' || producerType === 'player';

  const allProducers: any[] = [selfProduceOption];
  if (showNpc) allProducers.push(...(npcProducers || []));
  if (showPlayer) allProducers.push(...mappedPlayerProducers);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <ToggleGroup type="single" value={producerType} onValueChange={(v) => v && setProducerType(v)} className="border rounded-lg">
          <ToggleGroupItem value="all" size="sm"><Users className="h-4 w-4 mr-1" /> All</ToggleGroupItem>
          <ToggleGroupItem value="npc" size="sm"><Music className="h-4 w-4 mr-1" /> NPC</ToggleGroupItem>
          <ToggleGroupItem value="player" size="sm"><User className="h-4 w-4 mr-1" /> Players</ToggleGroupItem>
        </ToggleGroup>

        {showNpc && (
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="budget">Budget</SelectItem>
              <SelectItem value="mid">Mid-Tier</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="legendary">Legendary</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Genres</SelectItem>
            {MUSIC_GENRES.map((genre) => (
              <SelectItem key={genre} value={genre}>{genre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground flex items-center ml-auto">
          {allProducers.length} option{allProducers.length !== 1 ? 's' : ''} available
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
        {allProducers.map((producer) => {
          const isPlayer = producer._playerData != null;
          if (isPlayer) {
            return (
              <PlayerProducerCard
                key={producer.id}
                producer={producer}
                playerName={producer._playerData?.profiles?.display_name}
                playerLevel={producer._playerData?.profiles?.level}
                sessionCount={producer._playerData?.total_sessions}
                avgRating={Number(producer._playerData?.rating) || 0}
                onSelect={onSelect}
                isSelected={selectedProducer?.id === producer.id}
              />
            );
          }
          return (
            <ProducerCard
              key={producer.id}
              producer={producer}
              onSelect={onSelect}
              isSelected={selectedProducer?.id === producer.id}
            />
          );
        })}
      </div>
    </div>
  );
};
