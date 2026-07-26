import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export function FestivalConflictAlert({
  onReload,
  onKeep,
  loading,
}: {
  onReload: () => void;
  onKeep: () => void;
  loading: boolean;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>A newer saved version exists</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Another session changed this festival. Your unsaved local draft has
          been preserved and will not overwrite the newer version.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" disabled={loading} onClick={onReload}>
            Reload latest saved version
          </Button>
          <Button type="button" variant="outline" onClick={onKeep}>
            Keep editing locally
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
