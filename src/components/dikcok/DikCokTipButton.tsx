import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign } from "lucide-react";
import { useDikCokTips } from "@/hooks/useDikCokTips";

interface DikCokTipButtonProps {
  videoId: string;
}

const TIP_AMOUNTS = [5, 10, 25, 50];

export const DikCokTipButton = ({ videoId }: DikCokTipButtonProps) => {
  const { tipTotal, sendTip } = useDikCokTips(videoId);
  const [open, setOpen] = useState(false);

  const handleTip = (amount: number) => {
    sendTip.mutate({ videoId, amount });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <DollarSign className="h-3 w-3" />
          {tipTotal > 0 ? `$${tipTotal}` : "Tip"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {TIP_AMOUNTS.map((amt) => (
            <Button
              key={amt}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => handleTip(amt)}
              disabled={sendTip.isPending}
            >
              ${amt}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
