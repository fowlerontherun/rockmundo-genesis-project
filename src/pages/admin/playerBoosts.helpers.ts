import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";

import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { parseString } from "./shared";

export const targetScopes = ["single", "multiple", "all"] as const;
export type TargetScope = (typeof targetScopes)[number];

export const playerTargetingSchema = z
  .object({
    targetScope: z.enum(targetScopes),
    profileId: z.string().uuid().optional(),
    profileIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.targetScope === "single" && !values.profileId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profileId"],
        message: "Select a player profile.",
      });
    }

    if (values.targetScope === "multiple") {
      const ids = values.profileIds ?? [];
      if (ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profileIds"],
          message: "Select at least one player profile.",
        });
      }
    }
  });

export type PlayerTargetingFormValues = z.infer<typeof playerTargetingSchema>;

export const playerTargetingDefaultValues: PlayerTargetingFormValues = {
  targetScope: "single",
  profileId: undefined,
  profileIds: [],
};

export type PlayerProfileOption = {
  profileId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
};

export const usePlayerProfiles = () => {
  const { toast } = useToast();
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfileOption[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  const fetchPlayerProfiles = useCallback(async () => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, user_id, display_name, username")
        .order("display_name", { ascending: true, nullsFirst: false })
        .order("username", { ascending: true, nullsFirst: false })
        .limit(500);

      if (error) throw error;

      const profiles = (data ?? [])
        .filter((row): row is {
          id: string;
          user_id: string;
          display_name: string | null;
          username: string | null;
        } => typeof row?.id === "string" && typeof row?.user_id === "string")
        .map((row) => ({
          profileId: row.id,
          userId: row.user_id,
          displayName: parseString(row.display_name) ?? null,
          username: parseString(row.username) ?? null,
        }))
        .sort((a, b) => {
          const nameA = a.displayName ?? a.username ?? a.profileId;
          const nameB = b.displayName ?? b.username ?? b.profileId;
          return nameA.localeCompare(nameB);
        });

      setPlayerProfiles(profiles);
    } catch (error) {
      console.error("Failed to fetch player profiles", error);
      toast({
        variant: "destructive",
        title: "Unable to load players",
        description: "We couldn't fetch the player roster. Please try again shortly.",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchPlayerProfiles();
  }, [fetchPlayerProfiles]);

  return {
    playerProfiles,
    isLoadingPlayers,
    fetchPlayerProfiles,
  };
};

export const useTargetScopeSynchronization = <T extends PlayerTargetingFormValues>(
  form: UseFormReturn<T>,
) => {
  const targetScope = form.watch("targetScope");

  useEffect(() => {
    if (targetScope === "single") {
      form.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "multiple") {
      form.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "all") {
      form.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      form.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [form, targetScope]);

  const selectedProfileIds = form.watch("profileIds");
  const selectedProfileCount = useMemo(
    () => (Array.isArray(selectedProfileIds) ? selectedProfileIds.length : 0),
    [selectedProfileIds],
  );

  return { targetScope, selectedProfileCount };
};

export const resolveTargetProfileIds = (values: PlayerTargetingFormValues): string[] => {
  if (values.targetScope === "single") {
    return values.profileId ? [values.profileId] : [];
  }

  if (values.targetScope === "multiple") {
    return Array.isArray(values.profileIds) ? values.profileIds : [];
  }

  return [];
};

export const getAffectedCount = (
  values: PlayerTargetingFormValues,
  playerRosterSize: number,
  responseCount: number | null | undefined,
): number => {
  if (typeof responseCount === "number" && Number.isFinite(responseCount)) {
    return Math.max(0, Math.floor(responseCount));
  }

  if (values.targetScope === "all") {
    return playerRosterSize;
  }

  return resolveTargetProfileIds(values).length;
};

export const describeAllRecipientCount = (
  isLoading: boolean,
  playerRosterSize: number,
): string => {
  if (isLoading) {
    return "Loading player roster...";
  }

  if (playerRosterSize > 0) {
    return `This targets all ${playerRosterSize} player${playerRosterSize === 1 ? "" : "s"}.`;
  }

  return "This targets everyone with a player profile.";
};
