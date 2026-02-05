 import { Card, CardContent, CardHeader } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Star, ThumbsUp, ThumbsDown, Minus, TrendingUp, TrendingDown } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface FestivalReview {
   id: string;
   reviewer_type: "critic" | "fan" | "industry" | "blog";
   publication_name: string;
   score: number;
   headline: string;
   review_text: string;
   sentiment: "positive" | "neutral" | "negative" | "mixed";
   fame_impact: number;
   is_featured: boolean;
   published_at: string;
 }
 
 interface FestivalReviewCardProps {
   review: FestivalReview;
   compact?: boolean;
 }
 
 const REVIEWER_TYPE_STYLES = {
   critic: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30" },
   fan: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
   industry: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
   blog: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
 };
 
 const SENTIMENT_ICONS = {
   positive: ThumbsUp,
   negative: ThumbsDown,
   neutral: Minus,
   mixed: Star,
 };
 
 export function FestivalReviewCard({ review, compact = false }: FestivalReviewCardProps) {
   const typeStyles = REVIEWER_TYPE_STYLES[review.reviewer_type] || REVIEWER_TYPE_STYLES.blog;
   const SentimentIcon = SENTIMENT_ICONS[review.sentiment];
 
   const getScoreColor = (score: number) => {
     if (score >= 80) return "text-green-500";
     if (score >= 60) return "text-yellow-500";
     if (score >= 40) return "text-orange-500";
     return "text-red-500";
   };
 
   if (compact) {
     return (
       <div className={cn(
         "flex items-center gap-3 p-3 rounded-lg border",
         typeStyles.bg,
         typeStyles.border,
         review.is_featured && "ring-2 ring-primary/50"
       )}>
         <div className={cn("text-2xl font-bold", getScoreColor(review.score))}>
           {review.score}
         </div>
         <div className="flex-1 min-w-0">
           <p className="font-medium text-sm truncate">{review.publication_name}</p>
           <p className="text-xs text-muted-foreground truncate">{review.headline}</p>
         </div>
         <div className="flex items-center gap-1 text-xs">
           {review.fame_impact > 0 ? (
             <span className="text-green-500 flex items-center">
               <TrendingUp className="h-3 w-3 mr-0.5" />
               +{review.fame_impact}
             </span>
           ) : review.fame_impact < 0 ? (
             <span className="text-red-500 flex items-center">
               <TrendingDown className="h-3 w-3 mr-0.5" />
               {review.fame_impact}
             </span>
           ) : null}
         </div>
       </div>
     );
   }
 
   return (
     <Card className={cn(
       review.is_featured && "border-primary/50 ring-1 ring-primary/20"
     )}>
       <CardHeader className="pb-2">
         <div className="flex items-start justify-between">
           <div className="space-y-1">
             <div className="flex items-center gap-2">
               <Badge className={cn(typeStyles.bg, typeStyles.text, "border", typeStyles.border)}>
                 {review.reviewer_type}
               </Badge>
               {review.is_featured && (
                 <Badge variant="default" className="text-xs">Featured</Badge>
               )}
             </div>
             <p className="font-semibold">{review.publication_name}</p>
           </div>
           <div className="text-right">
             <div className={cn("text-3xl font-bold", getScoreColor(review.score))}>
               {review.score}
             </div>
             <p className="text-xs text-muted-foreground">/100</p>
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-3">
         <h4 className="font-semibold text-lg leading-tight">{review.headline}</h4>
         <p className="text-sm text-muted-foreground">{review.review_text}</p>
         
         <div className="flex items-center justify-between pt-2 border-t">
           <div className="flex items-center gap-2">
             <SentimentIcon className={cn(
               "h-4 w-4",
               review.sentiment === "positive" && "text-green-500",
               review.sentiment === "negative" && "text-red-500",
               review.sentiment === "neutral" && "text-muted-foreground",
               review.sentiment === "mixed" && "text-yellow-500"
             )} />
             <span className="text-sm capitalize text-muted-foreground">{review.sentiment}</span>
           </div>
           
           {review.fame_impact !== 0 && (
             <div className={cn(
               "flex items-center gap-1 text-sm font-medium",
               review.fame_impact > 0 ? "text-green-500" : "text-red-500"
             )}>
               {review.fame_impact > 0 ? (
                 <TrendingUp className="h-4 w-4" />
               ) : (
                 <TrendingDown className="h-4 w-4" />
               )}
               {review.fame_impact > 0 ? "+" : ""}{review.fame_impact} fame
             </div>
           )}
         </div>
       </CardContent>
     </Card>
   );
 }
 
 // Aggregated review summary component
 interface ReviewAggregatorProps {
   reviews: FestivalReview[];
 }
 
 export function ReviewAggregator({ reviews }: ReviewAggregatorProps) {
   if (reviews.length === 0) return null;
 
   const avgScore = Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length);
   const totalFameImpact = reviews.reduce((acc, r) => acc + r.fame_impact, 0);
   const positiveCount = reviews.filter(r => r.sentiment === "positive").length;
   const negativeCount = reviews.filter(r => r.sentiment === "negative").length;
 
   const getOverallSentiment = () => {
     if (positiveCount > negativeCount * 2) return "Highly Acclaimed";
     if (positiveCount > negativeCount) return "Generally Positive";
     if (negativeCount > positiveCount) return "Mixed to Negative";
     return "Mixed Reviews";
   };
 
   const getScoreColor = (score: number) => {
     if (score >= 80) return "text-green-500";
     if (score >= 60) return "text-yellow-500";
     if (score >= 40) return "text-orange-500";
     return "text-red-500";
   };
 
   return (
     <Card className="bg-gradient-to-br from-card to-muted/30">
       <CardContent className="p-6">
         <div className="flex items-center justify-between">
           <div>
             <p className="text-sm text-muted-foreground mb-1">Review Summary</p>
             <p className="text-lg font-semibold">{getOverallSentiment()}</p>
             <p className="text-sm text-muted-foreground mt-1">
               Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
             </p>
           </div>
           <div className="text-center">
             <div className={cn("text-5xl font-bold", getScoreColor(avgScore))}>
               {avgScore}
             </div>
             <p className="text-xs text-muted-foreground mt-1">Average Score</p>
           </div>
         </div>
         
         {totalFameImpact !== 0 && (
           <div className={cn(
             "mt-4 pt-4 border-t flex items-center justify-center gap-2 text-lg font-medium",
             totalFameImpact > 0 ? "text-green-500" : "text-red-500"
           )}>
             {totalFameImpact > 0 ? (
               <TrendingUp className="h-5 w-5" />
             ) : (
               <TrendingDown className="h-5 w-5" />
             )}
             {totalFameImpact > 0 ? "+" : ""}{totalFameImpact} Total Fame Impact
           </div>
         )}
       </CardContent>
     </Card>
   );
 }