import { useEffect, useState, useCallback, useRef } from "react";
import Peer, { MediaConnection } from "peerjs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { AudioLevelMonitor, createAudioElement, requestMicrophoneAccess, stopMediaStream } from "@/utils/audioUtils";

export interface VoiceParticipant {
  peerId: string;
  profileId: string;
  displayName: string;
  avatarUrl?: string;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

export interface UseJamVoiceChatReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  participants: VoiceParticipant[];
  myPeerId: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

interface PresenceState {
  profile_id: string;
  display_name: string;
  avatar_url?: string;
  peer_id?: string;
  voice_enabled?: boolean;
  is_muted?: boolean;
}

export const useJamVoiceChat = (sessionId: string | null): UseJamVoiceChatReturn => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioMonitorsRef = useRef<Map<string, AudioLevelMonitor>>(new Map());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const levelIntervalRef = useRef<number | null>(null);

  // Get current user's profile
  const { data: myProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("[VoiceChat] Cleaning up...");
    
    // Stop level monitoring
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }

    // Close all connections
    connectionsRef.current.forEach((conn) => conn.close());
    connectionsRef.current.clear();

    // Remove audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Destroy audio monitors
    audioMonitorsRef.current.forEach((monitor) => monitor.destroy());
    audioMonitorsRef.current.clear();

    // Stop local stream
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;

