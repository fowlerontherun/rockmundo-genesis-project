import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const TherapyPage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Therapy Services</h1>
        <p className="text-muted-foreground">
          Work with trusted mental health professionals to help your artist decompress between tour legs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The therapy module will let you schedule guided sessions, track wellbeing goals, and receive progress
            updates from your support staff.
          </p>
          <Separator />
          <ul className="list-disc space-y-2 pl-4">
            <li>Plan recurring check-ins with performance psychologists.</li>
            <li>Review mindfulness routines tailored to high-pressure events.</li>
            <li>Coordinate with your manager to align wellness and touring calendars.</li>
          </ul>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link to="/health">Back to Health Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TherapyPage;
