import { supabase } from "@/integrations/supabase/client";

const FORMER_MEMBER_RETENTION_RATE = 0.30; // 30% of original share

interface RoyaltyDistribution {
  userId: string;
  amount: number;
  percentage: number;
  role: string;
  isActiveMember: boolean;
}

/**
 * Calculate royalty distribution for a song based on ownership records
 * @param songId - The song ID to calculate royalties for
 * @param totalEarnings - The total earnings to distribute
 * @returns Array of royalty distributions per owner
 */
export async function calculateRoyaltyDistribution(
  songId: string,
  totalEarnings: number
): Promise<RoyaltyDistribution[]> {
  // Fetch ownership records for the song
  const { data: ownershipRecords, error } = await supabase
    .from("band_song_ownership")
    .select("*")
    .eq("song_id", songId);

  if (error) {
    console.error("Error fetching ownership records:", error);
    throw error;
  }

  if (!ownershipRecords || ownershipRecords.length === 0) {
    return [];
  }

  // Calculate total ownership percentage
  const totalPercentage = ownershipRecords.reduce(
    (sum, record) => sum + (record.ownership_percentage || 0),
    0
  );

  // Normalize and distribute earnings
  return ownershipRecords.map((record) => {
    const normalizedPercentage = totalPercentage > 0 
      ? (record.ownership_percentage / totalPercentage) * 100 
      : 0;
    
    return {
      userId: record.user_id,
      amount: (normalizedPercentage / 100) * totalEarnings,
      percentage: record.ownership_percentage,
      role: record.role,
      isActiveMember: record.is_active_member,
    };
  });
}

/**
 * Handle ownership changes when a member leaves the band
 * - Reduces their ownership to 30% of original
 * - Marks them as inactive
 * - Sets role to 'former_member'
 */
export async function handleMemberLeaveOwnership(
  userId: string,
  bandId: string
): Promise<void> {
  try {
    // Get all ownership records for this member in this band
    const { data: ownershipRecords, error: fetchError } = await supabase
      .from("band_song_ownership")
      .select("*")
      .eq("band_id", bandId)
      .eq("user_id", userId);

    if (fetchError) throw fetchError;
    if (!ownershipRecords || ownershipRecords.length === 0) return;

    // Update each ownership record
    for (const record of ownershipRecords) {
      const newPercentage = record.original_percentage * FORMER_MEMBER_RETENTION_RATE;

      const { error: updateError } = await supabase
        .from("band_song_ownership")
        .update({
          ownership_percentage: newPercentage,
          is_active_member: false,
          role: "former_member",
        })
        .eq("id", record.id);

      if (updateError) {
        console.error("Error updating ownership record:", updateError);
      }
    }

    // Log the ownership change
    await supabase.from("band_history").insert({
      band_id: bandId,
      event_type: "ownership_adjusted",
      triggered_by: userId,
      event_data: {
        action: "member_left",
        affected_songs: ownershipRecords.length,
        new_retention_rate: FORMER_MEMBER_RETENTION_RATE * 100,
      },
    });
  } catch (error) {
    console.error("Error handling member leave ownership:", error);
    throw error;
  }
}

/**
 * Handle ownership restoration when a member rejoins the band
 * - Restores their ownership to original percentage
 * - Marks them as active
 * - Sets role back to original role
 */
export async function handleMemberRejoinOwnership(
  userId: string,
  bandId: string
): Promise<void> {
  try {
    // Get all ownership records for this member in this band
    const { data: ownershipRecords, error: fetchError } = await supabase
      .from("band_song_ownership")
      .select("*")
      .eq("band_id", bandId)
      .eq("user_id", userId);

    if (fetchError) throw fetchError;
    if (!ownershipRecords || ownershipRecords.length === 0) return;

    // Restore each ownership record to original values
    for (const record of ownershipRecords) {
      const originalRole = record.ownership_percentage >= 50 ? "writer" : "co-writer";

      const { error: updateError } = await supabase
        .from("band_song_ownership")
        .update({
          ownership_percentage: record.original_percentage,
          is_active_member: true,
          role: originalRole,
        })
        .eq("id", record.id);

      if (updateError) {
        console.error("Error restoring ownership record:", updateError);
      }
    }

    // Log the ownership restoration
    await supabase.from("band_history").insert({
      band_id: bandId,
      event_type: "ownership_restored",
      triggered_by: userId,
      event_data: {
        action: "member_rejoined",
        affected_songs: ownershipRecords.length,
      },
    });
  } catch (error) {
    console.error("Error handling member rejoin ownership:", error);
    throw error;
  }
}

/**
 * Add ownership records when adding co-writers to a song
 */
export async function addCoWriterOwnership(
  songId: string,
  bandId: string,
  coWriterUserId: string,
  percentage: number,
  existingWriterUserId: string
): Promise<void> {
  try {
    // Get current writer's ownership
    const { data: writerOwnership, error: fetchError } = await supabase
      .from("band_song_ownership")
      .select("*")
      .eq("song_id", songId)
      .eq("user_id", existingWriterUserId)
      .single();

    if (fetchError) throw fetchError;

    // Calculate new percentages
    const writerNewPercentage = 100 - percentage;

    // Update writer's percentage
    await supabase
      .from("band_song_ownership")
      .update({
        ownership_percentage: writerNewPercentage,
        original_percentage: writerNewPercentage,
      })
      .eq("id", writerOwnership.id);

    // Add co-writer ownership
    await supabase.from("band_song_ownership").insert({
      song_id: songId,
      band_id: bandId,
      user_id: coWriterUserId,
      ownership_percentage: percentage,
      original_percentage: percentage,
      role: "co-writer",
      is_active_member: true,
    });
  } catch (error) {
    console.error("Error adding co-writer ownership:", error);
    throw error;
  }
}
