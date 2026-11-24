export type BandChatIdentity = { userId: string | null; profileId: string | null };

export function bandChatPayload(bandId: string, identity: BandChatIdentity, raw: string) {
  if (!identity.userId || !identity.profileId) throw new Error("Choose an active character before sending.");
  const message = raw.trim();
  if (!message || message.length > 500) throw new Error("Messages must be between 1 and 500 characters.");
  return { band_id: bandId, user_id: identity.userId, profile_id: identity.profileId, message };
}

export function isOwnBandMessage(message: { profile_id: string | null }, profileId: string | null) {
  // Legacy account-only messages cannot safely be assigned to one character.
  return Boolean(profileId && message.profile_id === profileId);
}