// Role-Playing API Functions

import { supabase } from "@/lib/supabase-client";
import type { Json } from "@/lib/supabase-types";
import type {
  CharacterOrigin,
  PersonalityTrait,
  PlayerCharacterIdentity,
  PlayerReputation,
  ReputationEvent,
  NPCRelationship,
  ReputationAxis,
} from "@/types/roleplaying";

// ============================================
// CHARACTER ORIGINS
// ============================================

export const fetchCharacterOrigins = async (): Promise<CharacterOrigin[]> => {
  const { data, error } = await supabase
    .from("character_origins")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as CharacterOrigin[];
};

export const fetchCharacterOriginByKey = async (key: string): Promise<CharacterOrigin | null> => {
  const { data, error } = await supabase
    .from("character_origins")
    .select("*")
    .eq("key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as CharacterOrigin;
};

// ============================================
// PERSONALITY TRAITS
// ============================================

export const fetchPersonalityTraits = async (): Promise<PersonalityTrait[]> => {
  const { data, error } = await supabase
    .from("personality_traits")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as PersonalityTrait[];
};

export const fetchTraitsByCategory = async (category: string): Promise<PersonalityTrait[]> => {
  const { data, error } = await supabase
    .from("personality_traits")
    .select("*")
    .eq("is_active", true)
    .eq("category", category)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as PersonalityTrait[];
};

// ============================================
// PLAYER CHARACTER IDENTITY
// ============================================

export const fetchPlayerCharacterIdentity = async (
  profileId: string
): Promise<PlayerCharacterIdentity | null> => {
  const { data, error } = await supabase
    .from("player_character_identity")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data as PlayerCharacterIdentity | null;
};

export const createPlayerCharacterIdentity = async (
  profileId: string
): Promise<PlayerCharacterIdentity> => {
  const { data, error } = await supabase
    .from("player_character_identity")
    .insert({ profile_id: profileId })
    .select()
    .single();

  if (error) throw error;
  return data as PlayerCharacterIdentity;
};

export interface UpdateCharacterIdentityInput {
  origin_id?: string | null;
  trait_ids?: string[];
  backstory_text?: string | null;
  backstory_generated_at?: string | null;
  musical_style?: string | null;
  career_goal?: string | null;
  starting_city_id?: string | null;
  onboarding_step?: number;
  onboarding_completed_at?: string | null;
  custom_answers?: Json;
}

export const updatePlayerCharacterIdentity = async (
  profileId: string,
  updates: UpdateCharacterIdentityInput
): Promise<PlayerCharacterIdentity> => {
  const { data, error } = await supabase
    .from("player_character_identity")
    .update(updates)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error) throw error;
  return data as PlayerCharacterIdentity;
};

export const completeOnboarding = async (
  profileId: string
): Promise<PlayerCharacterIdentity> => {
  return updatePlayerCharacterIdentity(profileId, {
    onboarding_completed_at: new Date().toISOString(),
  });
};

// ============================================
// PLAYER REPUTATION
// ============================================

export const fetchPlayerReputation = async (
  profileId: string
): Promise<PlayerReputation | null> => {
  const { data, error } = await supabase
    .from("player_reputation")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data as PlayerReputation | null;
};

