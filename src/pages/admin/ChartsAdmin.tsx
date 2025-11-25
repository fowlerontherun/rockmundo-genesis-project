import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Globe, Award, BarChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ChartsAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Charts Administration</h1>
            <p className="text-muted-foreground">Manage music charts, rankings, and trending algorithms</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Chart Types
              </CardTitle>
              <CardDescription>
                Configure available chart categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Manage global, regional, and genre-specific charts with custom ranking criteria.</p>
              <Button className="w-full">Manage Charts</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Ranking Algorithms
              </CardTitle>
              <CardDescription>
                Configure how songs are ranked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set weights for streams, sales, radio plays, and social engagement in rankings.</p>
              <Button className="w-full">Configure Algorithms</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Charts
              </CardTitle>
              <CardDescription>
                Manage country and city-specific charts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure regional charts with local genre preferences and trending factors.</p>
              <Button className="w-full">Manage Regions</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Chart Rewards
              </CardTitle>
              <CardDescription>
                Configure rewards for chart positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set up fame, cash, and other rewards for reaching chart milestones.</p>
              <Button className="w-full">Configure Rewards</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default ChartsAdmin;
