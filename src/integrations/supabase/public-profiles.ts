export interface BasicPublicProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const MOCK_PROFILES: BasicPublicProfile[] = [
  {
    user_id: "artist-aurora",
    username: "aurora",
    display_name: "Aurora Skye",
    avatar_url: "https://api.dicebear.com/7.x/personas/svg?seed=Aurora",
    bio: "Dream pop vocalist and synth enthusiast exploring cosmic sounds.",
  },
  {
    user_id: "producer-harbor",
    username: "harborwave",
    display_name: "Harbor Wave",
    avatar_url: "https://api.dicebear.com/7.x/personas/svg?seed=Harbor",
    bio: "Indie producer blending field recordings with downtempo beats.",
  },
  {
    user_id: "dj-nightfall",
    username: "nightfall",
    display_name: "DJ Nightfall",
    avatar_url: "https://api.dicebear.com/7.x/personas/svg?seed=Nightfall",
    bio: "Late-night selector bringing together future garage and bass music.",
  },
  {
    user_id: "songwriter-ember",
    username: "emberlane",
    display_name: "Ember Lane",
    avatar_url: "https://api.dicebear.com/7.x/personas/svg?seed=Ember",
    bio: "Acoustic storyteller inspired by city lights and quiet moments.",
  },
  {
    user_id: "beatmaker-echo",
    username: "echoforge",
    display_name: "Echo Forge",
    avatar_url: "https://api.dicebear.com/7.x/personas/svg?seed=Echo",
    bio: "Experimental beatmaker crafting textures from modular synth jams.",
  },
];

const createFallbackProfile = (userId: string): BasicPublicProfile => {
  const shortId = userId.slice(0, 8) || "artist";
  return {
    user_id: userId,
    username: `user-${shortId}`,
    display_name: `Creator ${shortId}`,
    avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(shortId)}`,
    bio: "Independent creator sharing their work on Rockmundo.",
  };
};

const mapProfilesByUserId = (
  profiles: BasicPublicProfile[],
): Map<string, BasicPublicProfile> => {
  const lookup = new Map<string, BasicPublicProfile>();
  profiles.forEach((profile) => {
    lookup.set(profile.user_id, profile);
  });
  return lookup;
};

export const fetchPublicProfiles = async (): Promise<BasicPublicProfile[]> => {
  return MOCK_PROFILES;
};

export const fetchPublicProfilesByUserIds = async (
  userIds: string[],
): Promise<Map<string, BasicPublicProfile>> => {
  if (!userIds.length) {
    return new Map();
  }

  const lookup = mapProfilesByUserId(MOCK_PROFILES);

  userIds.forEach((userId) => {
    if (!lookup.has(userId)) {
      lookup.set(userId, createFallbackProfile(userId));
    }
  });

  return lookup;
};
