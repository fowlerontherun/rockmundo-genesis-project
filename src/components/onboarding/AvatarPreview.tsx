import { useEffect, useMemo, useState } from "react";

export interface AvatarPreviewProps {
  value?: string | null;
  onChange?: (nextValue: string) => void;
  placeholderInitials?: string;
  disabled?: boolean;
}

const getInitials = (input?: string | null): string => {
  if (!input) {
    return "??";
  }

  const matches = input
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");

  return matches || "??";
};

export const AvatarPreview = ({
  value,
  onChange,
  placeholderInitials,
  disabled = false,
}: AvatarPreviewProps) => {
  const initials = useMemo(() => getInitials(placeholderInitials), [placeholderInitials]);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [value]);

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm">
          {value && !hasImageError ? (
            <img
              src={value}
              alt="Selected avatar"
              className="h-full w-full object-cover"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Use an image URL or keep the generated initials for now.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Avatar image URL</span>
          <input
            type="url"
            value={value ?? ""}
            onChange={(event) => onChange?.(event.target.value)}
            placeholder="https://example.com/my-avatar.png"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            disabled={disabled}
          />
        </label>
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Image uploads are coming soon. For now, paste an image link from a trusted source to personalize your character.
        </div>
      </div>
    </div>
  );
};

export default AvatarPreview;
