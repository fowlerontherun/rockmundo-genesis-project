import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const visibilityScopeSchema = z.enum(["public", "friends", "private"]);
export const dmPermissionSchema = z.enum(["everyone", "friends", "none"]);

export const socialPrivacySettingsSchema = z.object({
  profileId: z.string().uuid(),
  profileVisibility: visibilityScopeSchema,
  cityVisibility: visibilityScopeSchema,
  activityVisibility: visibilityScopeSchema,
  onlineStatusVisibility: visibilityScopeSchema,
  relationshipVisibility: visibilityScopeSchema,
  dmPermission: dmPermissionSchema,
  allowBandInvites: z.boolean(),
  allowCompanyInvites: z.boolean(),
});

export const socialPrivacySettingsUpdateSchema = socialPrivacySettingsSchema.omit({ profileId: true });

export type SocialPrivacySettings = z.infer<typeof socialPrivacySettingsSchema>;
export type SocialPrivacySettingsUpdate = z.infer<typeof socialPrivacySettingsUpdateSchema>;

const DEFAULT_SETTINGS: SocialPrivacySettingsUpdate = {
  profileVisibility: "public",
  cityVisibility: "friends",
  activityVisibility: "friends",
  onlineStatusVisibility: "private",
  relationshipVisibility: "friends",
  dmPermission: "friends",
  allowBandInvites: true,
  allowCompanyInvites: true,
};

const DB_TO_CLIENT = {
  profile_visibility: "profileVisibility",
  city_visibility: "cityVisibility",
  activity_visibility: "activityVisibility",
  online_status_visibility: "onlineStatusVisibility",
  relationship_visibility: "relationshipVisibility",
  dm_permission: "dmPermission",
  allow_band_invites: "allowBandInvites",
  allow_company_invites: "allowCompanyInvites",
} as const;

const toClient = (row: Record<string, unknown>): SocialPrivacySettings => socialPrivacySettingsSchema.parse({
  profileId: row.profile_id,
  profileVisibility: row.profile_visibility,
  cityVisibility: row.city_visibility,
  activityVisibility: row.activity_visibility,
  onlineStatusVisibility: row.online_status_visibility,
  relationshipVisibility: row.relationship_visibility,
  dmPermission: row.dm_permission,
  allowBandInvites: row.allow_band_invites,
  allowCompanyInvites: row.allow_company_invites,
});

const toDb = (profileId: string, input: SocialPrivacySettingsUpdate) => ({
  profile_id: profileId,
  profile_visibility: input.profileVisibility,
  city_visibility: input.cityVisibility,
  activity_visibility: input.activityVisibility,
  online_status_visibility: input.onlineStatusVisibility,
  relationship_visibility: input.relationshipVisibility,
  dm_permission: input.dmPermission,
  allow_band_invites: input.allowBandInvites,
  allow_company_invites: input.allowCompanyInvites,
});

export function getDefaultSocialPrivacySettings(profileId: string): SocialPrivacySettings {
  return socialPrivacySettingsSchema.parse({ profileId, ...DEFAULT_SETTINGS });
}

export async function fetchOwnSocialPrivacySettings(profileId: string): Promise<SocialPrivacySettings> {
  if (!profileId) throw new Error("Profile is required");

  const { data, error } = await (supabase as any)
    .from("profile_privacy_settings")
    .select("profile_id,profile_visibility,city_visibility,activity_visibility,online_status_visibility,relationship_visibility,dm_permission,allow_band_invites,allow_company_invites")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return getDefaultSocialPrivacySettings(profileId);
  return toClient(data);
}

export async function saveOwnSocialPrivacySettings(
  profileId: string,
  input: SocialPrivacySettingsUpdate,
): Promise<SocialPrivacySettings> {
  const parsed = socialPrivacySettingsUpdateSchema.parse(input);

  const { data, error } = await (supabase as any)
    .from("profile_privacy_settings")
    .upsert(toDb(profileId, parsed), { onConflict: "profile_id" })
    .select("profile_id,profile_visibility,city_visibility,activity_visibility,online_status_visibility,relationship_visibility,dm_permission,allow_band_invites,allow_company_invites")
    .single();

  if (error) throw error;
  return toClient(data);
}

export async function fetchPublicSocialPrivacySettings(profileId: string): Promise<Pick<SocialPrivacySettings, "profileId" | "profileVisibility" | "dmPermission" | "allowBandInvites" | "allowCompanyInvites"> | null> {
  if (!profileId) return null;

  const { data, error } = await (supabase as any)
    .from("public_profile_privacy_settings")
    .select("profile_id,profile_visibility,dm_permission,allow_band_invites,allow_company_invites")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    profileId: String(data.profile_id),
    profileVisibility: visibilityScopeSchema.parse(data.profile_visibility),
    dmPermission: dmPermissionSchema.parse(data.dm_permission),
    allowBandInvites: Boolean(data.allow_band_invites),
    allowCompanyInvites: Boolean(data.allow_company_invites),
  };
}

export const socialPrivacyFieldLabels: Record<keyof typeof DB_TO_CLIENT, string> = {
  profile_visibility: "Profile visibility",
  city_visibility: "Current city",
  activity_visibility: "Current activity",
  online_status_visibility: "Online status",
  relationship_visibility: "Relationship details",
  dm_permission: "Direct messages",
  allow_band_invites: "Band invitations",
  allow_company_invites: "Company invitations",
};
