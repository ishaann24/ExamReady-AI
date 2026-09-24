"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Question, RevisionSession } from "@/lib/types";

type PagePhase = "loading" | "reading" | "practicing" | "completed" | "error";

interface PracticeAnswer {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

interface FollowupOutcome {
  improved: boolean;
  score: number;
  max_score: number;
  updatedStatus: string;
  results: any[];
}

export default function RevisionPage({
  params,
}: {
  params: { sessionId: string; topic: string };
}) {
  const sessionId = params.sessionId;
  const decodedTopic = decodeURIComponent(params.topic || "");

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [data, setData] = useState<RevisionSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [outcome, setOutcome] = useState<FollowupOutcome | null>(null);

  // Practice state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<PracticeAnswer[]>([]);

  useEffect(() => {
    if (!sessionId || !decodedTopic) {
      setErrorMessage("Missing session ID or topic.");
      setPhase("error");
      return;
    }

    const fetchRevision = async () => {
      setPhase("loading");
      setErrorMessage("");

      try {
        const res = await fetch("/api/generate-revision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, topic: decodedTopic }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to generate revision material.");
        }

        const result: RevisionSession = await res.json();
        setData(result);
        setPhase("reading");
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "An error occurred while building revision.");
        setPhase("error");
      }
    };

    fetchRevision();
  }, [sessionId, decodedTopic]);

  const handleStartPractice = () => {
    setPhase("practicing");
    setCurrentIndex(0);
    setSelectedOption(null);
    setUserAnswers([]);
  };

  const handleSelectOption = (index: number) => {
    setSelectedOption(index);
  };

  const handleNextPractice = async () => {
    if (selectedOption === null || !data) return;

    const currentQ = data.practiceQuestions[currentIndex];
    const newAnswersMap: Record<string, number> = {};

    userAnswers.forEach((a) => {
      newAnswersMap[a.questionId] = a.selectedIndex;
    });
    newAnswersMap[currentQ.id] = selectedOption;

    const isCorrect = selectedOption === currentQ.correct_index;
    const updated = [
      ...userAnswers,
      {
        questionId: currentQ.id,
        selectedIndex: selectedOption,
        isCorrect,
      },
    ];
    setUserAnswers(updated);
    setSelectedOption(null);

    if (currentIndex + 1 < data.practiceQuestions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setPhase("loading");
      try {
        const res = await fetch("/api/evaluate-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            topic: data.topic,
            questions: data.practiceQuestions,
            answers: newAnswersMap,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to evaluate practice questions.");
        }

        const evalOutcome: FollowupOutcome = await res.json();
        setOutcome(evalOutcome);
        setPhase("completed");
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "An error occurred while evaluating practice.");
        setPhase("error");
      }
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Main Content Area */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full">
        {phase === "loading" && (
          <div className="py-16 text-center">
            <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
              Processing revision content...
            </p>
            <p className="text-xs text-text-muted mt-3">
              Synthesizing concept notes, examples, and evaluating performance
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="py-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              Unable to load revision
            </h1>
            <p className="text-status-weak text-base mb-6 font-normal">
              {errorMessage}
            </p>
            <Link
              href={`/dashboard/${sessionId}`}
              className="border border-slate-300 hover:border-slate-400 text-text font-medium px-6 py-3 rounded-md text-sm inline-block bg-surface"
            >
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* Phase: Reading Section */}
        {phase === "reading" && data && (
          <div>
            <div className="mb-2">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider font-mono">
                Topic Revision
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-8">
              {data.topic}
            </h1>

            {/* Explanation Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-text-muted font-mono">
                  Core Concept
                </h3>
                {data.pageReferences && data.pageReferences.length > 0 && (
                  <span className="text-xs text-text-muted/80 font-mono">
                    — p. {data.pageReferences.join(", ")}
                  </span>
                )}
              </div>
              <p className="text-text/90 text-base leading-relaxed font-normal">
                {data.explanation}
              </p>
            </div>

            {/* Example Section */}
            <div className="mb-8 pt-6 border-t border-slate-200">
              <h3 className="text-xs uppercase tracking-wider font-bold text-text-muted mb-2 font-mono">
                Practical Example
              </h3>
              <p className="text-text/90 text-sm leading-relaxed font-normal">
                {data.example}
              </p>
            </div>

            {/* Common Pitfall Note Section */}
            <div className="mb-10 pt-6 border-t border-slate-200">
              <h3 className="text-xs uppercase tracking-wider font-bold text-status-weak mb-2 font-mono">
                Common Pitfall
              </h3>
              <p className="text-text/90 text-sm leading-relaxed font-normal">
                {data.commonMistake}
              </p>
            </div>

            {/* CTA framing leading into practice */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={handleStartPractice}
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm w-full sm:w-auto"
              >
                Test My Understanding
              </button>
              <Link
                href={`/dashboard/${sessionId}`}
                className="text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Phase: Practice Questions View */}
        {phase === "practicing" && data && data.practiceQuestions.length > 0 && (
          <div>
            {/* Header Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                Practice Question {currentIndex + 1} of {data.practiceQuestions.length}
              </span>
              <span className="text-xs text-text-muted capitalize border border-slate-300 px-2 py-0.5 rounded-md bg-surface">
                {data.practiceQuestions[currentIndex].difficulty}
              </span>
            </div>

            {/* Small Muted Topic Name */}
            <div className="mb-2">
              <span className="text-xs text-text-muted font-medium tracking-wide flex items-center gap-1.5">
                <span>{data.topic}</span>
                {data.practiceQuestions[currentIndex].pageReferences &&
                  data.practiceQuestions[currentIndex].pageReferences!.length > 0 && (
                    <span className="font-mono text-text-muted/80">
                      — p. {data.practiceQuestions[currentIndex].pageReferences!.join(", ")}
                    </span>
                  )}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text leading-snug mb-8">
              {data.practiceQuestions[currentIndex].question}
            </h2>

            {/* Options List */}
            <div className="border border-slate-200 rounded-md divide-y divide-slate-200 bg-surface shadow-xs mb-8">
              {data.practiceQuestions[currentIndex].options.map(
                (optionText: string, optIdx: number) => {
                  const isSelected = selectedOption === optIdx;
                  const optionLabel = String.fromCharCode(65 + optIdx);

                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-150 select-none ${
                        isSelected
                          ? "bg-blue-50/70 border-l-4 border-primary text-text font-medium"
                          : "hover:bg-slate-50 text-text/90"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-xs font-mono w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-primary text-primary font-bold bg-surface"
                              : "border-slate-300 text-text-muted"
                          }`}
                        >
                          {optionLabel}
                        </span>
                        <span className="text-sm font-normal leading-relaxed">
                          {optionText}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Action Area */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleNextPractice}
                disabled={selectedOption === null}
                className={`bg-accent text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm ${
                  selectedOption === null
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-amber-500"
                }`}
              >
                {currentIndex + 1 === data.practiceQuestions.length
                  ? "Complete Practice"
                  : "Next"}
              </button>
              {selectedOption === null && (
                <span className="text-xs text-text-muted">
                  Select an option to continue
                </span>
              )}
            </div>
          </div>
        )}

        {/* Phase: Completion & Outcome View */}
        {phase === "completed" && data && outcome && (
          <div className="py-6">
            {outcome.improved ? (
              <div className="border border-emerald-300 rounded-md p-6 bg-emerald-50/80 shadow-xs mb-8">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-status-strong"></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-status-strong font-mono">
                    Status Improved
                  </span>
                </div>
                <p className="text-lg font-bold text-text mb-1">
                  You've got this — {data.topic} is looking solid now.
                </p>
                <p className="text-xs text-text-muted font-mono">
                  Practice score: {outcome.score} of {outcome.max_score} correct
                </p>
              </div>
            ) : (
              <div className="border border-red-300 rounded-md p-6 bg-red-50/80 shadow-xs mb-8">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-status-weak"></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-status-weak font-mono">
                    Topic Needs Further Focus
                  </span>
                </div>
                <p className="text-base font-bold text-text mb-2">
                  {data.topic} requires additional review.
                </p>
                <p className="text-xs text-text/90 leading-relaxed font-normal">
                  <span className="text-text-muted font-semibold">Concept Reminder:</span>{" "}
                  {data.explanation}
                </p>
              </div>
            )}

            {/* Practice Explanations List */}
            <div className="space-y-4 mb-8">
              {data.practiceQuestions.map((q: Question, idx: number) => {
                const resItem = outcome.results[idx];
                const isCorrect = resItem?.correct;

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-r-md border border-slate-200 border-l-4 bg-surface shadow-xs ${
                      isCorrect ? "border-l-status-strong" : "border-l-status-weak"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-sm font-semibold text-text leading-snug">
                        Question {idx + 1}: {q.question}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-xs shrink-0 ${
                          isCorrect
                            ? "text-status-strong border border-emerald-300 bg-emerald-50"
                            : "text-status-weak border border-red-300 bg-red-50"
                        }`}
                      >
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </div>

                    {!isCorrect && resItem && (
                      <p className="text-xs text-text-muted mb-1">
                        <span className="text-status-weak font-semibold">Your selection:</span>{" "}
                        {resItem.selected_option_text}
                      </p>
                    )}

                    <p className="text-xs text-text-muted mb-1">
                      <span className="font-semibold text-text">Correct choice:</span>{" "}
                      {q.options[q.correct_index]}
                    </p>

                    <p className="text-xs text-text/80 leading-relaxed pt-1">
                      <span className="text-text-muted font-semibold">Explanation:</span>{" "}
                      {q.explanation}
                      {q.pageReferences && q.pageReferences.length > 0 && (
                        <span className="font-mono text-text-muted/80 ml-1.5">
                          — p. {q.pageReferences.join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href={`/dashboard/${sessionId}`}
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base text-center w-full sm:w-auto inline-block shadow-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 flex items-center justify-between text-xs text-text-muted">
        <span>Precision study tools for high-stakes preparation.</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-strong"></span>
          System Operational
        </span>
      </footer>
    </main>
  );
}
