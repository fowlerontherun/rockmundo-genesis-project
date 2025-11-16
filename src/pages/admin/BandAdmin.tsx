import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Heart, Shield, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BandAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Band & Chemistry Administration</h1>
            <p className="text-muted-foreground">Manage band mechanics, chemistry systems, and collaboration features</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Chemistry System
              </CardTitle>
              <CardDescription>
                Configure chemistry calculation and effects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Adjust how chemistry is gained, lost, and impacts band performance.</p>
              <Button className="w-full">Configure Chemistry</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Band Limits
              </CardTitle>
              <CardDescription>
                Manage band size and member restrictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set maximum members, touring member limits, and role requirements.</p>
              <Button className="w-full">Configure Limits</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Leadership System
              </CardTitle>
              <CardDescription>
                Configure leadership voting and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Manage voting frequency, leader permissions, and band decisions.</p>
              <Button className="w-full">Configure Leadership</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Collaboration Bonuses
              </CardTitle>
              <CardDescription>
                Set bonuses for band activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure chemistry bonuses for songwriting, performances, and rehearsals.</p>
              <Button className="w-full">Configure Bonuses</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default BandAdmin;
