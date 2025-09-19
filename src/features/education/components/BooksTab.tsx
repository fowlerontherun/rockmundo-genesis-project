import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useEducationBookCollections } from "../hooks/useEducationBookCollections";

export const BooksTab = () => {
  const collections = useEducationBookCollections();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curated Reading Tracks</CardTitle>
        <CardDescription>
          Start with foundational skills, then branch into creative mastery and business strategy as you grow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => (
          <Card key={collection.title} className="border-dashed">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-lg">{collection.title}</CardTitle>
                <Badge variant="secondary">{collection.items.length} titles</Badge>
              </div>
              <CardDescription>{collection.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {collection.items.map((item) => (
                <div key={item.name} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.author}</p>
                    </div>
                    <Badge variant="outline" className="whitespace-nowrap text-xs">
                      {item.focus}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{item.takeaway}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
