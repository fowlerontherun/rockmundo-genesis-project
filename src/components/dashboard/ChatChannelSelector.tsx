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
      {/* Channel list — horizontal scrollable strip on mobile, vertical sidebar on desktop */}
      <div className="w-full max-w-full sm:w-48 shrink-0 border rounded-lg bg-card flex flex-col overflow-hidden sm:max-h-none">
        {/* Search — desktop only */}
        <div className="hidden sm:block p-2 border-b">
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

        {/* Mobile: horizontal scroll strip */}
        <div className="sm:hidden overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 p-1.5 w-max">
            {baseChannels.map(channel => {
              const Icon = channel.icon;
              return (
                <Button
                  key={channel.key}
                  variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                  className={cn(
                    "gap-1.5 shrink-0 h-8 px-2.5 text-xs",
                    selectedChannel === channel.key && "bg-accent"
                  )}
                  size="sm"
                  onClick={() => setSelectedChannel(channel.key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{channel.label}</span>
                </Button>
              );
            })}
            {cityChannels.length > 0 && (
              <div className="w-px bg-border mx-0.5 self-stretch" />
            )}
            {cityChannels.map(channel => {
              const Icon = channel.icon;
              return (
                <Button
                  key={channel.key}
                  variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                  className={cn(
                    "gap-1.5 shrink-0 h-8 px-2.5 text-xs",
                    selectedChannel === channel.key && "bg-accent"
                  )}
                  size="sm"
                  onClick={() => setSelectedChannel(channel.key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{channel.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Desktop: vertical scrollable sidebar */}
        <ScrollArea className="flex-1 hidden sm:block">
          <div className="p-2 flex flex-col space-y-1">
            {filteredBase.length > 0 && (
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                Main Channels
              </div>
            )}
            {filteredBase.map(channel => {
              const Icon = channel.icon;
              return (
                <Button
                  key={channel.key}
                  variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                  className={cn(
                    "justify-start gap-2 w-full",
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
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-4">
                  Cities
                </div>
                {filteredCities.map(channel => {
                  const Icon = channel.icon;
                  return (
                    <Button
                      key={channel.key}
                      variant={selectedChannel === channel.key ? "secondary" : "ghost"}
                      className={cn(
                        "justify-start gap-2 w-full",
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
