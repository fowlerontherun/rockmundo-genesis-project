import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const CosmeticSurgeryPage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Cosmetic Surgery</h1>
        <p className="text-muted-foreground">
          Plan elective procedures while balancing recovery timelines and public relations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This feature will allow you to weigh brand opportunities, downtime, and medical risks before proceeding
            with cosmetic changes.
          </p>
          <Separator />
          <ul className="list-disc space-y-2 pl-4">
            <li>Consult with specialists and align recovery with tour gaps.</li>
            <li>Track cost estimates alongside insurance coverage.</li>
            <li>Coordinate media strategies to manage fan expectations.</li>
          </ul>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link to="/health">Back to Health Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CosmeticSurgeryPage;
