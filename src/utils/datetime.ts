export const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatDurationMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes)) {
    return "a few minutes";
  }

  const totalMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes || 1} minute${remainingMinutes === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

export const formatDurationCountdown = (milliseconds: number) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const segments: string[] = [];
  if (hours > 0) {
    segments.push(`${hours}h`);
    segments.push(`${minutes.toString().padStart(2, "0")}m`);
  } else {
    segments.push(`${minutes}m`);
    segments.push(`${seconds.toString().padStart(2, "0")}s`);
  }

  return segments.join(" ");
};
