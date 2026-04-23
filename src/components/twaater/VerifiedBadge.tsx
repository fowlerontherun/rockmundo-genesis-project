import { CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VerifiedBadgeProps {
  accountId?: string;
  className?: string;
}

const REASON_LABEL: Record<string, string> = {
  fame_threshold: "Fame ≥ 10,000",
  award_winner: "Award winner",
  top_100_chart: "Top-100 charting artist",
};

export const VerifiedBadge = ({ accountId, className }: VerifiedBadgeProps) => {
  const { data } = useQuery({
    queryKey: ["twaater-verification-reason", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("twaater_verification_log")
        .select("reason, granted_at")
        .eq("account_id", accountId!)
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const reason = data?.reason ? REASON_LABEL[data.reason] || data.reason : "Verified account";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCircle2
            className={className || "h-4 w-4"}
            style={{ color: "hsl(var(--twaater-purple))" }}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Verified · {reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
