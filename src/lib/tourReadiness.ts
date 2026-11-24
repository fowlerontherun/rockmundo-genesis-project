import type { TourSupportAssignment } from '@/features/support-bands/tourManagementApi';

export function summarizeSupportCoverage(assignments: TourSupportAssignment[], now: number) {
  const future = assignments.filter(row => new Date(row.scheduled_date).getTime() > now);
  const confirmed = future.filter(row => row.support_status === 'accepted').length;
  const pending = future.filter(row => row.support_status === 'pending').length;
  return { total: future.length, confirmed, pending, open: future.length - confirmed - pending };
}
