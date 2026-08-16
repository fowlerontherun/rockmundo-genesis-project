const KEY = "rockmundo:gig-viewer-audio";
export interface GigAudioPreferences { enabled: boolean; muted: boolean; volume: number; ambience: boolean }
export function loadGigAudioPreferences(): GigAudioPreferences { try { return { enabled: false, muted: false, volume: 0.7, ambience: false, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { enabled: false, muted: false, volume: 0.7, ambience: false }; } }
export function saveGigAudioPreferences(prefs: GigAudioPreferences) { try { localStorage.setItem(KEY, JSON.stringify({ enabled: prefs.enabled, muted: prefs.muted, volume: prefs.volume, ambience: prefs.ambience })); } catch { /* local only */ } }
