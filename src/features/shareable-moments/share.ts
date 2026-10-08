import type { SharePayload } from './types';

const REFERRAL_PATH = '/auth';

export function referralUrl(code: string, origin?: string): string {
  const resolvedOrigin = origin ?? (typeof window === 'undefined' ? 'https://rockmundo.uk' : window.location.origin);
  const url = new URL(REFERRAL_PATH, resolvedOrigin);
  url.searchParams.set('ref', code.trim().toUpperCase());
  return url.toString();
}

export function referralUrlWithParams(code: string, params: Record<string, string | undefined | null> = {}, origin?: string): string {
  const url = new URL(referralUrl(code, origin));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value).trim()) url.searchParams.set(key, String(value).trim());
  });
  return url.toString();
}

export function withReferral(url: string, code?: string | null, source?: string | null, campaign?: string | null, creative?: string | null): string {
  const parsed = new URL(url, typeof window === 'undefined' ? 'https://rockmundo.uk' : window.location.origin);
  if (code) parsed.searchParams.set('ref', code.trim().toUpperCase());
  if (source) parsed.searchParams.set('source', source.trim().toLowerCase());
  if (campaign) parsed.searchParams.set('campaign', campaign.trim().toLowerCase());
  if (creative) parsed.searchParams.set('creative', creative.trim().toLowerCase());
  return parsed.toString();
}

export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && (() => { try { return navigator.canShare({ files: [file] }); } catch { return false; } })();
}

export async function nativeShare(payload: SharePayload): Promise<'shared' | 'unsupported' | 'cancelled'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported';
  const data: ShareData = { title: payload.title, text: payload.text, url: payload.url };
  if (payload.file && canShareFile(payload.file)) {
    // Some mobile share targets reject mixing files with URLs. Keep the link in
    // the message so the referral remains available alongside the artwork.
    data.files = [payload.file];
    if (data.url) {
      data.text = [data.text, data.url].filter(Boolean).join('\n');
      delete data.url;
    }
  }
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has had a chance to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export async function copyPng(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true; } catch { return false; }
}
