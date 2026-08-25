import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const LAST_SEEN_KEY = "rockmundo.admin_bug_reports.last_seen";

const AdminBugReportNotifier = () => {
  const { hasRole, loading } = useUserRole();
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    if (loading || !hasRole("admin") || initialized.current) return;
    initialized.current = true;

    const nowIso = new Date().toISOString();
    const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);

    const notifyMissedReports = async () => {
      if (!lastSeen) {
        window.localStorage.setItem(LAST_SEEN_KEY, nowIso);
        return;
      }

      const { count, error } = await (supabase as any)
        .from("bug_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .gt("created_at", lastSeen);

      if (!error && count && count > 0) {
        toast.warning(`${count} new bug report${count === 1 ? "" : "s"} since your last session`, {
          description: "Open Admin to review the new reports.",
          action: {
            label: "Review",
            onClick: () => navigate("/admin"),
          },
          duration: 10000,
        });
      }

      window.localStorage.setItem(LAST_SEEN_KEY, nowIso);
    };

    void notifyMissedReports();

    const channel = supabase
      .channel("admin-bug-report-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bug_reports" },
        (payload) => {
          const report = payload.new as {
            id?: string;
            title?: string;
            severity?: string;
            category?: string;
            created_at?: string;
          };
          const severity = (report.severity ?? "medium").toUpperCase();
          const title = report.title?.trim() || "New bug report";

          toast.error(`[${severity}] ${title}`, {
            description: `A new ${report.category ?? "other"} bug report was submitted.`,
            action: {
              label: "Review",
              onClick: () => navigate("/admin"),
            },
            duration: 15000,
          });

          window.localStorage.setItem(
            LAST_SEEN_KEY,
            report.created_at ?? new Date().toISOString(),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      initialized.current = false;
    };
  }, [hasRole, loading, navigate]);

  return null;
};

export default AdminBugReportNotifier;
