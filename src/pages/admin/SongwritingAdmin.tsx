import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Music, BookOpen, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SongwritingAdmin = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Songwriting Administration</h1>
            <p className="text-muted-foreground">Manage songwriting mechanics, chord progressions, and quality multipliers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Chord Progressions
              </CardTitle>
              <CardDescription>
                Manage available chord progressions and their difficulty ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Configure the chord progressions available for songwriting and their impact on song quality.</p>
              <Button className="w-full">Manage Progressions</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Genre Templates
              </CardTitle>
              <CardDescription>
                Configure genre-specific songwriting attributes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Set up genre templates with base quality modifiers and style requirements.</p>
              <Button className="w-full">Manage Templates</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quality Multipliers
              </CardTitle>
              <CardDescription>
                Configure quality calculation formulas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Adjust how skills, collaboration, and other factors affect song quality.</p>
              <Button className="w-full">Configure Multipliers</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default SongwritingAdmin;
