"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Loader2, User, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Answer {
  id: string;
  content: string;
  userName: string;
  createdAt: string;
}

interface Question {
  id: string;
  content: string;
  userName: string;
  createdAt: string;
  answers: Answer[];
}

interface ProductQAProps {
  productId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
}

export default function ProductQA({ productId }: ProductQAProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [error, setError] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQuestions();
  }, [productId]);

  const loadQuestions = async () => {
    try {
      const data = await apiFetch(`/api/qa/product/${productId}`);
      setQuestions(data.questions || []);
    } catch {
      // Q&A may not be available
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/qa/questions", {
        method: "POST",
        body: JSON.stringify({ productId, content: questionText.trim() }),
      });
      setQuestionText("");
      setShowForm(false);
      loadQuestions();
    } catch {
      setError("Please sign in to ask a question.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;
    setSubmittingAnswer(true);
    setError("");
    try {
      await apiFetch("/api/qa/answers", {
        method: "POST",
        body: JSON.stringify({ questionId, content: answerText.trim() }),
      });
      setAnswerText("");
      setAnsweringId(null);
      loadQuestions();
    } catch {
      setError("Please sign in to answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="mt-8 border rounded-xl overflow-hidden bg-white px-6 pb-6">
      <div className="flex items-center justify-between py-5 border-b border-gray-200 -mx-6 px-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Questions & Answers</h2>
          {questions.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{questions.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Ask a Question
        </button>
      </div>

      {/* Ask Question Form */}
      {showForm && (
        <form onSubmit={handleAskQuestion} className="mt-4 p-4 bg-gray-50 rounded-xl border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Question</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[80px] resize-none"
            placeholder="What would you like to know about this product?"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
          />
          <div className="flex gap-2 mt-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>
      )}

      {/* Questions List */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="pb-4 border-b border-gray-100 last:border-0">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">Q</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{q.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <User className="w-3 h-3" />
                      <span>{q.userName}</span>
                      <span>·</span>
                      <span>{timeAgo(q.createdAt)}</span>
                    </div>
                  </div>
                  {q.answers.length > 0 && (
                    <button onClick={() => toggleExpanded(q.id)} className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0">
                      {q.answers.length} answer{q.answers.length > 1 ? "s" : ""}
                      {expandedQuestions.has(q.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Answers */}
                {expandedQuestions.has(q.id) && q.answers.length > 0 && (
                  <div className="ml-9 mt-3 space-y-3">
                    {q.answers.map((a) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold">A</span>
                        <div>
                          <p className="text-sm text-gray-700">{a.content}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>{a.userName}</span>
                            <span>·</span>
                            <span>{timeAgo(a.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer button */}
                {answeringId !== q.id && (
                  <button
                    onClick={() => { setAnsweringId(q.id); setAnswerText(""); }}
                    className="ml-9 mt-2 text-xs text-primary hover:underline"
                  >
                    Answer this question
                  </button>
                )}

                {/* Answer form */}
                {answeringId === q.id && (
                  <div className="ml-9 mt-3">
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[60px] resize-none"
                      placeholder="Write your answer..."
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button onClick={() => setAnsweringId(null)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Cancel</button>
                      <button
                        onClick={() => handleSubmitAnswer(q.id)}
                        disabled={submittingAnswer || !answerText.trim()}
                        className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium flex items-center gap-1"
                      >
                        {submittingAnswer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Submit Answer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No questions yet. Be the first to ask!</p>
          </div>
        )}
      </div>
    </div>
  );
}
