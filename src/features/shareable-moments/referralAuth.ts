export function referralSignupMatchesSession(
  pendingSignupUserId: string | null | undefined,
  sessionUserId: string | null | undefined,
): boolean {
  return Boolean(
    pendingSignupUserId &&
    sessionUserId &&
    pendingSignupUserId === sessionUserId,
  );
}
