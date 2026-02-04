import { supabase } from "@/integrations/supabase/client";

export interface MentorDiscoveryResult {
  success: boolean;
  mentor?: {
    id: string;
    name: string;
    specialty: string;
    lore_biography: string;
    focus_skill: string;
    city?: {
      name: string;
      country: string;
    };
  };
  method: string;
}

/**
 * Check if a venue gig can trigger mentor discovery and execute it if so
 */
export async function checkVenueGigDiscovery(
  profileId: string,
  venueId: string
): Promise<MentorDiscoveryResult | null> {
  try {
    // Find mentors who are discovered via this venue
    const { data: mentors, error: mentorError } = await supabase
      .from("education_mentors")
      .select(`
        id, name, specialty, lore_biography, focus_skill,
        city:cities(name, country)
      `)
      .eq("discovery_venue_id", venueId)
      .eq("discovery_type", "venue_gig")
      .eq("is_active", true)
      .eq("is_discoverable", true);

    if (mentorError || !mentors || mentors.length === 0) {
      return null;
    }

    // Check which mentors the player hasn't discovered yet
    const { data: existingDiscoveries } = await supabase
      .from("player_master_discoveries")
      .select("mentor_id")
      .eq("profile_id", profileId)
      .in("mentor_id", mentors.map(m => m.id));

    const discoveredIds = new Set(existingDiscoveries?.map(d => d.mentor_id) || []);
    const undiscoveredMentor = mentors.find(m => !discoveredIds.has(m.id));

    if (!undiscoveredMentor) {
      return null;
    }

    // Trigger discovery via RPC
    const { error: discoverError } = await supabase.rpc("discover_master", {
      p_profile_id: profileId,
      p_mentor_id: undiscoveredMentor.id,
      p_method: "venue_gig",
      p_metadata: { venue_id: venueId }
    });

    if (discoverError) {
      console.error("[MentorDiscovery] Error discovering mentor:", discoverError);
      return null;
    }

    return {
      success: true,
      mentor: {
        id: undiscoveredMentor.id,
        name: undiscoveredMentor.name,
        specialty: undiscoveredMentor.specialty,
        lore_biography: undiscoveredMentor.lore_biography || "",
        focus_skill: undiscoveredMentor.focus_skill,
        city: undiscoveredMentor.city as { name: string; country: string } | undefined,
      },
      method: "venue_gig"
    };
  } catch (error) {
    console.error("[MentorDiscovery] Unexpected error:", error);
    return null;
  }
}

/**
 * Check if a studio session can trigger mentor discovery
 */
export async function checkStudioSessionDiscovery(
  profileId: string,
  studioId: string
): Promise<MentorDiscoveryResult | null> {
  try {
    const { data: mentors, error: mentorError } = await supabase
      .from("education_mentors")
      .select(`
        id, name, specialty, lore_biography, focus_skill,
        city:cities(name, country)
      `)
      .eq("discovery_studio_id", studioId)
      .eq("discovery_type", "studio_session")
      .eq("is_active", true)
      .eq("is_discoverable", true);

    if (mentorError || !mentors || mentors.length === 0) {
      return null;
    }

    // Check which mentors the player hasn't discovered yet
    const { data: existingDiscoveries } = await supabase
      .from("player_master_discoveries")
      .select("mentor_id")
      .eq("profile_id", profileId)
      .in("mentor_id", mentors.map(m => m.id));

    const discoveredIds = new Set(existingDiscoveries?.map(d => d.mentor_id) || []);
    const undiscoveredMentor = mentors.find(m => !discoveredIds.has(m.id));

    if (!undiscoveredMentor) {
      return null;
    }

    // Trigger discovery
    const { error: discoverError } = await supabase.rpc("discover_master", {
      p_profile_id: profileId,
      p_mentor_id: undiscoveredMentor.id,
      p_method: "studio_session",
      p_metadata: { studio_id: studioId }
    });

    if (discoverError) {
      console.error("[MentorDiscovery] Error discovering mentor:", discoverError);
      return null;
    }

    return {
      success: true,
      mentor: {
        id: undiscoveredMentor.id,
        name: undiscoveredMentor.name,
        specialty: undiscoveredMentor.specialty,
        lore_biography: undiscoveredMentor.lore_biography || "",
        focus_skill: undiscoveredMentor.focus_skill,
        city: undiscoveredMentor.city as { name: string; country: string } | undefined,
      },
      method: "studio_session"
    };
  } catch (error) {
    console.error("[MentorDiscovery] Unexpected error:", error);
    return null;
  }
}

/**
 * Get discovery method display info
 */
export function getDiscoveryMethodInfo(method: string): { icon: string; label: string; color: string } {
  switch (method) {
    case "venue_gig":
      return { icon: "🎤", label: "Venue Performance", color: "text-primary" };
    case "studio_session":
      return { icon: "🎛️", label: "Studio Recording", color: "text-blue-500" };
    case "exploration":
      return { icon: "🗺️", label: "City Exploration", color: "text-green-500" };
    case "achievement":
      return { icon: "🏆", label: "Achievement Unlock", color: "text-yellow-500" };
    case "automatic":
      return { icon: "⭐", label: "Starter Master", color: "text-amber-500" };
    default:
      return { icon: "✨", label: "Discovery", color: "text-muted-foreground" };
  }
}
