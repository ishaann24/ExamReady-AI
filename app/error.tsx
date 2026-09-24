"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error internally for monitoring without exposing raw details to user
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <Link href="/" className="font-bold text-sm tracking-wider uppercase text-primary">
          ExamReady AI
        </Link>
        <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface font-mono">
          System Notice
        </span>
      </header>

      {/* Main Content */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full text-center">
        <span className="text-xs font-bold uppercase tracking-wider font-mono text-status-weak bg-red-50 border border-red-200 px-3 py-1 rounded-xs inline-block mb-4">
          Unexpected Error
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
          Something went wrong
        </h1>

        <p className="text-text-muted text-base mb-8 leading-relaxed font-normal max-w-md mx-auto">
          An unexpected issue occurred while processing your request. Please try again or return to your subjects hub.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3 rounded-md transition-all duration-150 text-sm shadow-xs cursor-pointer w-full sm:w-auto"
          >
            Try Again
          </button>
          <Link
            href="/subjects"
            className="border border-slate-300 hover:border-slate-400 text-text font-medium px-6 py-3 rounded-md transition-colors duration-150 text-sm bg-surface w-full sm:w-auto"
          >
            Back to Subjects
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
