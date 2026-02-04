import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QualityModifier {
  type: string;
  value: number;
  source: string;
}

export interface CompanyQualityResult {
  totalModifier: number;
  modifiers: QualityModifier[];
}

interface UpgradeRow {
  upgrade_type: string;
  name?: string;
  level: number;
  effect_value: number;
}

// Recording Studio Quality Modifier
export function useStudioQualityModifier(studioId: string | undefined) {
  return useQuery({
    queryKey: ['studio-quality-modifier', studioId],
    queryFn: async (): Promise<CompanyQualityResult> => {
      if (!studioId) return { totalModifier: 0, modifiers: [] };

      const modifiers: QualityModifier[] = [];

      // Fetch upgrades
      const { data: upgrades } = await supabase
        .from('recording_studio_upgrades')
        .select('upgrade_type, name, level, effect_value')
        .eq('studio_id', studioId);

      if (upgrades) {
        upgrades.forEach(upgrade => {
          modifiers.push({
            type: upgrade.upgrade_type,
            value: Number(upgrade.effect_value),
            source: `${upgrade.name} (Level ${upgrade.level})`
          });
        });
      }

      // Fetch equipment value
      const { data: equipment } = await supabase
        .from('recording_studio_equipment')
        .select('value')
        .eq('studio_id', studioId);

      if (equipment && equipment.length > 0) {
        const totalValue = equipment.reduce((sum, e) => sum + (e.value || 0), 0);
        const equipmentBonus = Math.floor((totalValue / 100000) * 5); // 5% per $100k
        if (equipmentBonus > 0) {
          modifiers.push({
            type: 'equipment',
            value: Math.min(equipmentBonus, 25), // Cap at 25%
            source: `Equipment Value ($${totalValue.toLocaleString()})`
          });
        }
      }

      // Fetch staff skill
      const { data: staff } = await supabase
        .from('recording_studio_staff')
        .select('skill_level')
        .eq('studio_id', studioId)
        .eq('is_active', true);

      if (staff && staff.length > 0) {
        const avgSkill = staff.reduce((sum, s) => sum + s.skill_level, 0) / staff.length;
        const staffBonus = Math.floor(avgSkill / 20); // 1% per 20 skill points
        if (staffBonus > 0) {
          modifiers.push({
            type: 'staff',
            value: Math.min(staffBonus, 10), // Cap at 10%
            source: `Staff Expertise (Avg ${avgSkill.toFixed(0)})`
          });
        }
      }

      const totalModifier = Math.min(
        50, // Cap at 50% total bonus
        modifiers.reduce((sum, m) => sum + m.value, 0)
      );

      return { totalModifier, modifiers };
    },
    enabled: !!studioId,
  });
}

// Venue Quality Modifier
export function useVenueQualityModifier(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-quality-modifier', venueId],
    queryFn: async (): Promise<CompanyQualityResult> => {
      if (!venueId) return { totalModifier: 0, modifiers: [] };

      const modifiers: QualityModifier[] = [];

      // Fetch venue upgrades - cast to handle new table not in generated types
      const { data: upgradesRaw } = await supabase
        .from('venue_upgrades')
        .select('*')
        .eq('venue_id', venueId);

      const upgrades = upgradesRaw as unknown as UpgradeRow[] | null;
      if (upgrades) {
        upgrades.forEach(upgrade => {
          modifiers.push({
            type: upgrade.upgrade_type,
            value: Number(upgrade.effect_value),
            source: `${upgrade.upgrade_type} (Level ${upgrade.level})`
          });
        });
      }

      // Fetch venue base prestige
      const { data: venue } = await supabase
        .from('venues')
        .select('prestige_level, reputation')
        .eq('id', venueId)
        .single();

      if (venue) {
        // Prestige level bonus (1-5 scale)
        const prestigeBonus = (venue.prestige_level || 1) * 2;
        modifiers.push({
          type: 'prestige',
          value: prestigeBonus,
          source: `Prestige Level ${venue.prestige_level}`
        });

        // Reputation bonus
        if (venue.reputation && venue.reputation > 50) {
          const repBonus = Math.floor((venue.reputation - 50) / 10);
          modifiers.push({
            type: 'reputation',
            value: repBonus,
            source: `Reputation (${venue.reputation})`
          });
        }
      }

      const totalModifier = Math.min(
        40, // Cap at 40% total bonus
        modifiers.reduce((sum, m) => sum + m.value, 0)
      );

      return { totalModifier, modifiers };
    },
    enabled: !!venueId,
  });
}

