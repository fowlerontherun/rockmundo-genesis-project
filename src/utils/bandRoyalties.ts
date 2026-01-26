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

/**
 * Create ownership records for songwriting collaborators when a song is completed
 * Handles both band members and external collaborators with royalty agreements
 */
export async function createCollaboratorOwnership(
  songId: string,
  bandId: string | null,
  primaryWriterUserId: string,
  collaborators: {
    userId: string;
    profileId: string;
    percentage: number;
    isBandMember: boolean;
  }[]
): Promise<void> {
  try {
    // Calculate primary writer's percentage
    const totalCollaboratorPercentage = collaborators.reduce((sum, c) => sum + c.percentage, 0);
    const primaryWriterPercentage = 100 - totalCollaboratorPercentage;

    // Create ownership record for primary writer
    if (bandId) {
      await supabase.from("band_song_ownership").insert({
        song_id: songId,
        band_id: bandId,
        user_id: primaryWriterUserId,
        ownership_percentage: primaryWriterPercentage,
        original_percentage: primaryWriterPercentage,
        role: "writer",
        is_active_member: true,
      });

      // Create ownership records for each collaborator
      for (const collab of collaborators) {
        await supabase.from("band_song_ownership").insert({
          song_id: songId,
          band_id: bandId,
          user_id: collab.userId,
          ownership_percentage: collab.percentage,
          original_percentage: collab.percentage,
          role: "co-writer",
          is_active_member: collab.isBandMember,
        });
      }
    }
  } catch (error) {
    console.error("Error creating collaborator ownership:", error);
    throw error;
  }
}

/**
 * Remove a song from the band's repertoire
 * - Removes all ownership records for the song
 * - Clears band_id from the song
 */
export async function removeFromRepertoire(
  songId: string,
  bandId: string
): Promise<void> {
  try {
    // Remove ownership records
    await supabase
      .from("band_song_ownership")
      .delete()
      .eq("song_id", songId)
      .eq("band_id", bandId);

    // Clear band association from song
    await supabase
      .from("songs")
      .update({
        band_id: null,
        ownership_type: "personal",
        added_to_repertoire_at: null,
        added_to_repertoire_by: null,
      })
      .eq("id", songId);

    // Log the removal
    await supabase.from("band_history").insert({
      band_id: bandId,
      event_type: "song_removed",
      event_data: {
        song_id: songId,
        action: "removed_from_repertoire",
      },
    });
  } catch (error) {
    console.error("Error removing song from repertoire:", error);
    throw error;
  }
}

/**
 * Backfill ownership records for songs that have a band_id but no ownership records
 */
export async function backfillSongOwnership(bandId: string): Promise<void> {
  try {
    // Find songs with band_id but no ownership records
    const { data: songs } = await supabase
      .from("songs")
      .select("id, user_id")
      .eq("band_id", bandId);

    if (!songs || songs.length === 0) return;

    for (const song of songs) {
      // Check if ownership record already exists
      const { data: existing } = await supabase
        .from("band_song_ownership")
        .select("id")
        .eq("song_id", song.id)
        .maybeSingle();

      if (!existing && song.user_id) {
        await supabase.from("band_song_ownership").insert({
          song_id: song.id,
          band_id: bandId,
          user_id: song.user_id,
          ownership_percentage: 100,
          original_percentage: 100,
          role: "writer",
          is_active_member: true,
        });
      }
    }
  } catch (error) {
    console.error("Error backfilling song ownership:", error);
  }
}
