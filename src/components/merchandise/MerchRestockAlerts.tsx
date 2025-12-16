import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, RefreshCw } from "lucide-react";

interface RestockItem {
  id: string;
  name: string;
  currentStock: number;
  threshold: number;
  category: string;
}

interface MerchRestockAlertsProps {
  items: RestockItem[];
  onRestock?: (itemId: string) => void;
}

export const MerchRestockAlerts = ({ items, onRestock }: MerchRestockAlertsProps) => {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">All items are well stocked!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-orange-500">
          <AlertTriangle className="h-4 w-4" />
          Low Stock Alerts ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const isVeryLow = item.currentStock <= item.threshold / 2;
          
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isVeryLow ? "bg-red-500/10 border border-red-500/30" : "bg-orange-500/10 border border-orange-500/30"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.name}</span>
                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />
                  <span className={isVeryLow ? "text-red-500 font-medium" : "text-orange-500"}>
                    {item.currentStock} left
                  </span>
                  <span>/ min {item.threshold}</span>
                </div>
              </div>
              {onRestock && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRestock(item.id)}
                  className="shrink-0"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restock
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
