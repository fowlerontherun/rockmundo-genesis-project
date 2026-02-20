// Social Drama Event Generator — React Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import type {
  SocialDramaEvent,
  GeneratedMediaArticle,
  SocialDramaCategory,
} from "@/types/social-drama-generator";
import {
  SOCIAL_DRAMA_PRESETS,
  selectCoveringOutlets,
  generateArticle,
  calculateDramaImpacts,
} from "@/types/social-drama-generator";

const QUERY_KEY = "social-drama";
const ARTICLES_KEY = "media-articles";

// ─── Fetch Drama Events ──────────────────────────────────

export const useSocialDramaEvents = (entityId?: string, limit = 30) => {
  return useQuery({
    queryKey: [QUERY_KEY, entityId, limit],
    queryFn: async () => {
      let query = supabase
        .from("social_drama_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (entityId) {
        query = query.or(`primary_entity_id.eq.${entityId},secondary_entity_id.eq.${entityId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SocialDramaEvent[];
    },
    enabled: true,
    staleTime: 1000 * 60 * 2,
  });
};

// ─── Fetch Media Articles ────────────────────────────────

export const useMediaArticles = (options?: {
  breakingOnly?: boolean;
  featuredOnly?: boolean;
  limit?: number;
}) => {
  const { breakingOnly, featuredOnly, limit = 20 } = options ?? {};

  return useQuery({
    queryKey: [ARTICLES_KEY, breakingOnly, featuredOnly, limit],
    queryFn: async () => {
      let query = supabase
        .from("generated_media_articles")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (breakingOnly) query = query.eq("is_breaking", true);
      if (featuredOnly) query = query.eq("featured", true);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as GeneratedMediaArticle[];
    },
    staleTime: 1000 * 60,
  });
};

// ─── Fetch Articles For a Drama Event ────────────────────

export const useDramaArticles = (dramaEventId?: string) => {
  return useQuery({
    queryKey: [ARTICLES_KEY, "drama", dramaEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_media_articles")
        .select("*")
        .eq("drama_event_id", dramaEventId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as GeneratedMediaArticle[];
    },
    enabled: !!dramaEventId,
  });
};

// ─── Generate Social Drama Event ─────────────────────────

export const useGenerateSocialDrama = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category: SocialDramaCategory;
      primaryEntityId: string;
      primaryEntityType: 'player' | 'npc' | 'band';
      primaryEntityName: string;
      secondaryEntityId?: string;
      secondaryEntityType?: 'player' | 'npc' | 'band';
      secondaryEntityName?: string;
      fame?: number; // For outlet selection
      severityOverride?: 'minor' | 'moderate' | 'major' | 'explosive';
    }) => {
      const preset = SOCIAL_DRAMA_PRESETS[input.category];
      if (!preset) throw new Error(`Unknown drama category: ${input.category}`);

      const fame = input.fame ?? 0;
      const severity = input.severityOverride ?? preset.defaultSeverity;

      // Calculate impacts
      const impacts = calculateDramaImpacts(preset, fame);

      // Generate hashtag with actual names
      const hashtag = preset.twaaterHashtagTemplate
        .replace('{primary}', input.primaryEntityName.replace(/\s+/g, ''))
        .replace('{secondary}', (input.secondaryEntityName ?? '').replace(/\s+/g, ''));

      const headline = preset.headlines[Math.floor(Math.random() * preset.headlines.length)]
        .replace('{primary}', input.primaryEntityName)
        .replace('{secondary}', input.secondaryEntityName ?? 'an unnamed party');

      const description = preset.bodyTemplates[Math.floor(Math.random() * preset.bodyTemplates.length)]
        .replace(/{primary}/g, input.primaryEntityName)
        .replace(/{secondary}/g, input.secondaryEntityName ?? 'an unnamed party');

      const effectsExpireAt = new Date();
      effectsExpireAt.setDate(effectsExpireAt.getDate() + preset.effectDurationDays);

      // Insert drama event
      const { data: dramaEvent, error: dramaErr } = await supabase
        .from("social_drama_events")
        .insert(asAny({
          primary_entity_id: input.primaryEntityId,
          primary_entity_type: input.primaryEntityType,
          primary_entity_name: input.primaryEntityName,
          secondary_entity_id: input.secondaryEntityId ?? null,
          secondary_entity_type: input.secondaryEntityType ?? null,
          secondary_entity_name: input.secondaryEntityName ?? null,
          drama_category: input.category,
          severity,
          headline,
          description,
          reputation_impact: preset.reputationImpact,
          fan_loyalty_change: impacts.fanLoyaltyChange,
          streaming_multiplier: impacts.streamingMultiplier,
          chart_boost: impacts.chartBoost,
          fame_change: impacts.fameChange,
          effect_duration_days: preset.effectDurationDays,
          effects_expire_at: effectsExpireAt.toISOString(),
          went_viral: impacts.wentViral,
          viral_score: impacts.viralScore,
          twaater_hashtag: hashtag,
        }))
        .select()
        .single();

      if (dramaErr) throw dramaErr;

      // Generate media articles from covering outlets
      const controversyLevel = { minor: 20, moderate: 45, major: 70, explosive: 90 }[severity];
      const coveringOutlets = selectCoveringOutlets(fame, severity, controversyLevel);

      // Always at least 1 article (RockMundo Daily covers everything)
      if (coveringOutlets.length === 0) {
        const fallback = { name: 'RockMundo Daily', tone: 'neutral' as const, fameThreshold: 0, controversyBias: 30 };
        coveringOutlets.push(fallback);
      }

      const articles: GeneratedMediaArticle[] = [];
      for (const outlet of coveringOutlets) {
        const articleData = generateArticle(
          preset,
          input.primaryEntityName,
          input.secondaryEntityName ?? null,
          outlet,
        );

        const { data: article, error: artErr } = await supabase
          .from("generated_media_articles")
          .insert(asAny({
            ...articleData,
            drama_event_id: dramaEvent.id,
            mentioned_entity_ids: [
              input.primaryEntityId,
              ...(input.secondaryEntityId ? [input.secondaryEntityId] : []),
            ],
          }))
          .select()
          .single();

        if (!artErr && article) articles.push(article as unknown as GeneratedMediaArticle);
      }

      // Update the drama event with the first article ID
      if (articles.length > 0) {
        await supabase
          .from("social_drama_events")
          .update(asAny({ media_article_id: articles[0].id }))
          .eq("id", dramaEvent.id);
      }

      return {
        event: dramaEvent as unknown as SocialDramaEvent,
        articles,
        impacts,
        coveringOutlets: coveringOutlets.map(o => o.name),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ARTICLES_KEY] });
    },
  });
};

// ─── Resolve Drama Event ─────────────────────────────────

export const useResolveSocialDrama = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dramaId: string) => {
      const { error } = await supabase
        .from("social_drama_events")
        .update(asAny({
          resolved: true,
          resolved_at: new Date().toISOString(),
          effects_active: false,
        }))
        .eq("id", dramaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Get Active Streaming Multiplier ─────────────────────

export const useActiveDramaStreamingMultiplier = (entityId?: string) => {
  const { data: events } = useSocialDramaEvents(entityId);

  if (!events || events.length === 0) return 1.0;

  // Combine all active drama streaming multipliers (multiplicative)
  const activeEvents = events.filter(e => e.effects_active && !e.resolved);
  if (activeEvents.length === 0) return 1.0;

  return activeEvents.reduce((mult, e) => mult * e.streaming_multiplier, 1.0);
};
