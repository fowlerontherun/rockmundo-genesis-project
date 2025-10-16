import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

interface MyPurchasesTabProps {
  userId: string;
}

export const MyPurchasesTab = ({ userId }: MyPurchasesTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          My Purchases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          View songs you've purchased from the marketplace. Feature coming soon.
        </p>
      </CardContent>
    </Card>
  );
};
