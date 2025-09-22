import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PlayerBoosts() {
  return (
    <AdminRoute>
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Player Boosts</h1>
          <p className="text-muted-foreground">
            Configure temporary boosts and acceleration modifiers that can be assigned to individual
            players. This placeholder will evolve into the full management interface.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              The Player Boosts admin tool is under construction. Check back soon to manage custom
              boost windows and reward schedules.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Once completed you&apos;ll be able to:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Define boost templates with duration, effect, and eligibility rules.</li>
              <li>Grant boosts directly to specific player profiles or cohorts.</li>
              <li>Review historical boost activity and upcoming expirations.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
