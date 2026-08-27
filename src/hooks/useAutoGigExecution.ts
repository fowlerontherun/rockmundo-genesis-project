/**
 * Compatibility shim retained while Band Manager still imports this hook.
 *
 * Scheduled gig start and completion are server-owned in production:
 * - `auto-start-gigs` runs from Supabase cron
 * - `auto-complete-gigs` processes due setlist items and completes finished gigs
 *
 * Keeping a browser-side scheduled-gig completer here creates a second authority
 * path and can attempt to complete a gig before the server has started it.
 */
export const useAutoGigExecution = (_bandId: string | null) => undefined;
