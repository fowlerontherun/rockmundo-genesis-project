import { getCountryFlag, getCountryIsoCode } from "@/data/countryData";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "flag-icons/css/flag-icons.min.css";

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

const flagIconSizes = {
  sm: "w-5 h-4",
  md: "w-7 h-5",
  lg: "w-10 h-7",
  xl: "w-14 h-10"
};

export const CountryFlag = ({ 
  country, 
  size = "md", 
  showTooltip = true,
  className 
}: CountryFlagProps) => {
  const isoCode = getCountryIsoCode(country);
  
  // Use CSS flag-icons if ISO code is available (renders on all platforms including Windows)
  // Fall back to emoji otherwise
  const flagElement = isoCode ? (
    <span
      className={cn(
        `fi fi-${isoCode}`,
        flagIconSizes[size],
        "inline-block rounded-sm",
        className
      )}
      role="img"
      aria-label={`${country} flag`}
      style={{ backgroundSize: 'cover' }}
    />
  ) : (
    <span 
      className={cn(
        sizeClasses[size],
        "inline-block leading-none",
        className
      )}
      role="img"
      aria-label={`${country} flag`}
    >
      {getCountryFlag(country)}
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
