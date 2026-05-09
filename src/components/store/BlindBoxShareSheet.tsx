import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, Link2, Copy, Share2, Check, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RevealResult } from "@/pages/BlindBoxStore";

interface Props {
  reveal: RevealResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIER_HEX: Record<string, { bg: string; ring: string; text: string }> = {
  common: { bg: "#475569", ring: "#94a3b8", text: "#e2e8f0" },
  rare: { bg: "#1e3a8a", ring: "#60a5fa", text: "#dbeafe" },
  epic: { bg: "#581c87", ring: "#c084fc", text: "#f3e8ff" },
  legendary: { bg: "#78350f", ring: "#fbbf24", text: "#fef3c7" },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderCard(canvas: HTMLCanvasElement, reveal: RevealResult) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const tier = TIER_HEX[reveal.tier] ?? TIER_HEX.common;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, tier.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow
  const glow = ctx.createRadialGradient(W / 2, 420, 50, W / 2, 420, 600);
  glow.addColorStop(0, `${tier.ring}55`);
  glow.addColorStop(1, "#00000000");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand
  ctx.fillStyle = "#ffffffaa";
  ctx.font = "600 32px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Rockmundo · Blind Box", 60, 80);

  // Tier badge
  const badgeW = 360;
  const badgeH = 90;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 140;
  ctx.fillStyle = `${tier.ring}33`;
  ctx.strokeStyle = tier.ring;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tier.text;
  ctx.textAlign = "center";
  ctx.font = "700 44px Inter, system-ui, sans-serif";
  ctx.fillText(reveal.tier.toUpperCase(), W / 2, badgeY + 60);

  // Quality ring
  const cx = W / 2;
  const cy = 520;
  const radius = 160;
  ctx.lineWidth = 24;
  ctx.strokeStyle = "#ffffff15";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const quality = reveal.song?.quality ?? reveal.instrument?.quality ?? 0;
  ctx.strokeStyle = tier.ring;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * quality) / 100);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 110px Inter, system-ui, sans-serif";
  ctx.fillText(`${quality}`, cx, cy + 28);
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#ffffffaa";
  ctx.fillText("Quality / 100", cx, cy + 62);

  // Item card
  const cardX = 60;
  const cardY = 760;
  const cardW = W - 120;
  const cardH = 380;
  ctx.fillStyle = "#0b1220cc";
  ctx.strokeStyle = `${tier.ring}66`;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("INSTRUMENT", cardX + 36, cardY + 60);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Inter, system-ui, sans-serif";
  const instName = reveal.instrument?.name ?? "—";
  ctx.fillText(instName.length > 28 ? instName.slice(0, 27) + "…" : instName, cardX + 36, cardY + 110);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 26px Inter, system-ui, sans-serif";
  ctx.fillText(reveal.instrument?.type ?? "", cardX + 36, cardY + 150);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("SONG", cardX + 36, cardY + 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 38px Inter, system-ui, sans-serif";
  const songTitle = reveal.song?.title ?? "—";
  ctx.fillText(songTitle.length > 30 ? songTitle.slice(0, 29) + "…" : songTitle, cardX + 36, cardY + 268);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillText(reveal.song?.genre ?? "", cardX + 36, cardY + 304);

  // XP / AP pill
  ctx.fillStyle = `${tier.ring}22`;
  drawRoundedRect(ctx, cardX + 36, cardY + 330, 280, 36, 12);
  ctx.fill();
  ctx.fillStyle = tier.text;
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText(`+${reveal.xp.toLocaleString()} XP   ·   +${reveal.ap} AP`, cardX + 50, cardY + 355);

  // Footer
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Open your own boxes at rockmundo.uk", W / 2, H - 60);
}

export function BlindBoxShareSheet({ reveal, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !reveal) return "";
    const base = `${window.location.protocol}//${window.location.host}`;
    if (reveal.song?.id) return `${base}/song/${reveal.song.id}`;
    return `${base}/blind-boxes`;
  }, [reveal]);

  const shareText = useMemo(() => {
    if (!reveal) return "";
    return `🎴 Just pulled a ${reveal.tier.toUpperCase()} in Rockmundo! "${reveal.song?.title ?? reveal.instrument?.name ?? ""}" · Quality ${reveal.song?.quality ?? reveal.instrument?.quality ?? 0}/100`;
  }, [reveal]);

  useEffect(() => {
    if (open && reveal && canvasRef.current) {
      renderCard(canvasRef.current, reveal);
    }
  }, [open, reveal]);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };

  const getBlob = (): Promise<Blob | null> =>
    new Promise((res) => {
      if (!canvasRef.current) return res(null);
      canvasRef.current.toBlob((b) => res(b), "image/png");
    });

  const handleDownload = async () => {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rockmundo-${reveal?.tier ?? "pull"}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("download");
    toast({ title: "Image downloaded", description: "Saved to your device." });
  };

  const handleCopyImage = async () => {
    try {
      const blob = await getBlob();
      if (!blob) throw new Error("no blob");
      // @ts-expect-error - ClipboardItem types
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("image");
      toast({ title: "Image copied", description: "Paste anywhere as PNG." });
    } catch {
      toast({
        title: "Copy not supported",
        description: "Your browser blocked image copy. Try Download instead.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      flash("link");
      toast({ title: "Link copied", description: shareUrl });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleNativeShare = async () => {
    try {
      const blob = await getBlob();
      const file = blob ? new File([blob], "rockmundo-pull.png", { type: "image/png" }) : null;
      const data: ShareData = { title: "Rockmundo pull", text: shareText, url: shareUrl };
      if (file && (navigator as any).canShare?.({ files: [file] })) {
        (data as any).files = [file];
      }
      if (navigator.share) {
        await navigator.share(data);
        flash("share");
      } else {
        await handleCopyLink();
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share your pull
          </SheetTitle>
          <SheetDescription>
            Export this reveal as an image or copy a sharable link.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border bg-muted/30 p-2">
            <canvas
              ref={canvasRef}
              className="w-full h-auto rounded-md"
              aria-label="Shareable card preview"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="default" onClick={handleNativeShare} className="w-full">
              {copied === "share" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              Share…
            </Button>
            <Button variant="secondary" onClick={handleDownload} className="w-full">
              {copied === "download" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download PNG
            </Button>
            <Button variant="outline" onClick={handleCopyImage} className="w-full">
              {copied === "image" ? <Check className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              Copy image
            </Button>
            <Button variant="outline" onClick={handleCopyLink} className="w-full">
              {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              Copy link
            </Button>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
            <p className="text-muted-foreground">Caption preview</p>
            <p className="text-foreground whitespace-pre-wrap">{shareText}</p>
            <p className="text-primary truncate">{shareUrl}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareText);
                  flash("caption");
                  toast({ title: "Caption copied" });
                } catch {
                  /* noop */
                }
              }}
            >
              {copied === "caption" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy caption only
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
