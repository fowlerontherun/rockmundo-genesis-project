import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, RefreshCw, Zap, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AP_TO_SXP_RATE = 100;

interface ApToSxpConverterProps {
  apBalance: number;
  onConverted: () => void;
}

export const ApToSxpConverter = ({ apBalance, onConverted }: ApToSxpConverterProps) => {
  const [apAmount, setApAmount] = useState(1);
  const [isConverting, setIsConverting] = useState(false);

  const sxpPreview = apAmount * AP_TO_SXP_RATE;
  const isValid = apAmount > 0 && Number.isInteger(apAmount) && apAmount <= apBalance;

  const handleConvert = async () => {
    if (!isValid) return;
    setIsConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke("progression", {
        body: { action: "convert_ap_to_sxp", ap_amount: apAmount },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Conversion failed");
      }

      toast.success(`Converted ${apAmount} AP → ${sxpPreview.toLocaleString()} SXP`);
      setApAmount(1);
      onConverted();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert AP to SXP");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          Convert AP to Skill XP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Exchange Attribute Points for Skill XP at a rate of <strong>1 AP = {AP_TO_SXP_RATE} SXP</strong>.
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">AP to spend</label>
            <Input
              type="number"
              min={1}
              max={apBalance}
              value={apAmount}
              onChange={(e) => setApAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full"
            />
          </div>

          <ArrowRight className="w-5 h-5 text-muted-foreground mt-4" />

          <div className="flex-1 text-center mt-4">
            <div className="flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xl font-bold text-primary">{sxpPreview.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">SXP gained</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Award className="w-3 h-3" /> {apBalance} AP available
          </span>
          <Button
            onClick={handleConvert}
            disabled={!isValid || isConverting || apBalance === 0}
            size="sm"
          >
            {isConverting ? "Converting..." : "Convert"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
