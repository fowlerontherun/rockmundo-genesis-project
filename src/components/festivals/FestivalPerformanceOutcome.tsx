import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Star,
  DollarSign,
  TrendingUp,
  Users,
  Music,
  Award,
  Share2,
  Camera,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Heart,
  BarChart3,
  Radio,
} from "lucide-react";
import type { FestivalCareerImpactResult } from "@/utils/festivalCareerImpact";
import { cn } from "@/lib/utils";

interface PerformanceReview {
  id: string;
  source: string;
  score: number;
  headline: string;
  excerpt: string;
  sentiment: "positive" | "neutral" | "negative";
}

interface HighlightMoment {
  id: string;
  timestamp: string;
  description: string;
  crowdReaction: number;
  type: "intro" | "solo" | "chorus" | "encore" | "interaction";
}

interface FestivalPerformanceOutcomeProps {
  performanceScore: number;
  crowdEnergy: number;
  festivalName: string;
  slotType: string;
  earnedPayment: number;
  earnedFame: number;
  merchSales?: number;
  attendanceEstimate?: number;
  careerImpact?: FestivalCareerImpactResult;
  onShare?: () => void;
}

// Generate mock reviews based on score
const generateReviews = (score: number): PerformanceReview[] => {
  const reviews: PerformanceReview[] = [];
  
  if (score >= 80) {
    reviews.push({
      id: "1",
      source: "Rock Weekly",
      score: Math.min(100, score + 5),
      headline: "A Star-Making Performance",
      excerpt: "Absolutely electrifying from start to finish. The crowd was completely captivated.",
      sentiment: "positive",
    });
  }
  
  if (score >= 60) {
    reviews.push({
      id: "2",
      source: "Music Today",
      score: score,
      headline: "Solid Festival Set",
      excerpt: "A well-crafted performance that showed real promise and crowd connection.",
      sentiment: score >= 75 ? "positive" : "neutral",
    });
  }
  
  if (score < 60) {
    reviews.push({
      id: "3",
      source: "Stage Critics",
      score: score,
      headline: "Room for Improvement",
      excerpt: "While there were moments of brilliance, the overall energy didn't quite reach its potential.",
      sentiment: score >= 40 ? "neutral" : "negative",
    });
  }
  
  reviews.push({
    id: "4",
    source: "Fan Forum",
    score: Math.max(0, score + Math.floor(Math.random() * 20) - 10),
    headline: score >= 70 ? "We Want More!" : "Decent Show",
    excerpt: score >= 70 
      ? "Already counting down to see them again. Best set of the day!"
      : "They played well, looking forward to seeing them grow.",
    sentiment: score >= 70 ? "positive" : "neutral",
  });
  
  return reviews;
};

// Generate highlight moments
const generateHighlights = (score: number): HighlightMoment[] => {
  const highlights: HighlightMoment[] = [
    {
      id: "1",
      timestamp: "0:00",
      description: "Opening riff ignites the crowd",
      crowdReaction: Math.min(100, 40 + score * 0.4),
      type: "intro",
    },
    {
      id: "2",
      timestamp: "12:34",
      description: "Extended guitar solo",
      crowdReaction: Math.min(100, 50 + score * 0.3),
      type: "solo",
    },
    {
      id: "3",
      timestamp: "25:00",
      description: "Big chorus singalong moment",
      crowdReaction: Math.min(100, 60 + score * 0.3),
      type: "chorus",
    },
  ];
  
  if (score >= 75) {
    highlights.push({
      id: "4",
      timestamp: "35:00",
      description: "Crowd interaction - front row connection",
      crowdReaction: Math.min(100, 70 + score * 0.25),
      type: "interaction",
    });
  }
  
  if (score >= 85) {
    highlights.push({
      id: "5",
      timestamp: "42:00",
      description: "Encore demanded by crowd!",
      crowdReaction: 95,
      type: "encore",
    });
  }
  
  return highlights;
};

export function FestivalPerformanceOutcome({
  performanceScore,
  crowdEnergy,
  festivalName,
  slotType,
  earnedPayment,
  earnedFame,
  merchSales = 0,
  attendanceEstimate = 0,
  careerImpact,
  onShare,
}: FestivalPerformanceOutcomeProps) {
  const [showReviews, setShowReviews] = useState(false);
  
  const reviews = generateReviews(performanceScore);
  const highlights = generateHighlights(performanceScore);
  
  const averageReviewScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-primary";
    if (score >= 50) return "text-amber-500";
    return "text-destructive";
  };
  
  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Legendary";
    if (score >= 80) return "Outstanding";
    if (score >= 70) return "Great";
    if (score >= 60) return "Good";
    if (score >= 50) return "Decent";
    return "Needs Work";
  };

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Performance Complete!</CardTitle>
          <CardDescription>
            {festivalName} • {slotType} Slot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center">
            <div className={cn("text-6xl font-bold", getScoreColor(performanceScore))}>
              {performanceScore}
            </div>
            <Badge variant="secondary" className="mt-2 text-lg px-4 py-1">
              {getScoreLabel(performanceScore)}
            </Badge>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Crowd Energy</p>
              <p className="text-lg font-bold">{crowdEnergy}%</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-muted-foreground">Avg Review</p>
              <p className="text-lg font-bold">{Math.round(averageReviewScore)}/100</p>
            </div>
          </div>
          
          <Separator />
          
          {/* Earnings Breakdown */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Earnings Breakdown
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Performance Payment</span>
                <span className="font-medium">${earnedPayment.toLocaleString()}</span>
              </div>
              {merchSales > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merch Sales</span>
                  <span className="font-medium">${merchSales.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Earned</span>
                <span className="text-primary">${(earnedPayment + merchSales).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          {/* Fame & Reputation */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Reputation Impact
            </h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Fame Gained</span>
                  <span className="text-primary font-bold">+{earnedFame}</span>
                </div>
                <Progress value={(earnedFame / 200) * 100} className="h-2" />
              </div>
            </div>
            {attendanceEstimate > 0 && (
              <p className="text-sm text-muted-foreground">
                Estimated {attendanceEstimate.toLocaleString()} people watched your set
              </p>
            )}
          </div>

          {/* Career Impact: Fan Growth */}
          {careerImpact && careerImpact.newFansGained > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                Fan Growth
                <Badge variant="outline" className="ml-auto text-xs bg-pink-500/10 text-pink-400 border-pink-500/30">
                  +{careerImpact.newFansGained} fans
                </Badge>
              </h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-muted/50 rounded text-center">
                  <p className="text-xs text-muted-foreground">Casual</p>
                  <p className="font-bold">+{careerImpact.casualFans}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded text-center">
                  <p className="text-xs text-muted-foreground">Dedicated</p>
                  <p className="font-bold text-purple-400">+{careerImpact.dedicatedFans}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded text-center">
                  <p className="text-xs text-muted-foreground">Superfans</p>
                  <p className="font-bold text-amber-400">+{careerImpact.superfans}</p>
                </div>
              </div>
            </div>
          )}

          {/* Career Impact: Chart & Streaming Boosts */}
          {careerImpact && careerImpact.songsBosted > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Chart & Streaming Boosts
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    Streaming Multiplier
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {careerImpact.streamingMultiplier}x
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Chart Boost
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {careerImpact.chartBoostMultiplier}x
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {careerImpact.songsBosted} songs boosted • Expires {new Date(careerImpact.chartBoostExpiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Highlight Reel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Performance Highlights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div key={highlight.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                <Badge variant="outline" className="text-xs shrink-0">
                  {highlight.timestamp}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{highlight.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={highlight.crowdReaction} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {Math.round(highlight.crowdReaction)}% reaction
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Reviews Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews & Reactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{review.source}</span>
                {review.sentiment === "positive" && (
                      <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                    )}
                    {review.sentiment === "negative" && (
                      <ThumbsDown className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  <Badge variant={review.score >= 75 ? "default" : "secondary"}>
                    {review.score}/100
                  </Badge>
                </div>
                <p className="font-semibold text-sm">{review.headline}</p>
                <p className="text-xs text-muted-foreground italic">"{review.excerpt}"</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share Results
        </Button>
        <Button className="flex-1">
          <Award className="h-4 w-4 mr-2" />
          View Full Report
        </Button>
      </div>
    </div>
  );
}
