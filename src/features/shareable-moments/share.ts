import type { SharePayload } from './types';

const REFERRAL_PATH = '/auth';

export function referralUrl(code: string, origin?: string): string {
  const resolvedOrigin = origin ?? (typeof window === 'undefined' ? 'https://rockmundo.uk' : window.location.origin);
  const url = new URL(REFERRAL_PATH, resolvedOrigin);
  url.searchParams.set('ref', code.trim().toUpperCase());
  return url.toString();
}

export function withReferral(url: string, code?: string | null, source?: string | null, campaign?: string | null): string {
  const parsed = new URL(url, typeof window === 'undefined' ? 'https://rockmundo.uk' : window.location.origin);
  if (code) parsed.searchParams.set('ref', code.trim().toUpperCase());
  if (source) parsed.searchParams.set('source', source.trim().toLowerCase());
  if (campaign) parsed.searchParams.set('campaign', campaign.trim().toLowerCase());
  return parsed.toString();
}

export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });
}

export async function nativeShare(payload: SharePayload): Promise<'shared' | 'unsupported' | 'cancelled'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported';
  const data: ShareData = { title: payload.title, text: payload.text, url: payload.url };
  if (payload.file && canShareFile(payload.file)) data.files = [payload.file];
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
  URL.revokeObjectURL(url);
}


export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export async function copyPng(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true; } catch { return false; }
}
