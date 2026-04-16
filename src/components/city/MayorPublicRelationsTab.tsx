import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Mic, Handshake, Scroll, Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { MayorPoliticsState } from "@/hooks/useMayorPolitics";

interface Props {
  cityId: string;
  mayorId: string | null;
  politics: MayorPoliticsState | undefined;
}

export function MayorPublicRelationsTab({ cityId, mayorId, politics }: Props) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const runAction = async (action: string, approvalDelta: number, note: string) => {
    if (!mayorId) {
      toast.error("Mayor record missing");
      return;
    }
    setPending(action);
    try {
      const { data: m } = await supabase
        .from("city_mayors")
        .select("approval_rating")
        .eq("id", mayorId)
        .single();
      const newApproval = Math.max(0, Math.min(100, (m?.approval_rating ?? 50) + approvalDelta));
      await supabase
        .from("city_mayors")
        .update({ approval_rating: newApproval })
        .eq("id", mayorId);

      await supabase.from("mayor_actions_log").insert({
        city_id: cityId,
        mayor_id: mayorId,
        action_type: action,
        notes: note,
      });

      queryClient.invalidateQueries({ queryKey: ["city-mayor", cityId] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success(`${note} (${approvalDelta > 0 ? '+' : ''}${approvalDelta} approval)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const u = politics?.unlocks;

  const items: Array<{
    key: string;
    icon: typeof Mic;
    title: string;
    desc: string;
    unlocked: boolean;
    requirement: string;
    onClick: () => void;
    delta: number;
  }> = [
    {
      key: 'press_conference',
      icon: Mic,
      title: 'Hold Press Conference',
      desc: 'Address citizens and the media to gain approval.',
      unlocked: !!u?.pressConferences,
      requirement: 'Public Speaking ≥ 50',
      onClick: () => runAction('press_conference', 3, 'Held a press conference'),
      delta: 3,
    },
    {
      key: 'trade_deal',
      icon: Handshake,
      title: 'Sign Trade Deal',
      desc: 'Negotiate cross-city trade for mutual prosperity.',
      unlocked: !!u?.tradeDeals,
      requirement: 'Diplomacy ≥ 500',
      onClick: () => runAction('trade_deal', 4, 'Signed an inter-city trade deal'),
      delta: 4,
    },
    {
      key: 'decree',
      icon: Scroll,
      title: 'Issue Emergency Decree',
      desc: 'Bypass standard review to enact a one-off ruling.',
      unlocked: !!u?.decrees,
      requirement: 'Statecraft ≥ 500',
      onClick: () => runAction('emergency_decree', -2, 'Issued an emergency decree'),
      delta: -2,
    },
    {
      key: 'campaign_speech',
      icon: Megaphone,
      title: 'Campaign Speech',
      desc: 'Rally support during election season.',
      unlocked: true,
      requirement: 'Available always',
      onClick: () => runAction('campaign_speech', 2, 'Delivered a campaign speech'),
      delta: 2,
    },
  ];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Public Relations Actions</CardTitle>
          <CardDescription>Spend political capital to shift public opinion.</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.key} className={!item.unlocked ? 'opacity-60' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.title}
                      {!item.unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  <Badge variant={item.delta >= 0 ? "secondary" : "destructive"}>
                    {item.delta > 0 ? '+' : ''}{item.delta} approval
                  </Badge>
                </div>
                {!item.unlocked && (
                  <div className="text-xs text-warning">{item.requirement}</div>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!item.unlocked || pending === item.key}
                  onClick={item.onClick}
                >
                  {pending === item.key && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Take Action
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
