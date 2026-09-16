"use client";

import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PrioritizedTopic } from "@/app/api/knowledge-gaps/route";

const PDFDownloadButton = dynamic(() => import("@/components/pdf-download-button"), {
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center px-4 py-2 bg-primary/70 text-white font-medium text-sm rounded-md cursor-wait">
      Preparing PDF...
    </span>
  ),
});

interface ReadinessReportData {
  totalTopics: number;
  assessedTopics: number;
  strongTopics: string[];
  remainingWeakTopics: string[];
  diagnostic: { correct: number; total: number };
  followup: { correct: number; total: number };
}

interface ReportPageProps {
  params: { sessionId: string };
}

export default function ReadinessReportPage({ params }: ReportPageProps) {
  const { sessionId } = params;
  const router = useRouter();

  const [report, setReport] = useState<ReadinessReportData | null>(null);
  const [topics, setTopics] = useState<PrioritizedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, gapsRes] = await Promise.all([
          fetch(`/api/readiness-report/${sessionId}`),
          fetch("/api/knowledge-gaps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }),
        ]);
        if (!reportRes.ok) throw new Error("Failed to load readiness report");
        if (!gapsRes.ok) throw new Error("Failed to load knowledge gaps");
        const reportJson = await reportRes.json();
        const gapsJson = await gapsRes.json();
        setReport(reportJson);
        setTopics(gapsJson.prioritizedTopics || []);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col items-center justify-center p-8">
        <p className="text-xl">Loading readiness report...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col items-center justify-center p-8">
        <p className="text-red-600">{error}</p>
        <Link href={`/dashboard/${sessionId}`} className="mt-4 text-primary underline">
          Back to Dashboard
        </Link>
      </main>
    );
  }

  const improvedTopics =
    (report?.strongTopics ?? []).filter((t) => !(report?.remainingWeakTopics ?? []).includes(t));

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

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col px-6 py-8 md:px-12 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">Readiness Report</h1>
        <Link href={`/dashboard/${sessionId}`} className="text-primary underline">
          Back to Dashboard
        </Link>
      </header>

      {/* PDF Download */}
      <div className="mb-4">
        <PDFDownloadButton
          sessionId={sessionId}
          improvedTopics={improvedTopics}
          remainingWeakTopics={report?.remainingWeakTopics || []}
          diagnosticCorrect={report?.diagnostic.correct ?? 0}
          diagnosticTotal={report?.diagnostic.total ?? 0}
          followupCorrect={report?.followup.correct ?? 0}
          followupTotal={report?.followup.total ?? 0}
        />
      </div>

      {/* What Improved */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">What Improved</h2>
        {improvedTopics.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {improvedTopics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">No topics improved this session.</p>
        )}
      </section>

      {/* Remaining Weak Topics */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Remaining Weak / Needs Revision Topics</h2>
        {(report?.remainingWeakTopics?.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {topics
                             .filter((t) => (report?.remainingWeakTopics ?? []).includes(t.name))
              .map((t) => (
                <div
                  key={t.name}
                  onClick={() => router.push(`/revision/${sessionId}/${encodeURIComponent(t.name)}`)}
                  className={`p-4 rounded-r-md border border-slate-200 border-l-4 bg-surface cursor-pointer hover:bg-slate-50 ${getBorderColor(
                    t.status
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-text">{t.name}</h3>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${getBadgeStyle(t.status)}`}> {formatStatusLabel(t.status)} </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">{t.description}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-text-muted">All topics are strong!</p>
        )}
      </section>

      {/* Stats */}
      <section className="bg-surface p-4 rounded-md border border-slate-200">
        <h2 className="text-lg font-semibold mb-3">Overall Stats</h2>
        <p>Total Topics: {report?.totalTopics}</p>
        <p>Assessed Topics: {report?.assessedTopics}</p>
        <p>Strong Topics: {(report?.strongTopics?.length ?? 0)}</p>
        <p>Diagnostic – Correct: {report?.diagnostic.correct} / {report?.diagnostic.total}</p>
        <p>Follow‑up – Correct: {report?.followup.correct} / {report?.followup.total}</p>
      </section>
    </main>
  );
}
