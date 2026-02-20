// Universal Interaction Modal — Reusable for all social actions
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Swords, MessageSquare, Gift, Music, Handshake,
  AlertTriangle, TrendingUp, TrendingDown, Sparkles, Check, X,
} from "lucide-react";

export interface InteractionOption {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  successProbability: number; // 0-100
  emotionalImpact: { label: string; change: number }[];
  reputationImpact?: { axis: string; change: number }[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface InteractionResult {
  success: boolean;
  title: string;
  description: string;
  impacts: { label: string; change: number }[];
}

interface InteractionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  targetName: string;
  targetAvatar?: string;
  options: InteractionOption[];
  onSelectOption: (optionId: string) => Promise<InteractionResult | void>;
  isProcessing?: boolean;
}

function ImpactPreview({ impacts }: { impacts: { label: string; change: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {impacts.map((impact, i) => (
        <Badge
          key={i}
          variant="outline"
          className={cn(
            "text-[10px] gap-0.5",
            impact.change > 0 ? "text-success border-success/30" : "text-social-tension border-social-tension/30",
          )}
        >
          {impact.change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {impact.label} {impact.change > 0 ? "+" : ""}{impact.change}
        </Badge>
      ))}
    </div>
  );
}

function SuccessIndicator({ probability }: { probability: number }) {
  const color = probability >= 75 ? "social-loyalty" : probability >= 40 ? "social-jealousy" : "social-tension";
  return (
    <div className="flex items-center gap-1.5">
      <ScoreGauge value={probability} label="" color={color} size="sm" variant="ring" showValue />
      <span className="text-[10px] text-muted-foreground">Success</span>
    </div>
  );
}

export function InteractionModal({
  open,
  onOpenChange,
  title,
  subtitle,
  targetName,
  options,
  onSelectOption,
  isProcessing = false,
}: InteractionModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<InteractionResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSelect = async (optionId: string) => {
    setSelectedOption(optionId);
    setProcessing(true);
    try {
      const outcome = await onSelectOption(optionId);
      if (outcome) {
        setResult(outcome);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedOption(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-border/50 bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Target:</span>
            <Badge variant="secondary">{targetName}</Badge>
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {result ? (
            // Result screen
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 py-4"
            >
              <div className={cn(
                "flex items-center gap-3 p-4 rounded-lg border",
                result.success
                  ? "bg-success/10 border-success/30"
                  : "bg-social-tension/10 border-social-tension/30",
              )}>
                <div className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-full",
                  result.success ? "bg-success/20" : "bg-social-tension/20",
                )}>
                  {result.success ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <X className="h-5 w-5 text-social-tension" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{result.title}</p>
                  <p className="text-sm text-muted-foreground">{result.description}</p>
                </div>
              </div>

              {result.impacts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Consequences</span>
                  <div className="space-y-1.5">
                    {result.impacts.map((impact, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border text-sm",
                          impact.change > 0 ? "border-success/20" : "border-social-tension/20",
                        )}
                      >
                        <span>{impact.label}</span>
                        <span className={cn(
                          "font-oswald font-bold",
                          impact.change > 0 ? "text-success" : "text-social-tension",
                        )}>
                          {impact.change > 0 ? "+" : ""}{impact.change}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleClose}>Close</Button>
              </DialogFooter>
            </motion.div>
          ) : (
            // Option selection
            <motion.div
              key="options"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 max-h-[400px] overflow-y-auto pr-1"
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  disabled={option.disabled || processing || isProcessing}
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border border-border/50 bg-muted/20",
                    "hover:bg-muted/40 hover:border-primary/30 transition-all duration-200",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    selectedOption === option.id && processing && "border-primary/50 bg-primary/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <span className="font-medium text-sm">{option.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                      <ImpactPreview impacts={option.emotionalImpact} />
                      {option.disabled && option.disabledReason && (
                        <div className="flex items-center gap-1 text-[10px] text-social-tension">
                          <AlertTriangle className="h-3 w-3" />
                          {option.disabledReason}
                        </div>
                      )}
                    </div>
                    <SuccessIndicator probability={option.successProbability} />
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
