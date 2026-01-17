import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useLabelFinancials } from "@/hooks/useLabelBusiness";
import { TRANSACTION_TYPES } from "@/types/label-business";
import { formatDistanceToNow } from "date-fns";

interface LabelFinancialOverviewProps {
  labelId: string;
  operatingBudget?: number;
  advancePool?: number;
  marketingBudget?: number;
}

export function LabelFinancialOverview({ 
  labelId, 
  operatingBudget = 0,
  advancePool = 0,
  marketingBudget = 0 
}: LabelFinancialOverviewProps) {
  const { data: transactions, isLoading } = useLabelFinancials(labelId);
  
  const recentTransactions = transactions?.slice(0, 10) || [];
  
  const totalRevenue = transactions
    ?.filter(t => t.transaction_type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0) || 0;
    
  const totalExpenses = transactions
    ?.filter(t => t.transaction_type !== 'revenue' && t.transaction_type !== 'transfer')
    .reduce((sum, t) => sum + t.amount, 0) || 0;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Operating Budget</span>
            </div>
            <p className="text-2xl font-bold mt-1">${operatingBudget.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              <span className="text-sm text-muted-foreground">Advance Pool</span>
            </div>
            <p className="text-2xl font-bold mt-1">${advancePool.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-500">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-500">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No transactions recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((transaction) => {
                const typeInfo = TRANSACTION_TYPES.find(t => t.value === transaction.transaction_type);
                const isRevenue = transaction.transaction_type === 'revenue';
                
                return (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {typeInfo?.label || transaction.transaction_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {transaction.description || 'No description'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-medium ${isRevenue ? 'text-green-500' : 'text-red-500'}`}>
                        {isRevenue ? '+' : '-'}${Math.abs(transaction.amount).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
