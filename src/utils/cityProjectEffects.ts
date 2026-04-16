import { supabase } from "@/integrations/supabase/client";
import type { CityProject, CityProjectEffects } from "@/types/city-projects";

/**
 * Apply the effects of a completed city project.
 * Updates cities table stats, city_laws max_concert_capacity, mayor approval and counts.
 * Returns true on success, false on failure.
 */
export async function applyProjectCompletionEffects(project: CityProject): Promise<boolean> {
  const effects: CityProjectEffects = project.effects ?? {};

  try {
    // Fetch current city to apply increments safely
    const { data: city } = await supabase
      .from("cities")
      .select("music_scene, local_bonus, venues, population")
      .eq("id", project.city_id)
      .maybeSingle();

    if (city) {
      const updates: Record<string, number> = {};
      if (effects.music_scene) updates.music_scene = (city.music_scene ?? 0) + effects.music_scene;
      if (effects.local_bonus) updates.local_bonus = (city.local_bonus ?? 0) + effects.local_bonus;
      if (effects.venues) updates.venues = (city.venues ?? 0) + effects.venues;
      if (effects.population) updates.population = (city.population ?? 0) + effects.population;

      if (Object.keys(updates).length > 0) {
        await supabase.from("cities").update(updates).eq("id", project.city_id);
      }
    }

    // Update concert capacity in laws if needed
    if (effects.max_concert_capacity) {
      const { data: laws } = await supabase
        .from("city_laws")
        .select("id, max_concert_capacity")
        .eq("city_id", project.city_id)
        .is("effective_until", null)
        .maybeSingle();
      if (laws) {
        const newCap = Math.max(laws.max_concert_capacity ?? 0, effects.max_concert_capacity);
        await supabase.from("city_laws").update({ max_concert_capacity: newCap }).eq("id", laws.id);
      }
    }

    // Bump weekly budget if applicable
    if (effects.weekly_budget_bonus) {
      const { data: treasury } = await supabase
        .from("city_treasury")
        .select("weekly_budget, pending_commitments")
        .eq("city_id", project.city_id)
        .maybeSingle();
      if (treasury) {
        await supabase
          .from("city_treasury")
          .update({
            weekly_budget: (treasury.weekly_budget ?? 0) + effects.weekly_budget_bonus,
            pending_commitments: Math.max(0, (treasury.pending_commitments ?? 0) - project.cost),
          })
          .eq("city_id", project.city_id);
      }
    } else {
      // Release commitment funds and deduct actual spend
      const { data: treasury } = await supabase
        .from("city_treasury")
        .select("balance, pending_commitments, total_spent")
        .eq("city_id", project.city_id)
        .maybeSingle();
      if (treasury) {
        await supabase
          .from("city_treasury")
          .update({
            balance: Math.max(0, (treasury.balance ?? 0) - project.cost),
            pending_commitments: Math.max(0, (treasury.pending_commitments ?? 0) - project.cost),
            total_spent: (treasury.total_spent ?? 0) + project.cost,
          })
          .eq("city_id", project.city_id);
      }
    }

    // Mayor stats
    if (project.mayor_id) {
      const { data: mayor } = await supabase
        .from("city_mayors")
        .select("approval_rating, projects_completed, policies_enacted")
        .eq("id", project.mayor_id)
        .maybeSingle();
      if (mayor) {
        await supabase
          .from("city_mayors")
          .update({
            approval_rating: Math.min(100, (mayor.approval_rating ?? 50) + project.approval_change),
            projects_completed: (mayor.projects_completed ?? 0) + 1,
            policies_enacted: (mayor.policies_enacted ?? 0) + 1,
          })
          .eq("id", project.mayor_id);
      }
    }

    // Mark project completed
    await supabase
      .from("city_projects")
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq("id", project.id);

    return true;
  } catch (err) {
    console.error("Failed to apply project completion effects", err);
    return false;
  }
}

/**
 * Check projects that should be completed and apply their effects.
 * Safe to call from the client whenever the dashboard loads.
 */
export async function processCompletedProjects(cityId: string): Promise<number> {
  const { data: due } = await supabase
    .from("city_projects")
    .select("*, project_type:city_project_types(*)")
    .eq("city_id", cityId)
    .eq("status", 'in_progress')
    .lte("completes_at", new Date().toISOString());

  let count = 0;
  for (const project of (due ?? []) as unknown as CityProject[]) {
    const ok = await applyProjectCompletionEffects(project);
    if (ok) count++;
  }
  return count;
}
