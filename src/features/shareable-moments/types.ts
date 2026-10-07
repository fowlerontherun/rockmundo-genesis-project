export const SHARE_FORMATS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 630 },
} as const;

export type ShareFormat = keyof typeof SHARE_FORMATS;
export type ShareMomentType =
  | 'character_profile'
  | 'band_profile'
  | 'gig_result'
  | 'festival'
  | 'tour'
  | 'achievement'
  | 'release'
  | 'chart'
  | 'referral'
  | 'blind_box';

export interface ShareMetric {
  label: string;
  value: string;
}

export interface ShareMoment {
  version: 1;
  type: ShareMomentType;
  id?: string;
  headline: string;
  subheadline?: string;
  eyebrow?: string;
  metrics?: ShareMetric[];
  artworkUrl?: string | null;
  variant?: 'standard' | 'headline';
  destinationUrl?: string | null;
  referralCode?: string | null;
  /** Existing growth throttle key; recorded only after a successful share/link-copy action. */
  shareCooldownKey?: string | null;
  createdAt: string;
}

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
  file?: File;
}
