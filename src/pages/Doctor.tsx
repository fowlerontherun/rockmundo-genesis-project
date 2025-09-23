import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const DoctorPage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Primary Doctor</h1>
        <p className="text-muted-foreground">
          Manage regular checkups, track prescriptions, and keep your touring crew informed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roadmap Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Soon you will be able to share lab results, manage appointments, and set reminders directly with your
            primary care physician.
          </p>
          <Separator />
          <ul className="list-disc space-y-2 pl-4">
            <li>Keep vaccination and preventive care schedules up to date.</li>
            <li>Log prescriptions and dosage adjustments across the team.</li>
            <li>Receive alerts when medical clearance is required for events.</li>
          </ul>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link to="/health">Back to Health Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorPage;
