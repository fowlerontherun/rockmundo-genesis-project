import { useState, useEffect, useMemo } from "react";
import { MessageSquare, HelpCircle, Sparkles, MapPin, Crown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [filter, setFilter] = useState("");

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

  const lowerFilter = filter.toLowerCase();
  const filteredBase = useMemo(() => baseChannels.filter(c => c.label.toLowerCase().includes(lowerFilter)), [baseChannels, lowerFilter]);
  const filteredCities = useMemo(() => cityChannels.filter(c => c.label.toLowerCase().includes(lowerFilter)), [cityChannels, lowerFilter]);

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden flex flex-col gap-2 sm:flex-row sm:gap-4 h-[calc(100vh-14rem)] min-h-[280px]">
      {/* Channel list - horizontal scroll on mobile, vertical sidebar on desktop */}
      <div className="w-full max-w-full sm:w-48 shrink-0 border rounded-lg bg-card flex flex-col overflow-hidden max-h-[120px] sm:max-h-none">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search channels..."
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
        <div className="w-max min-w-full p-2 flex sm:flex-col sm:space-y-1 gap-1 sm:gap-0">
          {filteredBase.length > 0 && <div className="hidden sm:block px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
            Main Channels
          </div>}
          {filteredBase.map(channel => {
            const Icon = channel.icon;
            return (
              <Button
                key={channel.key}
                variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                className={cn(
                  "justify-start gap-2 shrink-0 max-w-full",
                  "sm:w-full",
                  selectedChannel === channel.key && "bg-accent"
                )}
                size="sm"
                onClick={() => setSelectedChannel(channel.key)}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{channel.label}</span>
              </Button>
            );
          })}
          
          {filteredCities.length > 0 && (
            <>
              <div className="hidden sm:block px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-4">
                Cities
              </div>
              {filteredCities.map(channel => {
                const Icon = channel.icon;
                return (
                  <Button
                    key={channel.key}
                    variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                    className={cn(
                      "justify-start gap-2 shrink-0 max-w-full",
                      "sm:w-full",
                      selectedChannel === channel.key && "bg-accent"
                    )}
                    size="sm"
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
      </div>

      <div className="flex-1 min-h-0 min-w-0">
        <RealtimeChatPanel
          channelKey={selectedChannel}
          title={allChannels.find(c => c.key === selectedChannel)?.label || "Chat"}
          className="h-full"
        />
      </div>
    </div>
  );
}
