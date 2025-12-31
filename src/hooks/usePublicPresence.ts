import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  [key: string]: Array<{
    presence_ref: string;
    user_id: string;
    online_at: string;
  }>;
}

/**
 * Public presence hook that can be used on unauthenticated pages
 * Subscribes to the presence channel in read-only mode to see online users
 */
export const usePublicPresence = () => {
  const [onlineCount, setOnlineCount] = useState<number>(0);

  useEffect(() => {
    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const count = Object.keys(state).length;
        setOnlineCount(count);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { onlineCount };
};
