"use client";

import { useState } from "react";
import { Sparkles, Heart, Compass, Shield, ArrowRight, ArrowLeft, Loader2, Award, ShoppingBag, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: "goal",
    question: "What is your main goal for intimacy wellness?",
    options: [
      "Enhance sensory pleasure and awareness",
      "Deepen emotional connection with my partner",
      "Explore new levels of adventure and novelty",
      "Reduce discomfort or tension during intimate moments"
    ]
  },
  {
    id: "atmosphere",
    question: "What sensory environment helps you relax and connect best?",
    options: [
      "Dim warm lighting and soft acoustic music",
      "Aromatic scents, massage candles, and warmth",
      "Clean, quiet, and minimalist environments",
      "Playful, energetic, and adventurous soundscapes"
    ]
  },
  {
    id: "experience",
    question: "How would you describe your experience with wellness products?",
    options: [
      "Curious beginner: looking for gentle introductions",
      "Confident intermediate: know my preferences well",
      "Adventurous explorer: love testing the latest innovations",
      "Co-explorer: looking to introduce items to my partner"
    ]
  },
  {
    id: "relationship",
    question: "What best describes your current relationship dynamic?",
    options: [
      "Solo journey: prioritizing self-care and discovery",
      "Committed partnership: seeking to renew or deepen our spark",
      "New relationship: building trust and physical connection",
      "Long-distance: keeping the connection alive remotely"
    ]
  },
  {
    id: "style",
    question: "Which description best fits your intimacy style?",
    options: [
      "Slow, tactile, and highly touch-focused",
      "Fun, lighthearted, and playful",
      "Deep, emotional, and communication-driven",
      "Spontaneous, intense, and adventurous"
    ]
  }
];

export default function SensoryQuizPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSelectOption = (option: string) => {
    const questionId = QUESTIONS[currentStep].id;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitQuiz({ ...answers, [questionId]: option });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const submitQuiz = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    setError("");
    
    // Map internal key to full question text for better AI understanding
    const mappedAnswers: Record<string, string> = {};
    QUESTIONS.forEach((q) => {
      mappedAnswers[q.question] = finalAnswers[q.id] || "";
    });

    try {
      const res = await apiFetch("/api/advisor/compatibility-profile", {
        method: "POST",
        body: JSON.stringify({ answers: mappedAnswers }),
      });
      if (res.error) throw new Error(res.error);
      setProfile(res.profile);
    } catch (err: any) {
      setError(err.message || "Failed to generate your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setAnswers({});
    setProfile(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/50 via-white to-rose-50/20 dark:from-gray-950 dark:to-gray-900 px-4 py-16 flex items-center justify-center">
      <div className="max-w-xl w-full">
        {/* Header (visible during quiz steps) */}
        {!profile && !loading && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-full text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> AI Sensory & Compatibility Quiz
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discover Your Wellness Profile</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Answer 5 quick questions to unlock a personalized sensory profile curated by Google Gemini.
            </p>
          </div>
        )}

        {/* Quiz Body */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 md:p-8">
          {loading ? (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-rose-500 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Consulting AI Wellness Advisor...</p>
              <p className="text-xs text-gray-400">Analyzing your sensory responses and curating recommendations...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Something went wrong</h2>
              <p className="text-sm text-gray-500">{error}</p>
              <button onClick={handleRestart} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                Try Again
              </button>
            </div>
          ) : profile ? (
            /* Results Screen */
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                  <Award className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Sensory & Compatibility Profile</h2>
                  <p className="text-[10px] text-green-600 font-medium">✓ Saved securely to your PleasureZone account</p>
                </div>
              </div>

              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans bg-rose-50/20 dark:bg-gray-900/40 p-4 rounded-2xl border border-rose-100/10">
                {profile}
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-500 shrink-0" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Your profile helps our advisor bot recommend better bundles. You can retake the quiz anytime.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleRestart}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Retake Quiz
                </button>
                <Link
                  href="/store"
                  className="flex-1 bg-primary text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-primary/95 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" /> Explore Shop
                </Link>
              </div>
            </div>
          ) : (
            /* Quiz Questions */
            <div className="space-y-6">
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Question {currentStep + 1} of {QUESTIONS.length}</span>
                <span className="font-semibold text-rose-500">{Math.round(((currentStep + 1) / QUESTIONS.length) * 100)}% Complete</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                {QUESTIONS[currentStep].question}
              </h2>

              <div className="space-y-3">
                {QUESTIONS[currentStep].options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50/10 dark:hover:bg-gray-900/40 transition-all font-medium text-sm text-gray-700 dark:text-gray-300"
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to previous question
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
