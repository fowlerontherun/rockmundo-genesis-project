import { supabase } from "@/integrations/supabase/client";

export interface ActiveBandCheck {
  allowed: boolean;
  reason?: string;
  existingBand?: any;
}

export async function getUserActiveBand(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .select('band_id, bands!band_members_band_id_fkey!inner(*)')
      .eq('user_id', userId)
      .eq('bands.status', 'active')
      .limit(1)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching active band:', error);
      throw error;
    }
    
    // Return the bands object if it exists
    if (data && 'bands' in data) {
      return data.bands;
    }
    
    return null;
  } catch (error) {
    console.error('Error in getUserActiveBand:', error);
    return null;
  }
}

export async function getUserBands(userId: string) {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .select(`
        band_id,
        joined_at,
        role,
        instrument_role,
        vocal_role,
        is_touring_member,
        bands!band_members_band_id_fkey(*)
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user bands:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUserBands:', error);
    return [];
  }
}

export async function canJoinAnotherBand(userId: string): Promise<ActiveBandCheck> {
  try {
    const activeBand = await getUserActiveBand(userId);
    
    if (!activeBand) {
      return { allowed: true };
    }
    
    return {
      allowed: false,
      reason: 'You already have an active band. Put it on hiatus first.',
      existingBand: activeBand
    };
  } catch (error) {
    console.error('Error in canJoinAnotherBand:', error);
    return { 
      allowed: false, 
      reason: 'Error checking band status. Please try again.' 
    };
  }
}

export function getBandStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'on_hiatus':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'disbanded':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getBandStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'on_hiatus':
      return 'On Hiatus';
    case 'disbanded':
      return 'Disbanded';
    default:
      return 'Unknown';
  }
}
