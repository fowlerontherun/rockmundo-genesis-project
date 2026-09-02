import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import type { InterviewQuestion, InterviewAnswer, InterviewPhase } from "@/data/interviewQuestions";

interface PendingInterview {
  offerId: string;
  mediaType: string;
  outletName: string;
  showName: string;
  fameBoost: number;
  fanBoost: number;
  compensation: number;
}

interface InterviewEffects {
  fame_mult: number;
  fan_mult: number;
  cash_mult: number;
  reputation: Record<string, number>;
}

const QUESTION_TIME_SECONDS = 12;
const INTERVIEW_COOLDOWN_KEY = "interview_last_shown";
const COOLDOWN_MS = 10 * 60 * 1000;

const questionCountForMedia = (mediaType: string) => {
  switch (mediaType) {
    case "podcast": return 7;
    case "magazine":
    case "newspaper":
    case "film": return 6;
    case "tv":
    case "radio": return 5;
    case "internet": return 4;
    default: return 5;
  }
};

const shuffled = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export const useInterviewSession = () => {
  const { profileId } = useActiveProfile();
  const { data: primaryBandRecord } = usePrimaryBand();
  const bandId = primaryBandRecord?.bands?.id || null;

  const [pending, setPending] = useState<PendingInterview | null>(null);
  const [phase, setPhase] = useState<InterviewPhase>("intro");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);
  const [totalEffects, setTotalEffects] = useState<InterviewEffects | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!profileId || !bandId || checkedRef.current) return;

    const check = async () => {
      checkedRef.current = true;
      const lastShown = sessionStorage.getItem(INTERVIEW_COOLDOWN_KEY);
      if (lastShown && Date.now() - Number(lastShown) < COOLDOWN_MS) return;

      const { data } = await supabase
        .from("pr_media_offers")
        .select("id, media_type, outlet_name, show_name, fame_boost, fan_boost, compensation")
        .eq("band_id", bandId)
        .eq("status", "completed")
        .eq("interview_completed", false)
        .order("proposed_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1);

      if (!data?.length) return;
      const offer = data[0];
      setPending({
        offerId: offer.id,
        mediaType: offer.media_type,
        outletName: offer.outlet_name || "Unknown Outlet",
        showName: offer.show_name || "",
        fameBoost: offer.fame_boost || 0,
        fanBoost: offer.fan_boost || 0,
        compensation: offer.compensation || 0,
      });
      sessionStorage.setItem(INTERVIEW_COOLDOWN_KEY, Date.now().toString());
    };

    check();
  }, [profileId, bandId]);

  useEffect(() => {
    checkedRef.current = false;
  }, [bandId]);

  const startInterview = useCallback(async () => {
    if (!pending) return;
    setLoading(true);
    try {
      const targetCount = questionCountForMedia(pending.mediaType);
      const { data, error } = await supabase
        .from("interview_questions")
        .select("*")
        .or(`media_types.cs.{${pending.mediaType}},media_types.cs.{all}`);
      if (error) throw error;

      const pool = (data || []) as unknown as InterviewQuestion[];
      if (pool.length < targetCount) throw new Error("Not enough interview questions are available for this media type.");

      // Prefer category variety so a long podcast does not ask seven versions of the same topic.
      const byCategory = new Map<string, InterviewQuestion[]>();
      shuffled(pool).forEach((question) => {
        const category = question.category || "general";
        byCategory.set(category, [...(byCategory.get(category) || []), question]);
      });

      const selected: InterviewQuestion[] = [];
      const categories = shuffled([...byCategory.keys()]);
      for (const category of categories) {
        const categoryPool = byCategory.get(category) || [];
        if (categoryPool.length && selected.length < targetCount) selected.push(categoryPool[0]);
      }
      if (selected.length < targetCount) {
        const used = new Set(selected.map((q) => q.id));
        selected.push(...shuffled(pool.filter((q) => !used.has(q.id))).slice(0, targetCount - selected.length));
      }

      setQuestions(selected.slice(0, targetCount));
      setCurrentIndex(0);
      setAnswers([]);
      setTotalEffects(null);
      setTimeLeft(QUESTION_TIME_SECONDS);
      setPhase("question");
    } finally {
      setLoading(false);
    }
  }, [pending]);

  const calculateTotalEffects = useCallback((qs: InterviewQuestion[], ans: InterviewAnswer[]): InterviewEffects => {
    let fameMult = 0;
    let fanMult = 0;
    let cashMult = 0;
    const reputation: Record<string, number> = {};

    ans.forEach((answer, index) => {
      const question = qs[index];
      const key = `option_${answer.chosen_option}_effects` as keyof InterviewQuestion;
      const effects = question?.[key] as unknown as InterviewEffects | undefined;
      if (!effects) return;

      // A timeout is an awkward on-air pause regardless of which answer eventually tumbles out.
      const timeoutPenalty = answer.timed_out ? 0.97 : 1;
      fameMult += (effects.fame_mult || 1) * timeoutPenalty;
      fanMult += (effects.fan_mult || 1) * timeoutPenalty;
      cashMult += effects.cash_mult || 1;
      Object.entries(effects.reputation || {}).forEach(([axis, value]) => {
        reputation[axis] = (reputation[axis] || 0) + value;
      });
      if (answer.timed_out) reputation.awkward = (reputation.awkward || 0) + 2;
    });

    const divisor = Math.max(1, ans.length);
    return {
      fame_mult: fameMult / divisor,
      fan_mult: fanMult / divisor,
      cash_mult: cashMult / divisor,
      reputation,
    };
  }, []);

  const handleAnswer = useCallback((option: "a" | "b" | "c" | "d", timedOut = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const question = questions[currentIndex];
    if (!question) return;

    const newAnswers = [...answers, { question_id: question.id, chosen_option: option, timed_out: timedOut }];
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      setTimeLeft(QUESTION_TIME_SECONDS);
    } else {
      setTotalEffects(calculateTotalEffects(questions, newAnswers));
      setPhase("results");
    }
  }, [questions, currentIndex, answers, calculateTotalEffects]);

  useEffect(() => {
    if (phase !== "question") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 0.1) {
          // Timeout no longer means "always pick D". A flustered answer is selected at random and gets an extra penalty.
          const fallback = (["a", "b", "c", "d"] as const)[Math.floor(Math.random() * 4)];
          handleAnswer(fallback, true);
          return QUESTION_TIME_SECONDS;
        }
        return previous - 0.1;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentIndex, handleAnswer]);

  const finishInterview = useCallback(async () => {
    if (!pending || !totalEffects || !profileId || !bandId) return;
    setLoading(true);
    try {
      const { error: resultError } = await (supabase as any).from("interview_results").insert({
        user_id: profileId,
        band_id: bandId,
        offer_id: pending.offerId,
        media_type: pending.mediaType,
        questions: answers,
        total_effects: totalEffects,
      });
      if (resultError) throw resultError;

      const { error: completeError } = await supabase
        .from("pr_media_offers")
        .update({ interview_completed: true } as any)
        .eq("id", pending.offerId);
      if (completeError) throw completeError;

      const fameChange = Math.round(pending.fameBoost * (totalEffects.fame_mult - 1));
      const cashChange = Math.round(pending.compensation * (totalEffects.cash_mult - 1));
      if (fameChange !== 0 || cashChange !== 0) {
        const { data: bandData } = await supabase.from("bands").select("fame, band_balance").eq("id", bandId).single();
        if (bandData) {
          await supabase.from("bands").update({
            fame: Math.max(0, (bandData.fame || 0) + fameChange),
            band_balance: Math.max(0, (bandData.band_balance || 0) + cashChange),
          }).eq("id", bandId);
        }
      }

      setPending(null);
      setPhase("intro");
      checkedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [pending, totalEffects, profileId, bandId, answers]);

  return {
    pending,
    phase,
    questions,
    questionCount: pending ? questionCountForMedia(pending.mediaType) : 0,
    questionTimeSeconds: QUESTION_TIME_SECONDS,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    timeLeft,
    totalEffects,
    loading,
    startInterview,
    handleAnswer,
    finishInterview,
  };
};
