import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyFestivalConditions } from "./useFestivalDayPlanner";

const conditionLabels = [
  ["energy", "Energy"],
  ["hunger", "Hunger"],
  ["hydration", "Hydration"],
  ["mood", "Mood"],
  ["intoxication", "Intoxication"],
  ["social", "Social"],
] as const;

export const FestivalConditionPanel = ({ attendanceId }: { attendanceId: string }) => {
  const { data, isLoading, isError } = useMyFestivalConditions(attendanceId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Festival condition</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" role="status">Checking how you’re doing…</p>
        ) : isError || !data ? (
          <p className="text-sm text-destructive" role="alert">Your Festival condition could not be loaded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {conditionLabels.map(([key, label]) => (
              <div key={key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="tabular-nums text-muted-foreground">{data[key]}/100</span>
                </div>
                <progress
                  className="mt-2 h-2 w-full"
                  max={100}
                  value={data[key]}
                  aria-label={`${label} ${data[key]} out of 100`}
                />
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          These are temporary Festival stats. They evolve on the server while you are checked in; Hunger and Intoxication are higher when the meter is fuller.
        </p>
      </CardContent>
    </Card>
  );
};

export default FestivalConditionPanel;