export const createPlayerReputation = async (
  profileId: string,
  initialModifiers?: {
    authenticity?: number;
    attitude?: number;
    reliability?: number;
    creativity?: number;
  }
): Promise<PlayerReputation> => {
  const { data, error } = await supabase
    .from("player_reputation")
    .insert({
      profile_id: profileId,
      authenticity_score: initialModifiers?.authenticity ?? 0,
      attitude_score: initialModifiers?.attitude ?? 0,
      reliability_score: initialModifiers?.reliability ?? 0,
      creativity_score: initialModifiers?.creativity ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PlayerReputation;
};

export interface ReputationChange {
  axis: ReputationAxis;
  change: number;
  reason?: string;
}

export const updatePlayerReputation = async (
  profileId: string,
  changes: ReputationChange[],
  eventType: string,
  eventSource: string,
  sourceId?: string
): Promise<PlayerReputation> => {
  // Fetch current reputation
  const current = await fetchPlayerReputation(profileId);
  if (!current) throw new Error("Player reputation not found");

  // Calculate new values and clamp to -100 to 100
  const clamp = (val: number) => Math.max(-100, Math.min(100, val));
  
  const updates: Partial<PlayerReputation> = {
    last_updated_at: new Date().toISOString(),
  };

  const eventInserts: {
    profile_id: string;
    event_type: string;
    event_source: string;
    source_id: string | null;
    axis: string;
    change_amount: number;
    previous_value: number;
    new_value: number;
    reason: string | null;
    metadata: Json;
  }[] = [];

  for (const change of changes) {
    const currentKey = `${change.axis}_score` as keyof PlayerReputation;
    const currentValue = current[currentKey] as number;
    const newValue = clamp(currentValue + change.change);

    updates[currentKey as 'authenticity_score' | 'attitude_score' | 'reliability_score' | 'creativity_score'] = newValue;

    eventInserts.push({
      profile_id: profileId,
      event_type: eventType,
      event_source: eventSource,
      source_id: sourceId ?? null,
      axis: change.axis,
      change_amount: change.change,
      previous_value: currentValue,
      new_value: newValue,
      reason: change.reason ?? null,
      metadata: {},
    });
  }

  // Update reputation
  const { data, error } = await supabase
    .from("player_reputation")
    .update(updates)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error) throw error;

  // Log events
  if (eventInserts.length > 0) {
    const { error: eventError } = await supabase
      .from("reputation_events")
      .insert(eventInserts);
    
    if (eventError) console.error("Failed to log reputation events:", eventError);
  }

  return data as PlayerReputation;
};

// ============================================
// REPUTATION EVENTS
// ============================================

export const fetchReputationEvents = async (
  profileId: string,
  limit = 20
): Promise<ReputationEvent[]> => {
  const { data, error } = await supabase
    .from("reputation_events")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as ReputationEvent[];
};

// ============================================
// NPC RELATIONSHIPS
// ============================================

export const fetchNPCRelationships = async (
  profileId: string
): Promise<NPCRelationship[]> => {
  const { data, error } = await supabase
    .from("npc_relationships")
    .select("*")
    .eq("profile_id", profileId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data as NPCRelationship[];
};

export const fetchNPCRelationship = async (
  profileId: string,
  npcType: string,
  npcId: string
): Promise<NPCRelationship | null> => {
  const { data, error } = await supabase
    .from("npc_relationships")
    .select("*")
    .eq("profile_id", profileId)
    .eq("npc_type", npcType)
    .eq("npc_id", npcId)
    .maybeSingle();

  if (error) throw error;
  return data as NPCRelationship | null;
};

export interface CreateNPCRelationshipInput {
  profile_id: string;
  npc_type: string;
  npc_id: string;
  npc_name: string;
  initial_affinity?: number;
  initial_trust?: number;
  initial_respect?: number;
}

export const createNPCRelationship = async (
  input: CreateNPCRelationshipInput
): Promise<NPCRelationship> => {
  const { data, error } = await supabase
    .from("npc_relationships")
    .insert({
      profile_id: input.profile_id,
      npc_type: input.npc_type,
      npc_id: input.npc_id,
      npc_name: input.npc_name,
      affinity_score: input.initial_affinity ?? 0,
      trust_score: input.initial_trust ?? 0,
      respect_score: input.initial_respect ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as NPCRelationship;
};

export interface UpdateNPCRelationshipInput {
  affinity_change?: number;
  trust_change?: number;
  respect_change?: number;
  note?: string;
}

export const updateNPCRelationship = async (
  relationshipId: string,
  updates: UpdateNPCRelationshipInput
): Promise<NPCRelationship> => {
  // Fetch current relationship
  const { data: current, error: fetchError } = await supabase
    .from("npc_relationships")
    .select("*")
    .eq("id", relationshipId)
    .single();

  if (fetchError) throw fetchError;

  const clamp = (val: number) => Math.max(-100, Math.min(100, val));

  const newAffinity = clamp(current.affinity_score + (updates.affinity_change ?? 0));
  const newTrust = clamp(current.trust_score + (updates.trust_change ?? 0));
  const newRespect = clamp(current.respect_score + (updates.respect_change ?? 0));

  // Determine relationship stage based on affinity
  const determineStage = (affinity: number): string => {
    if (affinity <= -50) return 'enemy';
    if (affinity <= -20) return 'rival';
    if (affinity < 10) return 'stranger';
    if (affinity < 30) return 'acquaintance';
    if (affinity < 50) return 'contact';
    if (affinity < 75) return 'ally';
    return 'friend';
  };

  const notesArray = Array.isArray(current.notes) ? [...current.notes] : [];
  if (updates.note) {
    notesArray.push({ date: new Date().toISOString(), note: updates.note });
  }

  const { data, error } = await supabase
    .from("npc_relationships")
    .update({
      affinity_score: newAffinity,
      trust_score: newTrust,
      respect_score: newRespect,
      relationship_stage: determineStage(newAffinity),
      interaction_count: current.interaction_count + 1,
      last_interaction_at: new Date().toISOString(),
      notes: notesArray as Json,
    })
    .eq("id", relationshipId)
    .select()
    .single();

  if (error) throw error;
  return data as NPCRelationship;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Initialize a new player's RP data (identity + reputation)
 */
export const initializePlayerRPData = async (
  profileId: string
): Promise<{ identity: PlayerCharacterIdentity; reputation: PlayerReputation }> => {
  const identity = await createPlayerCharacterIdentity(profileId);
  const reputation = await createPlayerReputation(profileId);
  return { identity, reputation };
};

/**
 * Check if player has completed onboarding
 */
export const hasCompletedOnboarding = async (profileId: string): Promise<boolean> => {
  const identity = await fetchPlayerCharacterIdentity(profileId);
  return identity?.onboarding_completed_at != null;
};

/**
 * Get combined gameplay effects from selected traits
 */
export const getCombinedTraitEffects = (
  traits: PersonalityTrait[]
): Record<string, number> => {
  const combined: Record<string, number> = {};
  
  for (const trait of traits) {
    for (const [key, value] of Object.entries(trait.gameplay_effects)) {
      if (typeof value === 'number') {
        combined[key] = (combined[key] ?? 0) + value;
      }
    }
  }
  
  return combined;
};

/**
 * Get combined reputation tendencies from origin and traits
 */
export const getCombinedReputationModifiers = (
  origin: CharacterOrigin | null,
  traits: PersonalityTrait[]
): { authenticity: number; attitude: number; reliability: number; creativity: number } => {
  let authenticity = origin?.reputation_modifiers?.authenticity ?? 0;
  let attitude = origin?.reputation_modifiers?.attitude ?? 0;
  let reliability = origin?.reputation_modifiers?.reliability ?? 0;
  let creativity = origin?.reputation_modifiers?.creativity ?? 0;

  for (const trait of traits) {
    authenticity += trait.reputation_tendencies?.authenticity ?? 0;
    attitude += trait.reputation_tendencies?.attitude ?? 0;
    reliability += trait.reputation_tendencies?.reliability ?? 0;
    creativity += trait.reputation_tendencies?.creativity ?? 0;
  }

  return { authenticity, attitude, reliability, creativity };
};
