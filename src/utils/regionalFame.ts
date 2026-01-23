import { supabase } from "@/integrations/supabase/client";

// Get neighboring countries for fame spillover
export async function getNeighboringCountries(country: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('country_adjacency')
      .select('neighbor')
      .eq('country', country);
    
    if (error) throw error;
    return data?.map(d => d.neighbor) || [];
  } catch (e) {
    console.error('Error getting neighboring countries:', e);
    return [];
  }
}

// Calculate spillover fame to neighboring countries (20% default)
export async function spilloverFameToNeighbors(
  bandId: string,
  originCountry: string,
  fameGained: number,
  spilloverRate: number = 0.2
): Promise<void> {
  try {
    const neighbors = await getNeighboringCountries(originCountry);
    const spilloverAmount = Math.floor(fameGained * spilloverRate);
    
    if (spilloverAmount < 1 || neighbors.length === 0) return;
    
    for (const neighbor of neighbors) {
      // Check if band has performed in this country
      const { data: countryFans } = await supabase
        .from('band_country_fans')
        .select('id, fame, has_performed')
        .eq('band_id', bandId)
        .eq('country', neighbor)
        .maybeSingle();
      
      if (countryFans) {
        // Cap fame at 100 if band hasn't performed there
        const currentFame = countryFans.fame || 0;
        const maxFame = countryFans.has_performed ? Infinity : 100;
        const newFame = Math.min(currentFame + spilloverAmount, maxFame);
        
        if (newFame > currentFame) {
          await supabase
            .from('band_country_fans')
            .update({ 
              fame: newFame,
              updated_at: new Date().toISOString()
            })
            .eq('id', countryFans.id);
        }
      } else {
        // Create new country record with capped fame
        await supabase
          .from('band_country_fans')
          .insert({
            band_id: bandId,
            country: neighbor,
            fame: Math.min(spilloverAmount, 100), // Cap at 100 for unvisited countries
            has_performed: false,
            total_fans: 0,
          });
      }
    }
  } catch (e) {
    console.error('Error spilling over fame to neighbors:', e);
  }
}

// Get fame for a specific country (used for sales calculations)
export async function getBandCountryFame(
  bandId: string,
  country: string
): Promise<{ fame: number; hasPerformed: boolean; fans: number }> {
  try {
    const { data } = await supabase
      .from('band_country_fans')
      .select('fame, has_performed, total_fans')
      .eq('band_id', bandId)
      .eq('country', country)
      .maybeSingle();
    
    return {
      fame: data?.fame || 0,
      hasPerformed: data?.has_performed || false,
      fans: data?.total_fans || 0,
    };
  } catch (e) {
    console.error('Error getting band country fame:', e);
    return { fame: 0, hasPerformed: false, fans: 0 };
  }
}

// Calculate global fame as weighted average of country fames
export async function calculateGlobalFame(bandId: string): Promise<number> {
  try {
    const { data: countryFames } = await supabase
      .from('band_country_fans')
      .select('fame, total_fans, has_performed')
      .eq('band_id', bandId);
    
    if (!countryFames || countryFames.length === 0) return 0;
    
    // Weight by fans in each country
    let totalWeightedFame = 0;
    let totalWeight = 0;
    
    for (const cf of countryFames) {
      const weight = Math.max(1, cf.total_fans || 1);
      // Countries where band has performed count more
      const performedBonus = cf.has_performed ? 1.5 : 1.0;
      totalWeightedFame += (cf.fame || 0) * weight * performedBonus;
      totalWeight += weight * performedBonus;
    }
    
    return totalWeight > 0 ? Math.round(totalWeightedFame / totalWeight) : 0;
  } catch (e) {
    console.error('Error calculating global fame:', e);
    return 0;
  }
}

// Mark country as performed and lift fame cap
export async function markCountryAsPerformed(
  bandId: string,
  country: string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('band_country_fans')
      .select('id')
      .eq('band_id', bandId)
      .eq('country', country)
      .maybeSingle();
    
    if (existing) {
      await supabase
        .from('band_country_fans')
        .update({ 
          has_performed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('band_country_fans')
        .insert({
          band_id: bandId,
          country: country,
          has_performed: true,
          fame: 0,
          total_fans: 0,
        });
    }
  } catch (e) {
    console.error('Error marking country as performed:', e);
  }
}

// Calculate sales/streams multiplier based on regional fame
export function calculateRegionalSalesMultiplier(
  countryFame: number,
  hasPerformed: boolean,
  globalFame: number
): number {
  // Base multiplier from country fame (0-100 fame = 0.1-1.0 multiplier)
  let baseMultiplier = 0.1 + (Math.min(countryFame, 1000) / 1000) * 0.9;
  
  // If never performed, cap the multiplier at 0.3
  if (!hasPerformed && countryFame <= 100) {
    baseMultiplier = Math.min(baseMultiplier, 0.3);
  }
  
  // Global fame provides a floor (famous worldwide bands still sell some)
  const globalFloor = 0.05 + (Math.min(globalFame, 10000) / 10000) * 0.2;
  
  return Math.max(baseMultiplier, globalFloor);
}
