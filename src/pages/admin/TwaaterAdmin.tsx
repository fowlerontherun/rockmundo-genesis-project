import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Twitter, Shield, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TwaaterAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Twaater Administration</h1>
            <p className="text-muted-foreground">Manage social media platform, moderation, and engagement</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Content Moderation
              </CardTitle>
              <CardDescription>
                Review and moderate user posts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Monitor posts, handle reports, and manage content violations.</p>
              <Button className="w-full" onClick={() => navigate("/admin/twaater-moderation")}>
                Open Moderation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Algorithm
              </CardTitle>
              <CardDescription>
                Configure what makes posts go viral
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Adjust engagement weights, timing factors, and viral thresholds.</p>
              <Button className="w-full">Configure Trending</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Engagement Mechanics
              </CardTitle>
              <CardDescription>
                Manage likes, shares, and follower systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure how engagement affects fame, reach, and fan conversion.</p>
              <Button className="w-full">Configure Engagement</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5" />
                Platform Features
              </CardTitle>
              <CardDescription>
                Enable/disable platform features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Control availability of hashtags, verified badges, and premium features.</p>
              <Button className="w-full">Manage Features</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default TwaaterAdmin;
