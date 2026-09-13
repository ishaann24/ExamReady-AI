"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnswerResult } from "../api/evaluate-assessment/route";

interface EvaluationData {
  results: AnswerResult[];
  score: number;
  max_score: number;
}

export default function ResultsPage() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const rawResults = sessionStorage.getItem("examready_results");
    if (!rawResults) {
      setError("No evaluation results found. Please complete an assessment session.");
      return;
    }

    try {
      const parsed: EvaluationData = JSON.parse(rawResults);
      if (!parsed || typeof parsed.score !== "number" || !Array.isArray(parsed.results)) {
        throw new Error("Invalid results format.");
      }
      setData(parsed);
    } catch (err: any) {
      console.error(err);
      setError("Failed to parse evaluation results.");
    }
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
        <header className="flex items-center justify-between border-b border-slate-200 pb-6">
          <Link
            href="/"
            className="font-bold text-sm tracking-wider uppercase text-primary hover:opacity-80 transition-opacity"
          >
            ExamReady AI
          </Link>
          <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface shadow-xs">
            Results
          </span>
        </header>

        <div className="my-auto py-12 max-w-xl mx-auto w-full text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
            No Results Found
          </h1>
          <p className="text-status-weak text-base mb-6 font-normal">{error}</p>
          <Link
            href="/new-session"
            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base inline-block shadow-sm"
          >
            Start New Session
          </Link>
        </div>

        <footer className="border-t border-slate-200 pt-6 flex items-center justify-between text-xs text-text-muted">
          <span>Precision study tools for high-stakes preparation.</span>
        </footer>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
        <div className="my-auto text-center py-16">
          <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
            Loading assessment results...
          </p>
        </div>
      </main>
    );
  }

  // Group results by topic
  const groupedResults = data.results.reduce<Record<string, AnswerResult[]>>(
    (acc, item) => {
      if (!acc[item.topic]) {
        acc[item.topic] = [];
      }
      acc[item.topic].push(item);
      return acc;
    },
    {}
  );

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <Link
          href="/"
          className="font-bold text-sm tracking-wider uppercase text-primary hover:opacity-80 transition-opacity"
        >
          ExamReady AI
        </Link>
        <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface shadow-xs">
          Assessment Results
        </span>
      </header>

      {/* Main Content */}
      <div className="my-auto py-12 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
          Diagnostic Evaluation
        </h1>
        <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
          Review your topic recall performance and explanation breakdowns.
        </p>

        {/* Score Summary Box */}
        <div className="border border-slate-200 rounded-md p-6 bg-surface shadow-xs mb-10 flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted uppercase tracking-wider font-mono font-medium">
              Overall Score
            </span>
            <p className="text-3xl font-bold text-text mt-1">
              {data.score} of {data.max_score}
            </p>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              data.score === data.max_score
                ? "bg-status-strong"
                : "bg-accent"
            }`}
          ></div>
        </div>

        {/* Grouped Topic Results */}
        <div className="space-y-8 mb-10">
          {Object.entries(groupedResults).map(([topicName, items]) => {
            const topicCorrectCount = items.filter((i) => i.correct).length;

            return (
              <div key={topicName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-base font-semibold text-text">
                    {topicName}
                  </h2>
                  <span className="text-xs text-text-muted font-mono">
                    {topicCorrectCount} of {items.length} correct
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.question_id}
                      className={`p-5 rounded-r-md border border-slate-200 border-l-4 bg-surface shadow-xs transition-all ${
                        item.correct
                          ? "border-l-status-strong"
                          : "border-l-status-weak"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-sm font-semibold text-text leading-snug">
                          {item.question}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-xs shrink-0 ${
                            item.correct
                              ? "text-status-strong border border-emerald-300 bg-emerald-50"
                              : "text-status-weak border border-red-300 bg-red-50"
                          }`}
                        >
                          {item.correct ? "Correct" : "Incorrect"}
                        </span>
                      </div>

                      {/* Inline explanation & answer details for incorrect answers */}
                      {!item.correct && (
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-xs text-text-muted">
                            <span className="text-status-weak font-semibold">Your selection:</span>{" "}
                            {item.selected_option_text}
                          </p>
                          <p className="text-xs text-text-muted">
                            <span className="text-status-strong font-semibold">Correct choice:</span>{" "}
                            {item.correct_option_text}
                          </p>
                          <div className="pt-1">
                            <p className="text-xs text-text/90 leading-relaxed font-normal">
                              <span className="text-text-muted font-semibold">Explanation:</span>{" "}
                              {item.explanation}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/new-session"
            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base text-center w-full sm:w-auto inline-block shadow-sm"
          >
            Start New Preparation Session
          </Link>
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
          >
            Return to Overview
          </Link>
        </div>
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
