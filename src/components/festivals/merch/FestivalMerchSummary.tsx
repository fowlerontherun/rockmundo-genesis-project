 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { DollarSign, ShoppingBag, Disc, Image, TrendingUp } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface MerchSalesData {
   id: string;
   tshirts_sold: number;
   posters_sold: number;
   albums_sold: number;
   other_items_sold: number;
   gross_revenue: number;
   festival_cut: number;
   net_revenue: number;
   performance_boost: number;
 }
 
 interface FestivalMerchSummaryProps {
   sales: MerchSalesData;
   compact?: boolean;
 }
 
 export function FestivalMerchSummary({ sales, compact = false }: FestivalMerchSummaryProps) {
   const totalItems = sales.tshirts_sold + sales.posters_sold + sales.albums_sold + sales.other_items_sold;
   const boostPercentage = Math.round((sales.performance_boost - 1) * 100);
 
   if (compact) {
     return (
       <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
         <div className="flex items-center gap-2">
           <ShoppingBag className="h-5 w-5 text-primary" />
           <div>
             <p className="font-medium">{totalItems} items sold</p>
             <p className="text-xs text-muted-foreground">
               {boostPercentage > 0 && <span className="text-green-500">+{boostPercentage}% boost</span>}
             </p>
           </div>
         </div>
         <div className="text-right">
           <p className="font-bold text-green-500">${sales.net_revenue.toLocaleString()}</p>
           <p className="text-xs text-muted-foreground">net revenue</p>
         </div>
       </div>
     );
   }
 
   return (
     <Card>
       <CardHeader className="pb-2">
         <CardTitle className="flex items-center gap-2 text-lg">
           <ShoppingBag className="h-5 w-5 text-primary" />
           Merchandise Sales
           {boostPercentage > 0 && (
             <Badge variant="secondary" className="ml-auto text-green-500">
               <TrendingUp className="h-3 w-3 mr-1" />
               +{boostPercentage}% Performance Boost
             </Badge>
           )}
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Revenue Summary */}
         <div className="grid grid-cols-3 gap-4 text-center">
           <div className="p-3 bg-muted/30 rounded-lg">
             <p className="text-sm text-muted-foreground">Gross Revenue</p>
             <p className="text-xl font-bold">${sales.gross_revenue.toLocaleString()}</p>
           </div>
           <div className="p-3 bg-red-500/10 rounded-lg">
             <p className="text-sm text-muted-foreground">Festival Cut</p>
             <p className="text-xl font-bold text-red-500">-${sales.festival_cut.toLocaleString()}</p>
           </div>
           <div className="p-3 bg-green-500/10 rounded-lg">
             <p className="text-sm text-muted-foreground">Net Revenue</p>
             <p className="text-xl font-bold text-green-500">${sales.net_revenue.toLocaleString()}</p>
           </div>
         </div>
 
         {/* Item Breakdown */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <div className="flex items-center gap-2 p-2 bg-muted/20 rounded">
             <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
               👕
             </div>
             <div>
               <p className="font-medium">{sales.tshirts_sold}</p>
               <p className="text-xs text-muted-foreground">T-Shirts</p>
             </div>
           </div>
           <div className="flex items-center gap-2 p-2 bg-muted/20 rounded">
             <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
               <Image className="h-4 w-4" />
             </div>
             <div>
               <p className="font-medium">{sales.posters_sold}</p>
               <p className="text-xs text-muted-foreground">Posters</p>
             </div>
           </div>
           <div className="flex items-center gap-2 p-2 bg-muted/20 rounded">
             <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
               <Disc className="h-4 w-4" />
             </div>
             <div>
               <p className="font-medium">{sales.albums_sold}</p>
               <p className="text-xs text-muted-foreground">Albums</p>
             </div>
           </div>
           <div className="flex items-center gap-2 p-2 bg-muted/20 rounded">
             <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
               <ShoppingBag className="h-4 w-4" />
             </div>
             <div>
               <p className="font-medium">{sales.other_items_sold}</p>
               <p className="text-xs text-muted-foreground">Other</p>
             </div>
           </div>
         </div>
 
         {/* Total */}
         <div className="flex items-center justify-between pt-3 border-t">
           <span className="text-muted-foreground">Total Items Sold</span>
           <span className="font-bold text-lg">{totalItems}</span>
         </div>
       </CardContent>
     </Card>
   );
 }