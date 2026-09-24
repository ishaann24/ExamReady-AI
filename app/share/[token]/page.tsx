"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface TopicItem {
  name: string;
  description: string;
  status: string;
}

interface ShareReportData {
  sessionName: string;
  createdAt: string;
  report: {
    totalTopics: number;
    assessedTopics: number;
    strongTopics: string[];
    remainingWeakTopics: string[];
    diagnostic: { correct: number; total: number };
    followup: { correct: number; total: number };
  };
  topics: TopicItem[];
}

export default function PublicSharePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const [data, setData] = useState<ShareReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This link is invalid or has expired");
      setLoading(false);
      return;
    }

    const fetchSharedReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            errJson.error || "This link is invalid or has expired"
          );
        }
        const json: ShareReportData = await res.json();
        setData(json);
      } catch (err: any) {
        console.error("Fetch shared report error:", err);
        setError(err.message || "This link is invalid or has expired");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedReport();
  }, [token]);

  const getBorderColor = (status: string) => {
    switch (status) {
      case "strong":
        return "border-l-status-strong";
      case "needs_revision":
        return "border-l-status-needs-revision";
      case "weak":
        return "border-l-status-weak";
      default:
        return "border-l-status-not-assessed";
    }
  };

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case "strong":
        return "text-status-strong border border-emerald-300 bg-emerald-50";
      case "needs_revision":
        return "text-amber-800 border border-amber-300 bg-amber-50";
      case "weak":
        return "text-status-weak border border-red-300 bg-red-50";
      default:
        return "text-text-muted border border-slate-300 bg-slate-100";
    }
  };

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case "strong":
        return "Strong";
      case "needs_revision":
        return "Needs Revision";
      case "weak":
        return "Weak";
      default:
        return "Not Assessed";
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col items-center justify-center p-8">
        <p className="text-lg font-medium text-primary tracking-tight animate-pulse">
          Loading shared readiness report...
        </p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 max-w-xl mx-auto w-full">
        <div className="my-auto py-12 text-center bg-surface border border-slate-200 rounded-xl p-8 shadow-xs">
          <h1 className="text-2xl font-bold text-text mb-3">
            Invalid or Expired Link
          </h1>
          <p className="text-sm text-text-muted mb-6 leading-relaxed">
            This link is invalid or has expired. The student may have revoked or regenerated this shared report link.
          </p>
          <Link
            href="/"
            className="bg-primary hover:bg-blue-900 text-white font-semibold px-6 py-2.5 rounded-md text-sm inline-block transition-colors shadow-xs"
          >
            Go to Home
          </Link>
        </div>

        <footer className="border-t border-slate-200 pt-6 text-center text-xs text-text-muted">
          Powered by <span className="font-semibold text-text">ExamReady AI</span>
        </footer>
      </main>
    );
  }

  const { sessionName, report, topics } = data;
  const improvedTopics = (report.strongTopics || []).filter(
    (t) => !(report.remainingWeakTopics || []).includes(t)
  );

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-8 md:px-12 max-w-4xl mx-auto w-full">
      <div>
        {/* Read-only Header */}
        <header className="border-b border-slate-200 pb-6 mb-8 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold font-mono text-text-muted">
              Shared Readiness Report
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text mt-1">
              {sessionName}
            </h1>
          </div>
          <span className="text-xs font-mono text-text-muted border border-slate-300 px-3 py-1 rounded-md bg-surface">
            Read-Only
          </span>
        </header>

        {/* Improved Topics */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-text mb-3">What Improved</h2>
          {improvedTopics.length > 0 ? (
            <div className="bg-surface border border-slate-200 rounded-lg p-5 shadow-xs">
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-text">
                {improvedTopics.map((t) => (
                  <li key={t} className="font-medium">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-surface border border-slate-200 rounded-lg p-5 text-sm text-text-muted shadow-xs">
              No topics improved yet in this session.
            </div>
          )}
        </section>

        {/* Remaining Weak Topics */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-text mb-3">
            Remaining Weak / Needs Revision Topics
          </h2>
          {(report.remainingWeakTopics?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {topics
                .filter((t) => (report.remainingWeakTopics ?? []).includes(t.name))
                .map((t) => (
                  <div
                    key={t.name}
                    className={`p-4 rounded-r-md border border-slate-200 border-l-4 bg-surface shadow-xs ${getBorderColor(
                      t.status
                    )}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text text-sm">{t.name}</h3>
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-xs ${getBadgeStyle(
                          t.status
                        )}`}
                      >
                        {formatStatusLabel(t.status)}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-surface border border-slate-200 rounded-lg p-5 text-sm text-text-muted shadow-xs">
              All topics are strong!
            </div>
          )}
        </section>

        {/* Overall Stats */}
        <section className="bg-surface border border-slate-200 rounded-xl p-6 shadow-xs mb-10">
          <h2 className="text-lg font-bold text-text mb-4">Overall Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="p-3 border border-slate-200 rounded-md bg-surface-muted">
              <span className="text-xs text-text-muted font-medium block">Total Topics</span>
              <span className="text-xl font-bold text-text font-mono mt-0.5 block">
                {report.totalTopics}
              </span>
            </div>
            <div className="p-3 border border-slate-200 rounded-md bg-surface-muted">
              <span className="text-xs text-text-muted font-medium block">Assessed Topics</span>
              <span className="text-xl font-bold text-text font-mono mt-0.5 block">
                {report.assessedTopics}
              </span>
            </div>
            <div className="p-3 border border-emerald-200 bg-emerald-50/50 rounded-md">
              <span className="text-xs text-emerald-900 font-medium block">Strong Topics</span>
              <span className="text-xl font-bold text-status-strong font-mono mt-0.5 block">
                {report.strongTopics?.length ?? 0}
              </span>
            </div>
            <div className="p-3 border border-slate-200 rounded-md bg-surface-muted">
              <span className="text-xs text-text-muted font-medium block">Diagnostic Score</span>
              <span className="text-xl font-bold text-text font-mono mt-0.5 block">
                {report.diagnostic.correct} / {report.diagnostic.total}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Powered by ExamReady AI Footer */}
      <footer className="border-t border-slate-200 pt-6 flex items-center justify-between text-xs text-text-muted">
        <span>Powered by <strong className="text-text font-semibold">ExamReady AI</strong></span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-strong"></span>
          Precision Study Tools
        </span>
      </footer>
    </main>
  );
}
