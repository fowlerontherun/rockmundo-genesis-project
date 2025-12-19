import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Construction } from "lucide-react";

const NewspapersBrowser = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Newspaper className="h-8 w-8 text-primary" />
          Newspapers
        </h1>
        <p className="text-muted-foreground">
          Browse newspapers for press coverage and interview opportunities
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
            The newspaper directory is being prepared. Check back soon for press coverage opportunities!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewspapersBrowser;
