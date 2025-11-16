import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BOT_TWAAT_TEMPLATES = {
  music_fan: [
    "Just discovered an amazing new artist! Their sound is incredible 🎵",
    "Can't stop listening to this track on repeat 🔁",
    "Live music hits different when you're surrounded by other fans ✨",
    "That concert last night was UNREAL! Still buzzing 🎸",
    "New album alert! This is going straight to my favorites playlist",
  ],
  industry_insider: [
    "Exciting times ahead for the music industry. Big announcements coming soon 🎯",
    "Just signed another talented artist. Can't wait for you all to hear what's next 📝",
    "The future of music is being written today. Stay tuned 🚀",
    "Looking for fresh talent. DMs are open for submissions 📬",
    "Industry insight: Quality always wins in the long run 💎",
  ],
  critic: [
    "Latest album review up on my blog. Rating: 8/10 - Worth your time ⭐",
    "Unpopular opinion: [Artist] is actually underrated in today's scene 🎭",
    "Breaking down the production techniques in this new release 🎚️",
    "This track showcases real musical craftsmanship 🎼",
    "Critical analysis: The evolution of [genre] over the past decade 📊",
  ],
  venue_owner: [
    "Another sold-out show at the venue! Thank you all for coming 🎉",
    "Booking announcements next week. You won't want to miss this lineup 📅",
    "The energy in the room last night was electric ⚡",
    "Supporting local talent is what we do best 🏠",
    "New sound system upgrade complete. Come experience it live 🔊",
  ],
  influencer: [
    "New mix dropping this Friday! Pre-save now 🔥",
    "Tour life has me in a different city every week 🌍",
    "Collaboration announcement coming soon... stay locked in 🔒",
    "Thank you for 500k followers! We're just getting started 🚀",
    "Behind the scenes of my latest production 🎛️",
  ],
};

export const useBotTwaats = () => {
  const { data: botAccounts } = useQuery({
    queryKey: ["twaater-bot-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaater_bot_accounts")
        .select(`
          *,
          account:twaater_accounts(*)
        `)
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const { data: botTwaats, isLoading } = useQuery({
    queryKey: ["twaater-bot-twaats"],
    queryFn: async () => {
      if (!botAccounts) return [];

      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified, owner_type),
          metrics:twaat_metrics(*)
        `)
        .in("account_id", botAccounts.map((b: any) => b.account_id))
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!botAccounts && botAccounts.length > 0,
    refetchInterval: 60000, // Refetch every minute
  });

  const generateBotTwaat = (botType: string): string => {
    const templates = BOT_TWAAT_TEMPLATES[botType as keyof typeof BOT_TWAAT_TEMPLATES] || BOT_TWAAT_TEMPLATES.music_fan;
    return templates[Math.floor(Math.random() * templates.length)];
  };

  return {
    botAccounts,
    botTwaats: botTwaats || [],
    isLoading,
    generateBotTwaat,
  };
};
