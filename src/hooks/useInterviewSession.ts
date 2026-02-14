import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
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

export const useInterviewSession = () => {
  const { user } = useAuth();
  const { data: primaryBandRecord } = usePrimaryBand();
  const band = primaryBandRecord?.bands;
  const bandId = band?.id || null;

  const [pending, setPending] = useState<PendingInterview | null>(null);
  const [phase, setPhase] = useState<InterviewPhase>("intro");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [totalEffects, setTotalEffects] = useState<InterviewEffects | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedRef = useRef(false);

  // Check for pending interviews
  useEffect(() => {
    if (!user?.id || !bandId || checkedRef.current) return;

    const check = async () => {
      checkedRef.current = true;
      const { data } = await supabase
        .from("pr_media_offers")
        .select("id, media_type, outlet_name, show_name, fame_boost, fan_boost, compensation")
        .eq("band_id", bandId)
        .eq("status", "completed")
        .eq("interview_completed", false)
        .limit(1);

      if (data && data.length > 0) {
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
      }
    };
    check();
  }, [user?.id, bandId]);

  useEffect(() => {
    checkedRef.current = false;
  }, [bandId]);

  const startInterview = useCallback(async () => {
    if (!pending) return;
    setLoading(true);

    const { data } = await supabase
      .from("interview_questions")
      .select("*")
      .or(`media_types.cs.{${pending.mediaType}},media_types.cs.{all}`);

    if (data && data.length >= 3) {
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, 3) as unknown as InterviewQuestion[]);
      setCurrentIndex(0);
      setAnswers([]);
      setTimeLeft(10);
      setPhase("question");
    }
    setLoading(false);
  }, [pending]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "question") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          handleAnswer("d", true);
          return 10;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentIndex]);

  const handleAnswer = useCallback(
    (option: "a" | "b" | "c" | "d", timedOut = false) => {
      if (timerRef.current) clearInterval(timerRef.current);

      const q = questions[currentIndex];
      if (!q) return;

      const newAnswer: InterviewAnswer = {
        question_id: q.id,
        chosen_option: option,
        timed_out: timedOut,
      };

      const newAnswers = [...answers, newAnswer];
      setAnswers(newAnswers);

      if (currentIndex < 2) {
        setCurrentIndex((i) => i + 1);
        setTimeLeft(10);
      } else {
        const effects = calculateTotalEffects(questions, newAnswers);
        setTotalEffects(effects);
        setPhase("results");
      }
    },
    [questions, currentIndex, answers]
  );

  const calculateTotalEffects = (
    qs: InterviewQuestion[],
    ans: InterviewAnswer[]
  ): InterviewEffects => {
    let fameMult = 0;
    let fanMult = 0;
    let cashMult = 0;
    const repTotal: Record<string, number> = {};

    ans.forEach((a, i) => {
      const q = qs[i];
      const key = `option_${a.chosen_option}_effects` as keyof InterviewQuestion;
      const effects = q[key] as unknown as InterviewEffects;

      fameMult += effects.fame_mult || 1;
      fanMult += effects.fan_mult || 1;
      cashMult += effects.cash_mult || 1;

      if (effects.reputation) {
        Object.entries(effects.reputation).forEach(([k, v]) => {
          repTotal[k] = (repTotal[k] || 0) + (v as number);
        });
      }
    });

    return {
      fame_mult: fameMult / 3,
      fan_mult: fanMult / 3,
      cash_mult: cashMult / 3,
      reputation: repTotal,
    };
  };

  const finishInterview = useCallback(async () => {
    if (!pending || !totalEffects || !user?.id || !bandId) return;
    setLoading(true);

    // Save results
    await (supabase as any).from("interview_results").insert({
      user_id: user.id,
      band_id: bandId,
      offer_id: pending.offerId,
      media_type: pending.mediaType,
      questions: answers,
      total_effects: totalEffects,
    });

    // Mark interview completed
    await supabase
      .from("pr_media_offers")
      .update({ interview_completed: true } as any)
      .eq("id", pending.offerId);

    // Apply bonus/penalty effects to band stats
    const fameChange = Math.round(pending.fameBoost * (totalEffects.fame_mult - 1));
    const cashChange = Math.round(pending.compensation * (totalEffects.cash_mult - 1));

    if (fameChange !== 0 || cashChange !== 0) {
      const { data: bandData } = await supabase
        .from("bands")
        .select("fame, band_balance")
        .eq("id", bandId)
        .single();

      if (bandData) {
        await supabase
          .from("bands")
          .update({
            fame: Math.max(0, (bandData.fame || 0) + fameChange),
            band_balance: Math.max(0, (bandData.band_balance || 0) + cashChange),
          })
          .eq("id", bandId);
      }
    }

    setPending(null);
    setPhase("intro");
    setLoading(false);
  }, [pending, totalEffects, user?.id, bandId, answers]);

  const dismiss = useCallback(() => {
    setPending(null);
    setPhase("intro");
  }, []);

  return {
    pending,
    phase,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    timeLeft,
    totalEffects,
    loading,
    startInterview,
    handleAnswer,
    finishInterview,
    dismiss,
  };
};
