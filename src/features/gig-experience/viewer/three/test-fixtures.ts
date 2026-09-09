import { buildGigViewerReplay } from '../../events/generator';

export const performerId = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
export const makeStageReplay = (roles = ['Vocals', 'Lead guitar', 'Bass', 'Drums'], attendance = 140) => buildGigViewerReplay({
  replayId: '00000000-0000-4000-9000-000000000001', outcomeId: '00000000-0000-4000-9000-000000000002',
  gig: { id: '00000000-0000-4000-9000-000000000003', completedAt: '2026-09-08T12:00:00Z', venueCapacity: 200, actualAttendance: attendance, overallRating: 8 },
  songs: [{ id: '00000000-0000-4000-9000-000000000004', songId: '00000000-0000-4000-9000-000000000005', position: 0, title: 'The actual song', performanceScore: 8 }],
  performers: roles.map((role, index) => ({ profileId: performerId(index), displayName: `Band member ${index + 1}`, roleOrInstrument: role, lineupStatus: 'performed' })),
  generatedAt: '2026-09-08T13:00:00Z',
});
