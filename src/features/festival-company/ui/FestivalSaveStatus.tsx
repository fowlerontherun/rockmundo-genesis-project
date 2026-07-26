export function FestivalSaveStatus({
  pending,
  conflict,
  dirty,
  failed,
  readOnly,
  savedAt,
}: {
  pending: boolean;
  conflict: boolean;
  dirty: boolean;
  failed: boolean;
  readOnly: boolean;
  savedAt: string | null;
}) {
  let text = "No unsaved changes";
  if (readOnly) text = "Read-only";
  else if (pending) text = "Saving…";
  else if (conflict) text = "A newer saved version exists";
  else if (failed) text = "Save failed";
  else if (dirty) text = "Unsaved changes";
  else if (savedAt)
    text = `Saved at ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(savedAt))}`;
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="text-sm text-muted-foreground"
    >
      {text}
    </p>
  );
}
