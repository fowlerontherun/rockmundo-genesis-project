import { supabase } from "@/integrations/supabase/client";
import type { ReportCategory } from "./config";

export interface SubmitPlayerReportInput {
  reportedProfileId: string;
  category: ReportCategory;
  description: string;
  contentType?: "profile" | "direct_message" | "social_invite" | "band" | "company" | "twaater_post" | "chat_message" | "other";
  contentId?: string | null;
  context?: Record<string, unknown>;
  blockAfterReport?: boolean;
}

export async function submitPlayerReport(input: SubmitPlayerReportInput) {
  const description = input.description.trim();
  if (description.length < 10) throw new Error("Describe what happened in at least 10 characters.");
  if (description.length > 2000) throw new Error("Reports must be 2,000 characters or fewer.");

  const { data, error } = await (supabase as any).rpc("report_social_target", {
    reported_profile_id: input.reportedProfileId,
    target_type: input.contentType ?? "profile",
    target_id: input.contentId ?? null,
    category: input.category,
    reason: description.replace(/[<>]/g, ""),
    context: input.context ?? {},
    block_after_report: input.blockAfterReport ?? false,
  });
  if (error) throw new Error(normalizeReportError(error.message));
  return data;
}

export async function fetchMyReports() {
  const { data, error } = await (supabase as any)
    .from("social_reports")
    .select("id, reported_profile_id, target_type, category, status, created_at, updated_at, resolved_at, context")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Reports are unavailable right now.");
  return data ?? [];
}

function normalizeReportError(message?: string) {
  if (!message) return "Report submission failed. Please try again.";
  if (/already|duplicate|23505/i.test(message)) return "Your report has already been submitted for review.";
  if (/wait|429/i.test(message)) return "Please wait before submitting another report.";
  if (/yourself/i.test(message)) return "You cannot report yourself.";
  return message.replace(/[<>]/g, "");
}
