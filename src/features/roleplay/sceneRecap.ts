const KEY = "rockmundo-personal-scene-recap";
export function personalSceneRecap(status: string): string | null {
  // Never copy a private scene's title, guests, setting or transcript.
  return status === "ended" ? "Another chapter in my music career. #Rockmundo #Roleplay" : null;
}
export function storePersonalSceneRecap(profileId: string, status: string): void {
  const body = personalSceneRecap(status);
  if (!body) throw new Error("Finish the scene before sharing a recap.");
  sessionStorage.setItem(KEY, JSON.stringify({ profileId, body }));
}
export function consumePersonalSceneRecap(profileId: string): string | null {
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value.profileId === profileId && value.body === personalSceneRecap("ended") ? value.body : null;
  } catch { return null; }
}