// NPC Relationships Hook - Manages player's relationships with NPCs

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import {
  fetchNPCRelationships,
  fetchNPCRelationship,
  createNPCRelationship,
  updateNPCRelationship,
  type CreateNPCRelationshipInput,
  type UpdateNPCRelationshipInput,
} from "@/lib/api/roleplaying";
import type { NPCRelationship, RelationshipStage } from "@/types/roleplaying";

export const useNPCRelationships = () => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: ["npc-relationships", profileId],
    queryFn: () => fetchNPCRelationships(profileId!),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useNPCRelationship = (npcType: string, npcId: string) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: ["npc-relationship", profileId, npcType, npcId],
    queryFn: () => fetchNPCRelationship(profileId!, npcType, npcId),
    enabled: !!user && !!profileId && !!npcType && !!npcId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateNPCRelationship = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: (input: Omit<CreateNPCRelationshipInput, 'profile_id'>) => {
      if (!profileId) throw new Error("No profile ID");
      return createNPCRelationship({ ...input, profile_id: profileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["npc-relationships", profileId] });
    },
  });
};

export const useUpdateNPCRelationship = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: ({
      relationshipId,
      updates,
    }: {
      relationshipId: string;
      updates: UpdateNPCRelationshipInput;
    }) => {
      return updateNPCRelationship(relationshipId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["npc-relationships", profileId] });
    },
  });
};

/**
 * Get or create an NPC relationship
 */
export const useGetOrCreateRelationship = () => {
  const createRelationship = useCreateNPCRelationship();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  const getOrCreate = async (
    npcType: string,
    npcId: string,
    npcName: string,
    initialValues?: {
      affinity?: number;
      trust?: number;
      respect?: number;
    }
  ): Promise<NPCRelationship | null> => {
    if (!profileId) return null;

    // Check if exists
    const existing = await fetchNPCRelationship(profileId, npcType, npcId);
    if (existing) return existing;

    // Create new
    return createRelationship.mutateAsync({
      npc_type: npcType,
      npc_id: npcId,
      npc_name: npcName,
      initial_affinity: initialValues?.affinity,
      initial_trust: initialValues?.trust,
      initial_respect: initialValues?.respect,
    });
  };

  return { getOrCreate, isPending: createRelationship.isPending };
};

/**
 * Get color for relationship stage
 */
export const getRelationshipStageColor = (stage: RelationshipStage): string => {
  switch (stage) {
    case 'friend':
      return 'text-green-500';
    case 'ally':
      return 'text-green-400';
    case 'contact':
      return 'text-blue-400';
    case 'acquaintance':
      return 'text-muted-foreground';
    case 'stranger':
      return 'text-muted-foreground/70';
    case 'rival':
      return 'text-orange-500';
    case 'enemy':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
};

/**
 * Get icon for relationship stage
 */
export const getRelationshipStageIcon = (stage: RelationshipStage): string => {
  switch (stage) {
    case 'friend':
      return 'heart';
    case 'ally':
      return 'handshake';
    case 'contact':
      return 'user-check';
    case 'acquaintance':
      return 'user';
    case 'stranger':
      return 'user-x';
    case 'rival':
      return 'swords';
    case 'enemy':
      return 'skull';
    default:
      return 'user';
  }
};

/**
 * Get label for relationship stage
 */
export const getRelationshipStageLabel = (stage: RelationshipStage): string => {
  switch (stage) {
    case 'friend':
      return 'Friend';
    case 'ally':
      return 'Ally';
    case 'contact':
      return 'Contact';
    case 'acquaintance':
      return 'Acquaintance';
    case 'stranger':
      return 'Stranger';
    case 'rival':
      return 'Rival';
    case 'enemy':
      return 'Enemy';
    default:
      return 'Unknown';
  }
};

/**
 * Get NPC type label
 */
export const getNPCTypeLabel = (npcType: string): string => {
  const labels: Record<string, string> = {
    label_exec: 'Label Executive',
    producer: 'Producer',
    promoter: 'Promoter',
    venue_owner: 'Venue Owner',
    journalist: 'Journalist',
    blogger: 'Blogger',
    manager: 'Manager',
    fellow_artist: 'Fellow Artist',
    superfan: 'Superfan',
    session_musician: 'Session Musician',
    sound_engineer: 'Sound Engineer',
  };
  return labels[npcType] ?? npcType;
};

/**
 * Group relationships by stage
 */
export const useRelationshipsByStage = () => {
  const { data: relationships = [], ...rest } = useNPCRelationships();

  const byStage = relationships.reduce<Record<RelationshipStage, NPCRelationship[]>>(
    (acc, rel) => {
      if (!acc[rel.relationship_stage]) {
        acc[rel.relationship_stage] = [];
      }
      acc[rel.relationship_stage].push(rel);
      return acc;
    },
    {
      friend: [],
      ally: [],
      contact: [],
      acquaintance: [],
      stranger: [],
      rival: [],
      enemy: [],
    }
  );

  const positiveCount = byStage.friend.length + byStage.ally.length + byStage.contact.length;
  const negativeCount = byStage.rival.length + byStage.enemy.length;

  return {
    relationships,
    byStage,
    positiveCount,
    negativeCount,
    ...rest,
  };
};
