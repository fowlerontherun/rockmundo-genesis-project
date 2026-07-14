import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface MCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}

export const MCard = forwardRef<HTMLDivElement, MCardProps>(
  ({ title, subtitle, icon, right, chevron, onPress, className, children, ...rest }, ref) => {
    const clickable = !!onPress;
    return (
      <div
        ref={ref}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={onPress}
        onKeyDown={(e) => {
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onPress?.();
          }
        }}
        className={cn(
          "rm-mcard p-4 flex flex-col gap-2 active:scale-[0.99] transition-transform",
          clickable && "cursor-pointer",
          className,
        )}
        {...rest}
      >
        {(title || icon || right || chevron) && (
          <div className="flex items-center gap-3">
            {icon && (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && <div className="font-semibold text-[15px] leading-tight truncate">{title}</div>}
              {subtitle && (
                <div className="text-[12px] text-muted-foreground leading-tight truncate mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
            {right}
            {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        )}
        {children}
      </div>
    );
  },
);
MCard.displayName = "MCard";
