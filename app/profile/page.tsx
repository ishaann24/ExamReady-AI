"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ProfileData {
  fullName: string;
  email: string;
  createdAt: string;
}

interface ProfileStats {
  totalSubjects: number;
  totalSessions: number;
  totalStrongTopics: number;
  totalImprovedTopics: number;
}

interface ProgressDataPoint {
  date: string;
  cumulativeTopicsMastered: number;
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [progress, setProgress] = useState<ProgressDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Full Name state
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>("");
  const [savingName, setSavingName] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, progressRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/profile/progress"),
        ]);

        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            router.push("/login?redirectTo=/profile");
            return;
          }
          const errData = await profileRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load profile.");
        }

        const profileJson = await profileRes.json();
        let progressJson = { progress: [] };
        if (progressRes.ok) {
          progressJson = await progressRes.json();
        }

        if (isMounted) {
          setProfile(
            profileJson.profile || {
              fullName: "Student",
              email: "",
              createdAt: new Date().toISOString(),
            }
          );
          setStats(
            profileJson.stats || {
              totalSubjects: 0,
              totalSessions: 0,
              totalStrongTopics: 0,
              totalImprovedTopics: 0,
            }
          );
          setProgress(progressJson.progress || []);
          setEditedName(profileJson.profile?.fullName || "");
        }
      } catch (err: any) {
        console.error("Profile load error:", err);
        if (isMounted) {
          setError(
            err.message || "An unexpected error occurred while loading profile."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfileData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSaveName = async () => {
    if (!editedName.trim()) return;

    setSavingName(true);
    setSaveSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editedName.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update full name.");
      }

      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, fullName: data.fullName } : null));
      setIsEditingName(false);
      setSaveSuccess("Profile name updated successfully.");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || "S").toUpperCase();
  };

  const formattedProgress = progress.map((p) => {
    const d = new Date(p.date);
    const formattedDate = isNaN(d.getTime())
      ? p.date
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      ...p,
      displayDate: formattedDate,
    };
  });

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-8 md:px-16 max-w-5xl mx-auto w-full">
      <div>
        {/* Page Header */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-text">
            Profile &amp; Study Stats
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your account info and view honest progress counts across your preparation history.
          </p>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <p className="text-base font-medium text-primary tracking-tight">
              Loading profile details...
            </p>
            <p className="text-xs text-text-muted mt-2">
              Retrieving account parameters and aggregated learning stats
            </p>
          </div>
        )}

        {/* Error Notification */}
        {!loading && error && (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md my-6 text-center">
            <p className="font-semibold mb-2">Error Loading Profile</p>
            <p className="text-xs mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-700 text-white text-xs px-4 py-2 rounded-md font-semibold hover:bg-red-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success Notification */}
        {saveSuccess && (
          <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
            ✓ {saveSuccess}
          </div>
        )}

        {/* Main Profile & Stats Content */}
        {!loading && profile && stats && (
          <div className="space-y-8">
            {/* 1. Account Details Card */}
            <section className="bg-surface border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full bg-primary text-white font-bold text-2xl flex items-center justify-center shrink-0 shadow-sm">
                  {getInitials(profile.fullName)}
                </div>

                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between gap-4">
                    {!isEditingName ? (
                      <div>
                        <h2 className="text-2xl font-bold text-text tracking-tight">
                          {profile.fullName}
                        </h2>
                        <p className="text-xs text-text-muted font-mono mt-0.5">
                          Student Account
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 max-w-md space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                      </div>
                    )}

                    {!isEditingName ? (
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="text-xs font-semibold text-primary hover:text-blue-900 border border-slate-300 hover:border-primary/40 px-3.5 py-1.5 rounded-md bg-surface transition-colors cursor-pointer shrink-0"
                      >
                        Edit Name
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          className="text-xs font-semibold text-white bg-primary hover:bg-blue-900 px-3.5 py-1.5 rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          {savingName ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingName(false);
                            setEditedName(profile.fullName);
                          }}
                          className="text-xs font-semibold text-text-muted hover:text-text border border-slate-300 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email & Joined Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-surface-muted">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold block mb-1">
                    Email Address (Non-editable)
                  </span>
                  <p className="text-sm font-semibold text-text font-mono truncate">
                    {profile.email}
                  </p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-surface-muted">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold block mb-1">
                    Member Since
                  </span>
                  <p className="text-sm font-semibold text-text">
                    {new Date(profile.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Honest Aggregate Study Progress Stats */}
            <section className="bg-surface border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-text">
                  Preparation Overview
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Actual progress totals derived directly from your completed sessions and quiz attempts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Subjects */}
                <div className="p-5 border border-slate-200 rounded-lg bg-surface-muted">
                  <span className="text-xs font-semibold text-text-muted block">
                    Total Subjects
                  </span>
                  <p className="text-3xl font-extrabold text-primary font-mono mt-2">
                    {stats.totalSubjects}
                  </p>
                  <span className="text-[11px] text-text-muted mt-1 block">
                    {stats.totalSubjects === 1 ? "course subject" : "course subjects"}
                  </span>
                </div>

                {/* Total Sessions */}
                <div className="p-5 border border-slate-200 rounded-lg bg-surface-muted">
                  <span className="text-xs font-semibold text-text-muted block">
                    Exam Sessions
                  </span>
                  <p className="text-3xl font-extrabold text-primary font-mono mt-2">
                    {stats.totalSessions}
                  </p>
                  <span className="text-[11px] text-text-muted mt-1 block">
                    {stats.totalSessions === 1 ? "study session" : "study sessions"}
                  </span>
                </div>

                {/* Mastered Topics */}
                <div className="p-5 border border-emerald-200/80 bg-emerald-50/40 rounded-lg">
                  <span className="text-xs font-semibold text-emerald-900 block">
                    Mastered Topics
                  </span>
                  <p className="text-3xl font-extrabold text-status-strong font-mono mt-2">
                    {stats.totalStrongTopics}
                  </p>
                  <span className="text-[11px] text-emerald-800 mt-1 block">
                    topics marked strong
                  </span>
                </div>

                {/* Improved Topics */}
                <div className="p-5 border border-amber-200/80 bg-amber-50/40 rounded-lg">
                  <span className="text-xs font-semibold text-amber-950 block">
                    Improved Topics
                  </span>
                  <p className="text-3xl font-extrabold text-amber-600 font-mono mt-2">
                    {stats.totalImprovedTopics}
                  </p>
                  <span className="text-[11px] text-amber-900 mt-1 block">
                    via focused revision
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Recharts Cumulative Progress Over Time */}
            <section className="bg-surface border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-text">
                  Mastery Progress Over Time
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Cumulative count of topics marked strong over time.
                </p>
              </div>

              {progress.length < 2 ? (
                <div className="py-12 border border-dashed border-slate-200 rounded-lg bg-surface-muted/50 text-center">
                  <p className="text-sm text-text-muted font-medium">
                    Complete more sessions to see your progress over time.
                  </p>
                  <p className="text-xs text-text-muted/70 mt-1">
                    At least 2 mastered topic milestones are required to generate your progress chart.
                  </p>
                </div>
              ) : (
                <div className="w-full h-64 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={formattedProgress}
                      margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        dy={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
                        }}
                        labelStyle={{ fontWeight: "bold", color: "#0f172a" }}
                        formatter={(value: any) => [
                          `${value} topics`,
                          "Cumulative Mastered",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativeTopicsMastered"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#4f46e5", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#4f46e5" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>
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
