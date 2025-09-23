import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const RehabPage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Rehab Programs</h1>
        <p className="text-muted-foreground">
          Coordinate intensive recovery tracks after injuries, burnout, or demanding tour schedules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In Development</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The rehab planner will surface local facilities, outline timelines, and keep your crew informed about
            progress milestones.
          </p>
          <Separator />
          <ul className="list-disc space-y-2 pl-4">
            <li>Assign specialized rehab partners and support staff.</li>
            <li>Track daily recovery activities and rest compliance.</li>
            <li>Balance show commitments with medically approved workloads.</li>
          </ul>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link to="/health">Back to Health Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RehabPage;
