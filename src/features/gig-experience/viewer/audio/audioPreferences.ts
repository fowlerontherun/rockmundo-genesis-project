const KEY = "rockmundo:gig-viewer-audio";
export interface GigAudioPreferences { enabled: boolean; muted: boolean; volume: number }
export function loadGigAudioPreferences(): GigAudioPreferences { try { return { enabled: false, muted: false, volume: 0.7, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { enabled: false, muted: false, volume: 0.7 }; } }
export function saveGigAudioPreferences(prefs: GigAudioPreferences) { try { localStorage.setItem(KEY, JSON.stringify({ enabled: prefs.enabled, muted: prefs.muted, volume: prefs.volume })); } catch { /* local only */ } }
