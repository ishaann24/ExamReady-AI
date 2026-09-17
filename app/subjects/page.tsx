"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TopicCounts {
  strong: number;
  needs_revision: number;
  weak: number;
  not_assessed: number;
  total: number;
}

interface ExamSessionSummary {
  id: string;
  exam_date: string | null;
  available_study_time_minutes: number | null;
  created_at: string;
  days_remaining: number | null;
  topic_counts: TopicCounts;
}

interface SubjectItem {
  id: string;
  name: string;
  created_at: string;
  sessions: ExamSessionSummary[];
  latest_session: ExamSessionSummary | null;
}

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/subjects");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login?redirectTo=/subjects");
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load subjects.");
        }
        const data = await res.json();
        setSubjects(data.subjects || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An unexpected error occurred loading your subjects.");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [router]);

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-10 md:px-16 md:py-16 max-w-5xl mx-auto w-full">
      <div>
        {/* Page Header */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-text">
                My Subjects
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Select a course subject to continue study sessions or track exam readiness.
              </p>
            </div>
            <Link
              href="/new-session"
              className="bg-accent hover:bg-amber-500 active:scale-[0.99] text-slate-950 font-semibold px-5 py-2.5 rounded-md transition-all text-sm inline-flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
            >
              <span className="text-base font-bold">+</span> New Exam Session
            </Link>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <p className="text-base font-medium text-primary tracking-tight">
              Loading your subjects...
            </p>
            <p className="text-xs text-text-muted mt-2">
              Retrieving study sessions and mastery counts
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center max-w-lg mx-auto my-8">
            <h2 className="text-lg font-bold text-red-900 mb-2">Error Loading Subjects</h2>
            <p className="text-xs text-red-700 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-md hover:bg-red-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content State */}
        {!loading && !error && (
          <>
            {subjects.length === 0 ? (
              /* Empty State */
              <div className="bg-surface border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 shadow-xs">
                <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  📚
                </div>
                <h2 className="text-xl font-bold text-text mb-2">No Study Sessions Yet</h2>
                <p className="text-xs text-text-muted leading-relaxed mb-6">
                  You haven&apos;t created any exam preparation sessions. Upload your lecture notes or syllabus to extract topics and build active-recall quizzes.
                </p>
                <Link
                  href="/new-session"
                  className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3 rounded-md text-sm inline-block shadow-sm transition-all"
                >
                  + Start First Exam Session
                </Link>
              </div>
            ) : (
              /* Grid of Subjects */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Quick New Session Card */}
                <Link
                  href="/new-session"
                  className="group bg-surface border-2 border-dashed border-slate-300 hover:border-accent hover:bg-amber-50/40 rounded-xl p-6 transition-all flex flex-col justify-center items-center text-center min-h-[200px]"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-amber-200/60 text-slate-700 group-hover:text-amber-950 flex items-center justify-center text-lg font-bold mb-3 transition-colors">
                    +
                  </div>
                  <h3 className="text-base font-bold text-text group-hover:text-primary transition-colors">
                    Create New Exam Session
                  </h3>
                  <p className="text-xs text-text-muted mt-1 max-w-xs">
                    Upload course materials or past papers to prepare for another exam.
                  </p>
                </Link>

                {/* 2. Subject Cards */}
                {subjects.map((subject) => {
                  const latest = subject.latest_session;
                  const topicCounts = latest?.topic_counts;

                  const formattedExamDate = latest?.exam_date
                    ? new Date(latest.exam_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div
                      key={subject.id}
                      className="bg-surface border border-slate-200 hover:border-slate-300 rounded-xl p-6 shadow-xs flex flex-col justify-between transition-all"
                    >
                      <div>
                        {/* Header & Days Remaining */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted block mb-0.5">
                              Subject
                            </span>
                            <h2 className="text-xl font-bold text-text tracking-tight">
                              {subject.name}
                            </h2>
                          </div>

                          {latest?.days_remaining !== null && latest?.days_remaining !== undefined && (
                            <div className="bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-md text-xs font-mono font-bold shrink-0 text-center">
                              <span className="text-sm font-extrabold block leading-none">
                                {latest.days_remaining}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider font-semibold">
                                {latest.days_remaining === 1 ? "day left" : "days left"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Exam Date Info */}
                        {formattedExamDate && (
                          <p className="text-xs text-text-muted font-mono mb-4">
                            Target Exam: <span className="font-semibold text-text">{formattedExamDate}</span>
                          </p>
                        )}

                        {/* Compact Topic Status Summary */}
                        {topicCounts && topicCounts.total > 0 ? (
                          <div className="bg-surface-muted border border-slate-200 rounded-lg p-3.5 mb-5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-text">
                              <span>Mastery Progress</span>
                              <span className="font-mono text-text-muted">
                                {topicCounts.strong}/{topicCounts.total} Mastered
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                              <span className="px-2 py-0.5 rounded-xs bg-emerald-50 text-status-strong border border-emerald-200 text-[11px]">
                                {topicCounts.strong} strong
                              </span>
                              <span className="px-2 py-0.5 rounded-xs bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
                                {topicCounts.needs_revision} needs revision
                              </span>
                              <span className="px-2 py-0.5 rounded-xs bg-red-50 text-status-weak border border-red-200 text-[11px]">
                                {topicCounts.weak} weak
                              </span>
                              {topicCounts.not_assessed > 0 && (
                                <span className="px-2 py-0.5 rounded-xs bg-slate-100 text-text-muted border border-slate-300 text-[11px]">
                                  {topicCounts.not_assessed} not assessed
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-surface-muted border border-slate-200 rounded-lg p-3.5 mb-5 text-xs text-text-muted font-mono">
                            No topics assessed yet in this session.
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-text-muted font-mono">
                          {subject.sessions.length} {subject.sessions.length === 1 ? "session" : "sessions"}
                        </span>

                        {latest ? (
                          <Link
                            href={`/dashboard/${latest.id}`}
                            className="bg-primary hover:bg-blue-900 active:scale-[0.99] text-white font-semibold text-xs px-4 py-2 rounded-md transition-all inline-flex items-center gap-1 shadow-xs"
                          >
                            Open Dashboard →
                          </Link>
                        ) : (
                          <Link
                            href="/new-session"
                            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold text-xs px-4 py-2 rounded-md transition-all inline-flex items-center gap-1 shadow-xs"
                          >
                            Start Session →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 mt-12 flex items-center justify-between text-xs text-text-muted">
        <span>Precision study tools for high-stakes preparation.</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-strong"></span>
          System Operational
        </span>
      </footer>
    </main>
  );
}
