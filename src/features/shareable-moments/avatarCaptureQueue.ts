/**
 * A single shared WebGL capture lane for Share Studio, band portraits,
 * interviews and referral cards. Mobile browsers often cannot sustain
 * simultaneous WebGL contexts, especially while a gig is rendering.
 * A failed job never poisons the queue.
 */
let tail: Promise<void> = Promise.resolve();

export function enqueueAvatarCapture<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task);
  tail = result.then(() => undefined, () => undefined);
  return result;
}
