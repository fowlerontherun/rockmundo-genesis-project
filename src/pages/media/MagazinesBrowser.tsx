import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Construction } from "lucide-react";

const MagazinesBrowser = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          Magazines
        </h1>
        <p className="text-muted-foreground">
          Browse magazines for features and interview opportunities
        </p>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The magazine directory is being prepared. Check back soon for feature opportunities!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MagazinesBrowser;
