import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const socialReportTargetTypeSchema = z.enum([
  "profile",
  "direct_message",
  "social_invite",
  "band",
  "company",
  "twaater_post",
  "chat_message",
  "other",
]);
export const socialReportCategorySchema = z.enum([
  "harassment",
  "spam",
  "hate",
  "sexual_content",
  "threats",
  "impersonation",
  "scam",
  "self_harm",
  "other",
]);

const uuidSchema = z.string().uuid();
const noteSchema = z.string().trim().max(280, "Notes must be 280 characters or fewer").optional();

export const reportSocialTargetInputSchema = z.object({
  reportedProfileId: uuidSchema.optional().nullable(),
  targetType: socialReportTargetTypeSchema,
  targetId: uuidSchema.optional().nullable(),
  category: socialReportCategorySchema,
  reason: z.string().trim().min(10, "Tell moderators what happened in at least 10 characters").max(2000, "Reports must be 2000 characters or fewer"),
  context: z.record(z.unknown()).optional().default({}),
}).refine((value) => Boolean(value.reportedProfileId || value.targetId), {
  message: "Choose a player or social item to report",
  path: ["reportedProfileId"],
});

export type SocialReportTargetType = z.infer<typeof socialReportTargetTypeSchema>;
export type SocialReportCategory = z.infer<typeof socialReportCategorySchema>;
export type ReportSocialTargetInput = z.input<typeof reportSocialTargetInputSchema>;

export interface SocialSafetyStatus {
  isBlocked: boolean;
  isMuted: boolean;
}

export async function fetchSocialSafetyStatus(viewerProfileId: string, targetProfileId: string): Promise<SocialSafetyStatus> {
  uuidSchema.parse(viewerProfileId);
  uuidSchema.parse(targetProfileId);

  const [{ data: isBlocked, error: blockError }, { data: isMuted, error: muteError }] = await Promise.all([
    (supabase as any).rpc("are_profiles_blocked", { first_profile_id: viewerProfileId, second_profile_id: targetProfileId }),
    (supabase as any).rpc("is_profile_muted", { viewer_profile_id: viewerProfileId, target_profile_id: targetProfileId }),
  ]);

  if (blockError) throw blockError;
  if (muteError) throw muteError;

  return { isBlocked: Boolean(isBlocked), isMuted: Boolean(isMuted) };
}

export async function blockProfile(targetProfileId: string, note?: string) {
  uuidSchema.parse(targetProfileId);
  const parsedNote = noteSchema.parse(note);
  const { data, error } = await (supabase as any).rpc("block_profile", {
    target_profile_id: targetProfileId,
    note: parsedNote || null,
  });
  if (error) throw error;
  return data;
}

export async function unblockProfile(targetProfileId: string): Promise<boolean> {
  uuidSchema.parse(targetProfileId);
  const { data, error } = await (supabase as any).rpc("unblock_profile", { target_profile_id: targetProfileId });
  if (error) throw error;
  return Boolean(data);
}

export async function muteProfile(targetProfileId: string, note?: string, muteUntil?: string | null) {
  uuidSchema.parse(targetProfileId);
  const parsedNote = noteSchema.parse(note);
  const { data, error } = await (supabase as any).rpc("mute_profile", {
    target_profile_id: targetProfileId,
    mute_until: muteUntil ?? null,
    note: parsedNote || null,
  });
  if (error) throw error;
  return data;
}

export async function unmuteProfile(targetProfileId: string): Promise<boolean> {
  uuidSchema.parse(targetProfileId);
  const { data, error } = await (supabase as any).rpc("unmute_profile", { target_profile_id: targetProfileId });
  if (error) throw error;
  return Boolean(data);
}

export async function reportSocialTarget(input: ReportSocialTargetInput) {
  const parsed = reportSocialTargetInputSchema.parse(input);
  const { data, error } = await (supabase as any).rpc("report_social_target", {
    reported_profile_id: parsed.reportedProfileId ?? null,
    target_type: parsed.targetType,
    target_id: parsed.targetId ?? null,
    category: parsed.category,
    reason: parsed.reason,
    context: parsed.context,
  });
  if (error) throw error;
  return data;
}

export const socialReportCategoryLabels: Record<SocialReportCategory, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam or repeated unwanted contact",
  hate: "Hate or hateful conduct",
  sexual_content: "Sexual content",
  threats: "Threats or violence",
  impersonation: "Impersonation",
  scam: "Scam or fraud",
  self_harm: "Self-harm concern",
  other: "Other safety issue",
};
