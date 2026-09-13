"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types";
import { PrioritizedTopic } from "../../api/knowledge-gaps/route";

interface DashboardData {
  session: Session;
  prioritizedTopics: PrioritizedTopic[];
}

export default function DashboardHubPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const { sessionId } = params;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [expandedStrongTopic, setExpandedStrongTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Session ID is missing.");
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        // Fetch session details & knowledge gap priorities in parallel
        const [sessionRes, gapsRes] = await Promise.all([
          fetch(`/api/session/${sessionId}`),
          fetch("/api/knowledge-gaps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }),
        ]);

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load session details.");
        }

        if (!gapsRes.ok) {
          const errData = await gapsRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to calculate knowledge gaps.");
        }

        const session: Session = await sessionRes.json();
        const gapsData: { prioritizedTopics: PrioritizedTopic[] } = await gapsRes.json();

        setData({
          session,
          prioritizedTopics: gapsData.prioritizedTopics || [],
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred while loading your dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
        <header className="flex items-center justify-between border-b border-slate-200 pb-6">
          <Link href="/" className="font-bold text-sm tracking-wider uppercase text-primary">
            ExamReady AI
          </Link>
          <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface">
            Dashboard Hub
          </span>
        </header>
        <div className="my-auto py-16 text-center">
          <p className="text-xl font-medium text-primary tracking-tight">
            Loading student dashboard hub...
          </p>
          <p className="text-xs text-text-muted mt-2">
            Retrieving material stats, priority matrix, and mastery statuses
          </p>
        </div>
        <footer className="border-t border-slate-200 pt-6 flex items-center justify-between text-xs text-text-muted">
          <span>Precision study tools for high-stakes preparation.</span>
        </footer>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
        <header className="flex items-center justify-between border-b border-slate-200 pb-6">
          <Link href="/" className="font-bold text-sm tracking-wider uppercase text-primary">
            ExamReady AI
          </Link>
          <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface">
            Dashboard Error
          </span>
        </header>
        <div className="my-auto py-12 max-w-xl mx-auto w-full text-center">
          <h1 className="text-3xl font-bold text-text mb-3">Unable to Load Dashboard</h1>
          <p className="text-status-weak text-base mb-6">{error}</p>
          <Link
            href="/new-session"
            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3 rounded-md text-sm inline-block shadow-sm"
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

  const { session, prioritizedTopics } = data;

  // Calculate live exam date & days remaining
  const createdDate = new Date(session.createdAt || Date.now());
  const examDate = new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const today = new Date();
  const diffMs = examDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const formattedExamDate = examDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Calculate stats
  const totalTopicsCount = prioritizedTopics.length;
  const assessedTopicsCount = prioritizedTopics.filter((t) => t.status !== "not_assessed").length;
  const masteredTopicsCount = prioritizedTopics.filter((t) => t.status === "strong").length;

  // Priority #1 Target
  const topPriorityTopic = prioritizedTopics.find((t) => t.status !== "strong") || prioritizedTopics[0];

  const getBorderColor = (status: string) => {
    switch (status) {
      case "strong":
        return "border-l-status-strong";
      case "needs_revision":
        return "border-l-status-needs-revision";
      case "weak":
        return "border-l-status-weak";
      case "not_assessed":
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
      case "not_assessed":
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
      case "not_assessed":
      default:
        return "Not Assessed";
    }
  };

  const handleTopicClick = (topic: PrioritizedTopic) => {
    if (topic.status !== "strong") {
      router.push(`/revision/${sessionId}/${encodeURIComponent(topic.name)}`);
    } else {
      setExpandedStrongTopic((prev) => (prev === topic.name ? null : topic.name));
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-10 md:px-16 md:py-16 max-w-5xl mx-auto w-full">
      {/* Navigation Header */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
        <Link
          href="/"
          className="font-bold text-sm tracking-wider uppercase text-primary hover:opacity-80 transition-opacity"
        >
          ExamReady AI
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/new-session"
            className="text-xs font-semibold text-text hover:text-primary border border-slate-300 px-3 py-1.5 rounded-md bg-surface transition-colors"
          >
            + New Material
          </Link>
        </div>
      </header>

      <div className="space-y-8 mb-12">
        {/* 1. EXAM HEADER CARD (Primary Visual Anchor) */}
        <section className="bg-primary text-white rounded-lg p-6 sm:p-8 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-200 font-mono">
                Course Material Target
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-white truncate max-w-lg">
                {session.fileName || "Course Study Material"}
              </h1>
              <p className="text-xs text-blue-100 mt-2 font-mono">
                Target Exam Date: {formattedExamDate}
              </p>
            </div>

            <div className="bg-blue-900/60 border border-blue-400/30 rounded-md p-4 text-center shrink-0 min-w-[140px]">
              <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 block font-mono">
                {daysRemaining}
              </span>
              <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">
                {daysRemaining === 1 ? "Day Remaining" : "Days Remaining"}
              </span>
            </div>
          </div>
        </section>
        {/* View Readiness Report button */}
        <div className="mt-4 flex justify-end">
          <Link
            href={`/report/${sessionId}`}
            className="bg-primary hover:bg-primary/80 text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            View Readiness Report
          </Link>
        </div>

        {/* 2. YOUR NEXT BEST ACTION CARD */}
        {topPriorityTopic && (
          <section className="bg-amber-50/80 border-2 border-accent rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 font-mono">
                Your Next Best Action
              </span>
              <span className="text-xs font-mono text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-xs font-semibold">
                Priority #1 Target
              </span>
            </div>
            <h2 className="text-xl font-bold text-text mb-1">
              {topPriorityTopic.name}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              {topPriorityTopic.reason}
            </p>
            <div>
              <Link
                href={`/revision/${sessionId}/${encodeURIComponent(topPriorityTopic.name)}`}
                className="bg-accent hover:bg-amber-500 active:scale-[0.99] text-slate-950 font-semibold px-6 py-3 rounded-md transition-all duration-150 text-sm inline-block shadow-sm cursor-pointer"
              >
                Start Revision
              </Link>
            </div>
          </section>
        )}

        {/* 3. KNOWLEDGE OVERVIEW SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-text">
                Knowledge Overview
              </h2>
              <p className="text-xs text-text-muted">
                Click any non-strong topic to launch an instant focused revision session.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {prioritizedTopics.map((topic) => {
              const isStrong = topic.status === "strong";
              const isExpandedNote = expandedStrongTopic === topic.name;

              return (
                <div
                  key={topic.name}
                  onClick={() => handleTopicClick(topic)}
                  className={`p-5 rounded-r-md border border-slate-200 border-l-4 bg-surface shadow-xs transition-all ${getBorderColor(
                    topic.status
                  )} ${
                    isStrong
                      ? "cursor-pointer hover:bg-slate-50/80"
                      : "cursor-pointer hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                      {topic.name}
                      {!isStrong && (
                        <span className="text-xs text-primary font-semibold hover:underline">
                          Revise →
                        </span>
                      )}
                    </h3>
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-xs border shrink-0 ${getBadgeStyle(
                        topic.status
                      )}`}
                    >
                      {formatStatusLabel(topic.status)}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-2">
                    {topic.description}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-text-muted font-mono">
                      {topic.reason}
                    </p>
                  </div>

                  {/* Inline Note for Strong topics when clicked */}
                  {isStrong && isExpandedNote && (
                    <div className="mt-3 pt-3 border-t border-emerald-200 text-xs text-status-strong font-medium bg-emerald-50/50 p-2.5 rounded-sm">
                      Mastered in latest diagnostic assessment — no revision required at this time.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. PREPARATION PROGRESS STAT ROW */}
        <section className="bg-surface border border-slate-200 rounded-lg p-6 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 font-mono">
            Preparation Progress
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-md bg-surface-muted">
              <span className="text-xs text-text-muted font-medium">Assessed Material</span>
              <p className="text-xl font-bold text-text mt-1">
                {assessedTopicsCount} of {totalTopicsCount} topics assessed
              </p>
            </div>

            <div className="p-4 border border-slate-200 rounded-md bg-surface-muted">
              <span className="text-xs text-text-muted font-medium">Mastered Topics</span>
              <p className="text-xl font-bold text-text mt-1">
                {masteredTopicsCount} {masteredTopicsCount === 1 ? "topic" : "topics"} mastered this session
              </p>
            </div>
          </div>
        </section>
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
