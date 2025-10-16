import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface RoyaltiesTabProps {
  userId: string;
}

export const RoyaltiesTab = ({ userId }: RoyaltiesTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Royalty Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Track streaming royalties from sold songs. Feature coming soon.
        </p>
      </CardContent>
    </Card>
  );
};
