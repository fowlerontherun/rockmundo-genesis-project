import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVipStatus } from "@/hooks/useVipStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VipBadgeProps {
  className?: string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

export const VipBadge = ({ className, showTooltip = true, size = "md" }: VipBadgeProps) => {
  const { data: vipStatus, isLoading } = useVipStatus();

  if (isLoading || !vipStatus?.isVip) {
    return null;
  }

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const containerSizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-2.5 py-1.5 text-sm",
  };

  const badge = (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-bold",
          "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400",
          "text-amber-900 shadow-lg",
          "animate-pulse",
          "relative overflow-hidden",
          containerSizeClasses[size],
          className
        )}
      >
        {/* Glitter overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          style={{
            animation: "shimmer 2s infinite linear",
          }}
        />
        
        <Crown className={cn(sizeClasses[size], "relative z-10 drop-shadow-sm")} />
        <span className="relative z-10 tracking-wide">VIP</span>
        
        {/* Sparkle particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: "0s", animationDuration: "1.5s" }} />
          <div className="absolute bottom-0 right-1/4 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: "0.5s", animationDuration: "1.5s" }} />
          <div className="absolute top-1/2 right-0 w-0.5 h-0.5 bg-yellow-100 rounded-full animate-ping" style={{ animationDelay: "1s", animationDuration: "1.5s" }} />
        </div>
      </div>
      {/* Days remaining indicator */}
      {vipStatus.daysRemaining !== null && (
        <span className="text-xs font-medium text-warning">
          {vipStatus.daysRemaining}d
        </span>
      )}
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  const getSubscriptionLabel = () => {
    switch (vipStatus.subscriptionType) {
      case 'trial':
        return 'Free Trial';
      case 'gifted':
        return 'Gift';
      case 'paid':
        return 'Premium';
      default:
        return 'VIP';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="bg-gradient-to-r from-amber-900 to-yellow-900 border-amber-500/50">
          <div className="text-amber-100">
            <p className="font-semibold">VIP {getSubscriptionLabel()}</p>
            {vipStatus.daysRemaining !== null && (
              <p className="text-amber-200/80 text-xs">
                {vipStatus.daysRemaining} days remaining
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
