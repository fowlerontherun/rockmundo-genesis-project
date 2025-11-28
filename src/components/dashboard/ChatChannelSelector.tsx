import { useState, useEffect } from "react";
import { MessageSquare, HelpCircle, Sparkles, MapPin, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RealtimeChatPanel } from "@/components/chat/RealtimeChatPanel";
import { cn } from "@/lib/utils";

interface City {
  id: string;
  name: string;
  country: string;
}

interface ChatChannelSelectorProps {
  isVip: boolean;
}

type ChannelType = "general" | "support" | "newbies" | "vip" | string;

interface Channel {
  key: string;
  label: string;
  icon: typeof MessageSquare;
  type: ChannelType;
}

export function ChatChannelSelector({ isVip }: ChatChannelSelectorProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>("general");
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    const loadCities = async () => {
      const { data } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      
      if (data) {
        setCities(data);
      }
    };

    loadCities();
  }, []);

  const baseChannels: Channel[] = [
    { key: "general", label: "General", icon: MessageSquare, type: "general" },
    { key: "support", label: "Support", icon: HelpCircle, type: "support" },
    { key: "newbies", label: "Newbies", icon: Sparkles, type: "newbies" },
  ];

  if (isVip) {
    baseChannels.push({ key: "vip", label: "VIP", icon: Crown, type: "vip" });
  }

  const cityChannels: Channel[] = cities.map(city => ({
    key: `city:${city.id}`,
    label: `${city.name}`,
    icon: MapPin,
    type: city.id,
  }));

  const allChannels = [...baseChannels, ...cityChannels];

  return (
    <div className="flex gap-4 h-[600px]">
      <ScrollArea className="w-48 border rounded-lg bg-card">
        <div className="p-2 space-y-1">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
            Main Channels
          </div>
          {baseChannels.map(channel => {
            const Icon = channel.icon;
            return (
              <Button
                key={channel.key}
                variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2",
                  selectedChannel === channel.key && "bg-accent"
                )}
                onClick={() => setSelectedChannel(channel.key)}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{channel.label}</span>
              </Button>
            );
          })}
          
          {cityChannels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-4">
                Cities
              </div>
              {cityChannels.map(channel => {
                const Icon = channel.icon;
                return (
                  <Button
                    key={channel.key}
                    variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2",
                      selectedChannel === channel.key && "bg-accent"
                    )}
                    onClick={() => setSelectedChannel(channel.key)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{channel.label}</span>
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="flex-1">
        <RealtimeChatPanel
          channelKey={selectedChannel}
          title={allChannels.find(c => c.key === selectedChannel)?.label || "Chat"}
          className="h-full"
        />
      </div>
    </div>
  );
}
