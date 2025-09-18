import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { EquippedClothingItem } from "@/hooks/useEquippedClothing";
import { formatClothingSlot } from "@/utils/wardrobe";
import type { FC, ReactNode } from "react";

const overlayPositions = [
  "top-2 left-2",
  "top-2 right-2",
  "bottom-2 left-2",
  "bottom-2 right-2",
];

export interface AvatarWithClothingProps {
  avatarUrl?: string | null;
  fallbackText?: string | null;
  items: EquippedClothingItem[];
  size?: number;
  className?: string;
  badgeClassName?: string;
  children?: ReactNode;
}

export const AvatarWithClothing: FC<AvatarWithClothingProps> = ({
  avatarUrl,
  fallbackText,
  items,
  size = 128,
  className,
  badgeClassName,
  children,
}) => {
  const fallbackInitials = (fallbackText ?? "?")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <div className={cn("relative inline-flex flex-col items-center gap-3", className)}>
      <div
        className="relative"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <Avatar className="h-full w-full border-4 border-primary/30 shadow-lg">
          <AvatarImage src={avatarUrl ?? undefined} alt={fallbackText ?? "Player avatar"} />
          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground text-xl">
            {fallbackInitials || "RM"}
          </AvatarFallback>
        </Avatar>
        {items.length > 0 ? (
          <div className="absolute inset-0 pointer-events-none">
            {items.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "absolute rounded-full bg-primary/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-lg",
                  overlayPositions[index % overlayPositions.length],
                  badgeClassName
                )}
              >
                {formatClothingSlot(item.slot)}
              </span>
            ))}
          </div>
        ) : null}
        {children}
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {items.map((item) => (
            <Badge key={item.id} variant="outline" className="bg-card/70 text-xs capitalize">
              {formatClothingSlot(item.slot)} • {item.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No clothing equipped yet.</p>
      )}
    </div>
  );
};

export default AvatarWithClothing;
