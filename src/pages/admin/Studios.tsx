import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music2, Users } from "lucide-react";

const StudiosAdmin = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Studio Management</h1>
        <p className="text-muted-foreground">Manage recording studios and producers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              City Studios
            </CardTitle>
            <CardDescription>
              Manage recording studios in different cities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/city-studios')} className="w-full">
              Manage City Studios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recording Producers
            </CardTitle>
            <CardDescription>
              Manage recording producers and their skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/producers')} className="w-full">
              Manage Producers
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudiosAdmin;