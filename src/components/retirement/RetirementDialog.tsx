import { useState } from "react";
import { Trophy, Users, Music, Mic2, DollarSign, Star, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { processRetirement } from "@/utils/retirement";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface RetirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profileId: string;
  isMandatory: boolean;
  playerAge: number;
  stats: {
    characterName: string;
    fame: number;
    cash: number;
    totalSongs: number;
    totalGigs: number;
    yearsActive: number;
  };
  onRetired?: () => void;
  onDeclined?: () => void;
}

export function RetirementDialog({
  open,
  onOpenChange,
  userId,
  profileId,
  isMandatory,
  playerAge,
  stats,
  onRetired,
  onDeclined,
}: RetirementDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRetire = async () => {
    setIsProcessing(true);
    try {
      const result = await processRetirement(
        userId,
        profileId,
        isMandatory ? "mandatory" : "voluntary"
      );

      if (result.success) {
        toast({
          title: "🎸 Legendary Career Complete!",
          description: `${stats.characterName} has retired to the Hall of Fame. Your grandchild inherits $${result.inheritance?.inheritedCash.toLocaleString()} and 20% of your skills!`,
        });
        queryClient.invalidateQueries({ queryKey: ["player-profile"] });
        onRetired?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process retirement",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isMandatory) return;
    onDeclined?.();
    onOpenChange(false);
  };

  const inheritedCash = Math.floor(stats.cash * 0.5);

  return (
    <Dialog open={open} onOpenChange={isMandatory ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-6 w-6 text-warning" />
            {isMandatory ? "Time to Retire" : "Consider Retirement?"}
          </DialogTitle>
          <DialogDescription>
            {isMandatory
              ? `At ${playerAge}, it's time to pass the torch to the next generation.`
              : `You've built an incredible career. Ready to become a legend?`}
          </DialogDescription>
        </DialogHeader>

        {/* Career Summary */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-3">{stats.characterName}'s Legacy</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-warning" />
                  <span className="text-muted-foreground">Fame:</span>
                  <span className="font-bold">{stats.fame.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Wealth:</span>
                  <span className="font-bold">${stats.cash.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Songs:</span>
                  <span className="font-bold">{stats.totalSongs}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mic2 className="h-4 w-4 text-accent" />
                  <span className="text-muted-foreground">Gigs:</span>
                  <span className="font-bold">{stats.totalGigs}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Years Active:</span>
                  <span className="font-bold">{stats.yearsActive} years</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inheritance Preview */}
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4">
              <h3 className="font-bold text-success mb-2 flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Your Grandchild Inherits
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash (50%)</span>
                  <span className="font-bold text-success">${inheritedCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skills (20%)</span>
                  <span className="font-bold text-primary">20% of all skills</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Starting Age</span>
                  <span className="font-bold">16 years old</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Age Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Career Progress</span>
              <span>Age {playerAge} / 80</span>
            </div>
            <Progress value={(playerAge / 80) * 100} className="h-2" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isMandatory && (
            <Button variant="outline" onClick={handleDecline} disabled={isProcessing}>
              Keep Playing
            </Button>
          )}
          <Button
            onClick={handleRetire}
            disabled={isProcessing}
            className="bg-gradient-to-r from-warning to-amber-500 text-warning-foreground"
          >
            {isProcessing ? "Processing..." : "Retire to Hall of Fame"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
