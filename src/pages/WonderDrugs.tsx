import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const WonderDrugsPage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Wonder Drugs</h1>
        <p className="text-muted-foreground">
          Explore experimental treatments and supplements under strict medical supervision.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Concept Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Future updates will introduce risk-versus-reward decisions, sourcing challenges, and compliance tracking
            for cutting-edge therapies.
          </p>
          <Separator />
          <ul className="list-disc space-y-2 pl-4">
            <li>Compare performance boosts against potential side effects.</li>
            <li>Secure approvals from doctors, management, and league officials.</li>
            <li>Monitor withdrawal windows before major shows or competitions.</li>
          </ul>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link to="/health">Back to Health Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WonderDrugsPage;
