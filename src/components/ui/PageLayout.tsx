import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}

export const PageLayout = ({ children, wide = false, className }: PageLayoutProps) => {
  return (
    <div
      className={cn(
        "container mx-auto px-4 py-6 space-y-6",
        !wide && "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  );
};
