import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: string;
  description?: string;
  heroImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  title,
  description,
  heroImageUrl,
  backgroundImageUrl,
  children,
  className,
}: PageHeroProps) {
  const hasBackground = backgroundImageUrl || heroImageUrl;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        hasBackground && "min-h-[200px] md:min-h-[300px]",
        className
      )}
      style={
        backgroundImageUrl
          ? {
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Overlay for better text readability */}
      {hasBackground && (
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />
      )}

      <div className="relative z-10 p-6 md:p-8">
        {heroImageUrl && !backgroundImageUrl && (
          <div className="mb-4 aspect-video md:aspect-[21/9] overflow-hidden rounded-md">
            <img
              src={heroImageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {children && <div className="mt-4 md:mt-6">{children}</div>}
      </div>
    </div>
  );
}
