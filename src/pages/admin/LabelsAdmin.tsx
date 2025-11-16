import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Disc, FileText, DollarSign, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LabelsAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Record Labels Administration</h1>
            <p className="text-muted-foreground">Manage record labels, contracts, and deal structures</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Disc className="h-5 w-5" />
                Label Management
              </CardTitle>
              <CardDescription>
                Configure record labels and their rosters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Create and manage record labels with budgets, genres, and roster limits.</p>
              <Button className="w-full">Manage Labels</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Deal Types
              </CardTitle>
              <CardDescription>
                Configure contract templates and terms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set up deal structures like 360 deals, distribution deals, and traditional contracts.</p>
              <Button className="w-full">Manage Deal Types</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Royalty Systems
              </CardTitle>
              <CardDescription>
                Configure royalty splits and recoupment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Manage how royalties are calculated, split, and paid out to artists.</p>
              <Button className="w-full">Configure Royalties</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                A&R System
              </CardTitle>
              <CardDescription>
                Manage scouting and signing mechanics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure how labels discover, evaluate, and sign new artists.</p>
              <Button className="w-full">Configure A&R</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default LabelsAdmin;
