import { getCountryFlag } from "@/data/countryData";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CountryFlagProps {
  country: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl"
};

export const CountryFlag = ({ 
  country, 
  size = "md", 
  showTooltip = true,
  className 
}: CountryFlagProps) => {
  const flag = getCountryFlag(country);
  
  const flagElement = (
    <span 
      className={cn(
        sizeClasses[size],
        "inline-block leading-none",
        className
      )}
      role="img"
      aria-label={`${country} flag`}
    >
      {flag}
    </span>
  );

  if (!showTooltip) {
    return flagElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {flagElement}
        </TooltipTrigger>
        <TooltipContent>
          <p>{country}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
