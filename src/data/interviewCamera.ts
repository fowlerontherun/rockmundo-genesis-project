export type InterviewCameraShot = "wide" | "host" | "guest";
export type InterviewCameraPhase = "intro" | "question" | "reaction" | "results";

/** Scene changes are predictable rather than timers that might steal answer time. */
export function chooseInterviewShot(phase: InterviewCameraPhase, questionIndex: number): InterviewCameraShot {
  if (phase === "intro" || phase === "results") return "wide";
  if (phase === "reaction") return "guest";
  return questionIndex % 3 === 1 ? "wide" : "host";
}
