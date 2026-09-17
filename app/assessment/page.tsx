"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Question } from "../api/generate-assessment/route";

type AssessmentStatus = "loading" | "active" | "completed" | "error";

interface UserAnswer {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

export default function AssessmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AssessmentStatus>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const rawData = sessionStorage.getItem("examready_session_data");
    if (!rawData) {
      setStatus("error");
      setErrorMessage("No study material found. Please upload material first.");
      return;
    }

    try {
      const { text, topics, sessionId } = JSON.parse(rawData);
      if (!text || !topics) {
        throw new Error("Invalid session data format.");
      }

      fetchAssessment(text, topics, sessionId);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Failed to read session data. Please start a new session.");
    }
  }, []);

  const fetchAssessment = async (text: string, topics: any[], sid?: string) => {
    setStatus("loading");
    setErrorMessage("");
    setSessionId(sid);

    try {
      const res = await fetch("/api/generate-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, topics, sessionId: sid }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate assessment questions.");
      }

      const data: { questions: Question[] } = await res.json();
      setQuestions(data.questions || []);
      setStatus("active");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "An error occurred while building your assessment.");
    }
  };

  const handleSelectOption = (index: number) => {
    setSelectedOption(index);
  };

  const handleNext = async () => {
    if (selectedOption === null) return;

    const currentQuestion = questions[currentIndex];
    const newAnswersMap: Record<string, number> = {};

    userAnswers.forEach((a) => {
      newAnswersMap[a.questionId] = a.selectedIndex;
    });
    newAnswersMap[currentQuestion.id] = selectedOption;

    const isCorrect = selectedOption === currentQuestion.correct_index;
    const updatedAnswers = [
      ...userAnswers,
      {
        questionId: currentQuestion.id,
        selectedIndex: selectedOption,
        isCorrect,
      },
    ];
    setUserAnswers(updatedAnswers);
    setSelectedOption(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setStatus("loading");
      try {
        const res = await fetch("/api/evaluate-assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions, answers: newAnswersMap, sessionId }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to evaluate assessment.");
        }

        const evalData = await res.json();
        sessionStorage.setItem("examready_results", JSON.stringify(evalData));
        
        if (sessionId) {
          router.push(`/dashboard/${sessionId}`);
        } else {
          router.push("/results");
        }
      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setErrorMessage(err.message || "An error occurred while evaluating your results.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Main Content Area */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full">
        {status === "loading" && (
          <div className="py-16 text-center">
            <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
              Generating diagnostic assessment...
            </p>
            <p className="text-xs text-text-muted mt-3">
              Crafting recall and conceptual questions from your material
            </p>
          </div>
        )}

        {status === "active" && questions.length > 0 && (
          <div>
            {/* Header Meta: Progress & Topic */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-text-muted capitalize border border-slate-300 px-2 py-0.5 rounded-md bg-surface">
                {questions[currentIndex].difficulty}
              </span>
            </div>

            {/* Small Muted Topic Name */}
            <div className="mb-2">
              <span className="text-xs text-text-muted font-medium tracking-wide">
                {questions[currentIndex].topic}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text leading-snug mb-8">
              {questions[currentIndex].question}
            </h2>

            {/* Options List (Clickable rows) */}
            <div className="border border-slate-200 rounded-md divide-y divide-slate-200 bg-surface shadow-xs mb-8">
              {questions[currentIndex].options.map((optionText, optIdx) => {
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
              })}
            </div>

            {/* Action Area */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleNext}
                disabled={selectedOption === null}
                className={`bg-accent text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm ${
                  selectedOption === null
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-amber-500"
                }`}
              >
                {currentIndex + 1 === questions.length
                  ? "Complete Assessment"
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

        {status === "completed" && (
          <div className="py-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              Assessment Completed
            </h1>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Diagnostic recall evaluation finished.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/new-session"
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer text-center w-full sm:w-auto shadow-sm"
              >
                Start New Session
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              Unable to load assessment
            </h1>
            <p className="text-status-weak text-base mb-6 leading-relaxed font-normal">
              {errorMessage}
            </p>
            <div>
              <Link
                href="/new-session"
                className="border border-slate-300 hover:border-slate-400 text-text font-medium px-6 py-3 rounded-md transition-colors duration-150 text-sm inline-block bg-surface"
              >
                Return to upload screen
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
