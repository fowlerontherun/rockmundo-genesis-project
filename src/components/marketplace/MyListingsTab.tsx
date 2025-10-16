import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface MyListingsTabProps {
  userId: string;
}

export const MyListingsTab = ({ userId }: MyListingsTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          My Listings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Create and manage your song listings. Feature coming soon.
        </p>
      </CardContent>
    </Card>
  );
};
