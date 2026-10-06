import { CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  accountId?: string;
  className?: string;
}

export const VerifiedBadge = ({ className }: VerifiedBadgeProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <CheckCircle2
          className={className || "h-4 w-4"}
          style={{ color: "hsl(var(--twaater-purple))" }}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Verified account</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
