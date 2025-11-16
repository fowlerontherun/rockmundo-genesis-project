import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, DollarSign, Star, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GigsAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gigs Administration</h1>
            <p className="text-muted-foreground">Manage gig mechanics, payouts, and performance calculations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payout Formulas
              </CardTitle>
              <CardDescription>
                Configure how gig earnings are calculated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set base pay rates, venue multipliers, and attendance-based bonuses.</p>
              <Button className="w-full">Configure Payouts</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Performance Ratings
              </CardTitle>
              <CardDescription>
                Manage performance quality calculation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure how skills, chemistry, and setlist quality affect performance scores.</p>
              <Button className="w-full">Manage Ratings</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Gig Types
              </CardTitle>
              <CardDescription>
                Configure available gig types and requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set up different gig types with unique requirements and rewards.</p>
              <Button className="w-full">Manage Gig Types</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Fame & Hype
              </CardTitle>
              <CardDescription>
                Configure fame and hype generation from gigs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Adjust how gig performance translates to fame, hype, and audience growth.</p>
              <Button className="w-full">Configure Fame</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default GigsAdmin;