    // Destroy peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Unsubscribe from presence channel
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setMyPeerId(null);
    setParticipants([]);
  }, []);

  // Handle incoming call
  const handleIncomingCall = useCallback((call: MediaConnection) => {
    console.log("[VoiceChat] Incoming call from:", call.peer);
    
    if (!localStreamRef.current) {
      console.warn("[VoiceChat] No local stream to answer with");
      return;
    }

    call.answer(localStreamRef.current);
    
    call.on("stream", (remoteStream) => {
      console.log("[VoiceChat] Received remote stream from:", call.peer);
      
      // Create audio element for playback
      const audio = createAudioElement(remoteStream);
      audioElementsRef.current.set(call.peer, audio);
      
      // Create audio monitor for speaking detection
      const monitor = new AudioLevelMonitor(remoteStream);
      audioMonitorsRef.current.set(call.peer, monitor);
    });

    call.on("close", () => {
      console.log("[VoiceChat] Call closed:", call.peer);
      connectionsRef.current.delete(call.peer);
      audioElementsRef.current.get(call.peer)?.pause();
      audioElementsRef.current.delete(call.peer);
      audioMonitorsRef.current.get(call.peer)?.destroy();
      audioMonitorsRef.current.delete(call.peer);
    });

    connectionsRef.current.set(call.peer, call);
  }, []);

  // Call a peer
  const callPeer = useCallback((peerId: string) => {
    if (!peerRef.current || !localStreamRef.current) {
      console.warn("[VoiceChat] Cannot call - peer or stream not ready");
      return;
    }

    if (connectionsRef.current.has(peerId)) {
      console.log("[VoiceChat] Already connected to:", peerId);
      return;
    }

    console.log("[VoiceChat] Calling peer:", peerId);
    const call = peerRef.current.call(peerId, localStreamRef.current);

    call.on("stream", (remoteStream) => {
      console.log("[VoiceChat] Received remote stream from:", peerId);
      
      const audio = createAudioElement(remoteStream);
      audioElementsRef.current.set(peerId, audio);
      
      const monitor = new AudioLevelMonitor(remoteStream);
      audioMonitorsRef.current.set(peerId, monitor);
    });

    call.on("close", () => {
      console.log("[VoiceChat] Call closed:", peerId);
      connectionsRef.current.delete(peerId);
      audioElementsRef.current.get(peerId)?.pause();
      audioElementsRef.current.delete(peerId);
      audioMonitorsRef.current.get(peerId)?.destroy();
      audioMonitorsRef.current.delete(peerId);
    });

    call.on("error", (err) => {
      console.error("[VoiceChat] Call error:", peerId, err);
    });

    connectionsRef.current.set(peerId, call);
  }, []);

  // Connect to voice chat
  const connect = useCallback(async () => {
    if (!sessionId || !myProfile) {
      setError("Cannot connect: session or profile not available");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request microphone access
      console.log("[VoiceChat] Requesting microphone access...");
      const stream = await requestMicrophoneAccess();
      localStreamRef.current = stream;

      // Create unique peer ID using profile ID
      const peerId = `jam-${sessionId.slice(0, 8)}-${myProfile.id.slice(0, 8)}-${Date.now()}`;
      console.log("[VoiceChat] Creating peer with ID:", peerId);

      // Initialize PeerJS
      const peer = new Peer(peerId, {
        debug: 2,
      });

      peerRef.current = peer;

      peer.on("open", (id) => {
        console.log("[VoiceChat] Peer opened with ID:", id);
        setMyPeerId(id);
        setIsConnected(true);
        setIsConnecting(false);

        // Setup presence channel for peer discovery
        const presenceChannel = supabase.channel(`jam-voice-${sessionId}`, {
          config: { presence: { key: myProfile.id } },
        });

        presenceChannel
          .on("presence", { event: "sync" }, () => {
            const state = presenceChannel.presenceState();
            const voiceUsers: VoiceParticipant[] = [];
            
            Object.keys(state).forEach((key) => {
              const presences = state[key] as unknown as PresenceState[];
              if (presences && presences.length > 0) {
                const p = presences[0];
                if (p.voice_enabled && p.peer_id && p.peer_id !== id) {
                  voiceUsers.push({
                    peerId: p.peer_id,
                    profileId: key,
                    displayName: p.display_name || "Unknown",
                    avatarUrl: p.avatar_url,
                    isMuted: p.is_muted || false,
                    isSpeaking: false,
                    audioLevel: 0,
                  });

                  // Call peer if we have lower profile ID (deterministic initiator)
                  if (myProfile.id < key) {
                    setTimeout(() => callPeer(p.peer_id!), 500);
                  }
                }
              }
            });
            
            setParticipants(voiceUsers);
          })
          .on("presence", { event: "join" }, ({ key, newPresences }) => {
            console.log("[VoiceChat] Peer joined:", key, newPresences);
            const p = (newPresences as unknown as PresenceState[])[0];
            if (p?.voice_enabled && p?.peer_id && p.peer_id !== id && myProfile.id < key) {
              setTimeout(() => callPeer(p.peer_id!), 500);
            }
          })
          .on("presence", { event: "leave" }, ({ key }) => {
            console.log("[VoiceChat] Peer left:", key);
            setParticipants(prev => prev.filter(p => p.profileId !== key));
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await presenceChannel.track({
                profile_id: myProfile.id,
                display_name: myProfile.display_name || myProfile.username,
                avatar_url: myProfile.avatar_url,
                peer_id: id,
                voice_enabled: true,
                is_muted: false,
              });
            }
          });

        presenceChannelRef.current = presenceChannel;

        // Start audio level monitoring
        levelIntervalRef.current = window.setInterval(() => {
          setParticipants(prev => prev.map(p => {
            const monitor = audioMonitorsRef.current.get(p.peerId);
            if (monitor) {
              const level = monitor.getLevel();
              return {
                ...p,
                audioLevel: level,
                isSpeaking: monitor.isSpeaking(),
              };
            }
            return p;
          }));
        }, 100);
      });

      peer.on("call", handleIncomingCall);

      peer.on("error", (err) => {
        console.error("[VoiceChat] Peer error:", err);
        setError(`Connection error: ${err.message}`);
        setIsConnecting(false);
      });

      peer.on("disconnected", () => {
        console.log("[VoiceChat] Peer disconnected, attempting reconnect...");
        peer.reconnect();
      });

    } catch (err) {
      console.error("[VoiceChat] Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to voice chat");
      setIsConnecting(false);
      cleanup();
    }
  }, [sessionId, myProfile, handleIncomingCall, callPeer, cleanup]);

  // Disconnect from voice chat
  const disconnect = useCallback(() => {
    console.log("[VoiceChat] Disconnecting...");
    cleanup();
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);

        // Update presence
        if (presenceChannelRef.current && myProfile) {
          presenceChannelRef.current.track({
            profile_id: myProfile.id,
            display_name: myProfile.display_name || myProfile.username,
            avatar_url: myProfile.avatar_url,
            peer_id: myPeerId,
            voice_enabled: true,
            is_muted: !audioTrack.enabled,
          });
        }
      }
    }
  }, [myProfile, myPeerId]);

  // Cleanup on unmount or session change
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [sessionId, cleanup]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    participants,
    myPeerId,
    error,
    connect,
    disconnect,
    toggleMute,
  };
};
