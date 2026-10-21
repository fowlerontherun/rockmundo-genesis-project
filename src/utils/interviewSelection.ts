import type { InterviewQuestion } from "@/data/interviewQuestions";

const options = ["option_a_text", "option_b_text", "option_c_text", "option_d_text"] as const;

const shuffle = <T,>(values: readonly T[], random: () => number): T[] => {
  const items = [...values];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const usableQuestion = (question: InterviewQuestion): boolean => {
  if (!question.id || !question.question_text?.trim()) return false;
  const answers = options.map((key) => question[key]?.trim());
  return answers.every(Boolean) && new Set(answers.map((answer) => answer?.toLowerCase())).size === 4;
};

/**
 * Choose a varied set of interview prompts, strongly preferring questions
 * the same player has not answered in recent interviews. Never reshuffle
 * the answer text against a different question: each question owns its
 * four authored answers and their corresponding game effects.
 */
export const selectInterviewQuestions = (
  pool: readonly InterviewQuestion[],
  count: number,
  recentlyAsked: ReadonlySet<string> = new Set<string>(),
  random: () => number = Math.random,
): InterviewQuestion[] => {
  const seenTexts = new Set<string>();
  const valid = pool.filter((question) => {
    const textKey = question.question_text?.trim().toLowerCase() ?? "";
    if (!usableQuestion(question) || seenTexts.has(textKey)) return false;
    seenTexts.add(textKey);
    return true;
  });

  if (valid.length < count) {
    throw new Error("Not enough valid interview questions are available for this media type.");
  }

  const selected: InterviewQuestion[] = [];
  const usedCategories = new Set<string>();

  // Consume each unseen category once before cycling; recently asked
  // questions become eligible only if the fresh pool cannot fill the show.
  for (const candidatePool of [
    valid.filter((question) => !recentlyAsked.has(question.id)),
    valid.filter((question) => recentlyAsked.has(question.id)),
  ]) {
    const buckets = new Map<string, InterviewQuestion[]>();
    for (const question of shuffle(candidatePool, random)) {
      const category = question.category || "general";
      buckets.set(category, [...(buckets.get(category) || []), question]);
    }
    const categoryOrder = shuffle([...buckets.keys()], random);

    while (selected.length < count) {
      const remaining = categoryOrder.filter((category) => (buckets.get(category)?.length || 0) > 0);
      if (!remaining.length) break;

      const novelCategories = remaining.filter((category) => !usedCategories.has(category));
      const category = (novelCategories.length ? novelCategories : remaining)[0];
      const question = buckets.get(category)!.shift()!;
      selected.push(question);
      usedCategories.add(category);

      // Once every category has appeared, rotate category order so the
      // same category cannot monopolise a longer podcast interview.
      if (!novelCategories.length) {
        categoryOrder.push(categoryOrder.splice(categoryOrder.indexOf(category), 1)[0]);
      }
    }
    if (selected.length >= count) break;
  }

  return selected;
};
