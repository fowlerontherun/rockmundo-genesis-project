const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
};

export function festivalScheduleLoadErrorMessage(error: unknown): string {
  const message = errorText(error).toUpperCase();

  if (message.includes("FESTIVAL_SCHEDULE_SETUP_INCOMPLETE")) {
    return "Complete this annual edition's dates, city and site planning before opening its schedule.";
  }
  if (message.includes("FESTIVAL_SCHEDULE_BRIDGE_AMBIGUOUS")) {
    return "This annual edition has more than one historical schedule mapping. An administrator must repair the mapping before scheduling can continue.";
  }
  if (
    message.includes("FESTIVAL_SCHEDULE_ACCESS_DENIED") ||
    message.includes("FESTIVAL_SCHEDULE_PERMISSION_DENIED")
  ) {
    return "You do not have permission to manage this annual edition's schedule.";
  }
  if (message.includes("FESTIVAL_SCHEDULE_EDITION_NOT_FOUND")) {
    return "This annual Festival edition could not be found.";
  }

  return "Schedule workspace could not be loaded. Try again, or review the edition setup if the problem continues.";
}
