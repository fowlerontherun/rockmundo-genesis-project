import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Receipt, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useCompanyTaxRecords, usePayCompanyTax, CompanyTaxRecord } from "@/hooks/useCompanyFinance";

interface CompanyTaxOverviewProps {
  companyId: string;
  companyBalance: number;
}

export function CompanyTaxOverview({ companyId, companyBalance }: CompanyTaxOverviewProps) {
  const { data: taxRecords = [], isLoading } = useCompanyTaxRecords(companyId);
  const payTaxMutation = usePayCompanyTax();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pendingTaxes = taxRecords.filter(t => t.status === 'pending' || t.status === 'overdue');
  const totalPendingAmount = pendingTaxes.reduce((sum, t) => sum + Number(t.tax_amount), 0);

  const handlePayTax = async (taxRecord: CompanyTaxRecord) => {
    await payTaxMutation.mutateAsync({
      taxRecordId: taxRecord.id,
      companyId: companyId,
    });
  };

  const getStatusBadge = (record: CompanyTaxRecord) => {
    if (record.status === 'paid') {
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Paid</Badge>;
    }
    if (record.status === 'overdue' || isPast(new Date(record.due_date))) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {pendingTaxes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Tax Obligations
              </CardTitle>
              <Badge variant="outline" className="text-amber-500 border-amber-500">
                {pendingTaxes.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">
              {formatCurrency(totalPendingAmount)}
            </p>
            <p className="text-sm text-muted-foreground">
              Total amount due
            </p>
            {companyBalance < totalPendingAmount && (
              <p className="text-xs text-destructive mt-2">
                ⚠️ Insufficient funds to pay all taxes
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tax Records List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Tax History
          </CardTitle>
          <CardDescription>Monthly corporate tax records</CardDescription>
        </CardHeader>
        <CardContent>
          {taxRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No tax records yet</p>
              <p className="text-sm">Taxes are calculated monthly based on company revenue</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {taxRecords.map((record) => (
                  <div 
                    key={record.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      record.status === 'paid' && "bg-muted/30",
                      record.status === 'overdue' && "bg-destructive/5 border-destructive/30",
                      record.status === 'pending' && "bg-amber-500/5 border-amber-500/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Tax Period: {record.tax_period}</p>
                          {getStatusBadge(record)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          <p>Revenue: {formatCurrency(Number(record.gross_revenue))}</p>
                          <p>Expenses: {formatCurrency(Number(record.deductible_expenses))}</p>
                          <p>Tax Rate: {(Number(record.tax_rate) * 100).toFixed(0)}%</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {record.status === 'paid' && record.paid_at
                            ? `Paid ${formatDistanceToNow(new Date(record.paid_at), { addSuffix: true })}`
                            : `Due ${format(new Date(record.due_date), "MMM d, yyyy")}`
                          }
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <p className={cn(
                          "text-lg font-bold",
                          record.status === 'paid' ? "text-muted-foreground" : "text-amber-500"
                        )}>
                          {formatCurrency(Number(record.tax_amount))}
                        </p>
                        
                        {record.status !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => handlePayTax(record)}
                            disabled={
                              payTaxMutation.isPending || 
                              companyBalance < Number(record.tax_amount)
                            }
                          >
                            {payTaxMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
