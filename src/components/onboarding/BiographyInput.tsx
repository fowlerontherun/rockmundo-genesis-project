import { useMemo } from "react";

export interface BiographyInputProps {
  value?: string;
  onChange?: (nextValue: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

const DEFAULT_MAX_LENGTH = 280;

export const BiographyInput = ({
  value = "",
  onChange,
  maxLength = DEFAULT_MAX_LENGTH,
  disabled = false,
}: BiographyInputProps) => {
  const remaining = useMemo(() => Math.max(maxLength - value.length, 0), [value.length, maxLength]);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Short biography</span>
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value.slice(0, maxLength))}
          placeholder="Share a quick intro, musical influences, or goals for your journey."
          className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          maxLength={maxLength}
          disabled={disabled}
        />
      </label>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Keep it concise—players will see this on your profile.</span>
        <span>
          {remaining}
          {" "}characters left
        </span>
      </div>
    </div>
  );
};

export default BiographyInput;
