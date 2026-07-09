import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  /** Retained for API compat; ignored — every page is full-width on desktop. */
  wide?: boolean;
  className?: string;
}

/**
 * Desktop-only page wrapper. Uses the full FM-shell content width with light
 * horizontal padding.
 */
export const PageLayout = ({ children, className }: PageLayoutProps) => {
  return (
    <div className={cn("w-full px-2 py-3 sm:px-3 lg:px-4 space-y-4", className)}>
      {children}
    </div>
  );
};
