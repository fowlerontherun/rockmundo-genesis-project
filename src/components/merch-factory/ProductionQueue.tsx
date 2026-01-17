import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Clock, CheckCircle, Truck, XCircle } from "lucide-react";
import { useProductionQueue, useUpdateProductionStatus } from "@/hooks/useMerchFactory";
import { formatDistanceToNow } from "date-fns";

interface ProductionQueueProps {
  factoryId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  in_production: { label: 'In Production', variant: 'default' as const, icon: ClipboardList },
  quality_check: { label: 'Quality Check', variant: 'outline' as const, icon: CheckCircle },
  completed: { label: 'Completed', variant: 'default' as const, icon: CheckCircle },
  shipped: { label: 'Shipped', variant: 'default' as const, icon: Truck },
  cancelled: { label: 'Cancelled', variant: 'destructive' as const, icon: XCircle },
};

export function ProductionQueue({ factoryId }: ProductionQueueProps) {
  const { data: orders, isLoading } = useProductionQueue(factoryId);
  const updateStatus = useUpdateProductionStatus();
  
  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatus.mutate({ orderId, status: newStatus, factoryId });
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading production queue...</div>;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Production Queue
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No orders in queue</p>
            <p className="text-sm">Orders from bands will appear here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => {
                const statusInfo = STATUS_CONFIG[order.status];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.product?.product_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {order.client_band?.name || 'Direct Order'}
                    </TableCell>
                    <TableCell className="text-right">{order.quantity}</TableCell>
                    <TableCell className="text-right">${order.total_cost}</TableCell>
                    <TableCell>
                      <Badge variant="outline">P{order.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {order.status !== 'shipped' && order.status !== 'cancelled' && (
                        <Select 
                          value={order.status} 
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_production">In Production</SelectItem>
                            <SelectItem value="quality_check">Quality Check</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