// Security Firm Quality Modifier
export function useSecurityFirmQualityModifier(firmId: string | undefined) {
  return useQuery({
    queryKey: ['security-firm-quality-modifier', firmId],
    queryFn: async (): Promise<CompanyQualityResult> => {
      if (!firmId) return { totalModifier: 0, modifiers: [] };

      const modifiers: QualityModifier[] = [];

      // Fetch security firm upgrades - cast to handle new table
      try {
        const { data: upgradesRaw } = await supabase
          .from('security_firm_upgrades')
          .select('upgrade_type, name, level, effect_value')
          .eq('security_firm_id', firmId);

        const upgrades = upgradesRaw as unknown as UpgradeRow[] | null;
        if (upgrades) {
          upgrades.forEach(upgrade => {
            modifiers.push({
              type: upgrade.upgrade_type,
              value: Number(upgrade.effect_value),
              source: `${upgrade.name || upgrade.upgrade_type} (Level ${upgrade.level})`
            });
          });
        }
      } catch {
        // Table may not exist in types yet
      }

      // Fetch guard skill average
      const { data: guards } = await supabase
        .from('security_guards')
        .select('skill_level')
        .eq('security_firm_id', firmId);

      if (guards && guards.length > 0) {
        const avgSkill = guards.reduce((sum, g) => sum + g.skill_level, 0) / guards.length;
        const guardBonus = Math.floor(avgSkill / 15); // 1% per 15 skill points
        if (guardBonus > 0) {
          modifiers.push({
            type: 'guards',
            value: Math.min(guardBonus, 15), // Cap at 15%
            source: `Guard Training (Avg ${avgSkill.toFixed(0)})`
          });
        }
      }

      // Fetch firm reputation
      const { data: firm } = await supabase
        .from('security_firms')
        .select('reputation')
        .eq('id', firmId)
        .single();

      if (firm && firm.reputation > 50) {
        const repBonus = Math.floor((firm.reputation - 50) / 10);
        modifiers.push({
          type: 'reputation',
          value: repBonus,
          source: `Firm Reputation (${firm.reputation})`
        });
      }

      const totalModifier = Math.min(
        35, // Cap at 35% total bonus
        modifiers.reduce((sum, m) => sum + m.value, 0)
      );

      return { totalModifier, modifiers };
    },
    enabled: !!firmId,
  });
}

// Logistics Company Quality Modifier
export function useLogisticsQualityModifier(companyId: string | undefined) {
  return useQuery({
    queryKey: ['logistics-quality-modifier', companyId],
    queryFn: async (): Promise<CompanyQualityResult> => {
      if (!companyId) return { totalModifier: 0, modifiers: [] };

      const modifiers: QualityModifier[] = [];

      // Fetch logistics upgrades - cast to handle new table
      const { data: upgradesRaw } = await supabase
        .from('logistics_company_upgrades')
        .select('*')
        .eq('logistics_company_id', companyId);

      const upgrades = upgradesRaw as unknown as UpgradeRow[] | null;
      if (upgrades) {
        upgrades.forEach(upgrade => {
          modifiers.push({
            type: upgrade.upgrade_type,
            value: Number(upgrade.effect_value),
            source: `${upgrade.name || upgrade.upgrade_type} (Level ${upgrade.level})`
          });
        });
      }

      // Fetch company quality
      const { data: company } = await supabase
        .from('logistics_companies')
        .select('current_fleet_size, on_time_delivery_rate, service_quality_rating')
        .eq('id', companyId)
        .maybeSingle();

      if (company) {
        if (company.current_fleet_size && company.current_fleet_size > 3) {
          const fleetBonus = Math.min(10, (company.current_fleet_size - 3) * 2);
          modifiers.push({
            type: 'fleet',
            value: fleetBonus,
            source: `Fleet Size (${company.current_fleet_size} vehicles)`
          });
        }
        if (company.on_time_delivery_rate && company.on_time_delivery_rate > 70) {
          const reliabilityBonus = Math.floor((company.on_time_delivery_rate - 70) / 6);
          modifiers.push({
            type: 'reliability',
            value: reliabilityBonus,
            source: `On-Time Rate (${company.on_time_delivery_rate}%)`
          });
        }
      }

      const totalModifier = Math.min(
        30, // Cap at 30% total bonus
        modifiers.reduce((sum, m) => sum + m.value, 0)
      );

      return { totalModifier, modifiers };
    },
    enabled: !!companyId,
  });
}

// Merch Factory Quality Modifier
export function useMerchFactoryQualityModifier(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-factory-quality-modifier', factoryId],
    queryFn: async (): Promise<CompanyQualityResult> => {
      if (!factoryId) return { totalModifier: 0, modifiers: [] };

      const modifiers: QualityModifier[] = [];

      // Fetch factory upgrades - cast to handle new table
      const { data: upgradesRaw } = await supabase
        .from('merch_factory_upgrades')
        .select('*')
        .eq('merch_factory_id', factoryId);

      const upgrades = upgradesRaw as unknown as UpgradeRow[] | null;
      if (upgrades) {
        upgrades.forEach(upgrade => {
          modifiers.push({
            type: upgrade.upgrade_type,
            value: Number(upgrade.effect_value),
            source: `${upgrade.name || upgrade.upgrade_type} (Level ${upgrade.level})`
          });
        });
      }

      // Fetch factory stats
      const { data: factory } = await supabase
        .from('merch_factories')
        .select('quality_level, worker_skill_avg')
        .eq('id', factoryId)
        .maybeSingle();

      if (factory) {
        if (factory.quality_level && factory.quality_level > 1) {
          const qualityBonus = (factory.quality_level - 1) * 5;
          modifiers.push({
            type: 'quality',
            value: qualityBonus,
            source: `Quality Level ${factory.quality_level}`
          });
        }
        if (factory.worker_skill_avg && factory.worker_skill_avg > 50) {
          const skillBonus = Math.floor((factory.worker_skill_avg - 50) / 10);
          modifiers.push({
            type: 'worker_skill',
            value: skillBonus,
            source: `Worker Skill (${factory.worker_skill_avg})`
          });
        }
      }

      const totalModifier = Math.min(
        40, // Cap at 40% total bonus
        modifiers.reduce((sum, m) => sum + m.value, 0)
      );

      return { totalModifier, modifiers };
    },
    enabled: !!factoryId,
  });
}
