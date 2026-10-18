/** UI status for the server-enforced rolling two-hour PooTube quota. */
export const calculateEducationVideoCooldown = (
  claimedAt: readonly string[],
  nowMs: number = Date.now(),
) => {
  const windowMs = 2 * 60 * 60 * 1000;
  const maxVideos = 2;
  const recent = claimedAt
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value <= nowMs && value > nowMs - windowMs)
    .sort((a, b) => a - b);
  const videosWatched = Math.min(recent.length, maxVideos);
  const canWatch = videosWatched < maxVideos;
  return {
    videosWatched,
    maxVideos,
    canWatch,
    cooldownEndsAt: canWatch ? null : new Date(recent[0] + windowMs),
  };
};
