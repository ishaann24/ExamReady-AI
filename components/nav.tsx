"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Do not render top navigation on public login, signup, or home landing page
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/api/auth/logout";
    }
  };

  const isSubjects = pathname === "/subjects";
  const isNewSession = pathname === "/new-session";
  const isProfile = pathname === "/profile";

  return (
    <header className="max-w-5xl mx-auto w-full px-6 pt-6 mb-6 flex items-center justify-between border-b border-slate-200 pb-4 bg-surface-muted">
      <div className="flex items-center gap-6">
        <Link
          href="/subjects"
          className="font-bold text-sm tracking-wider uppercase text-primary hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block"></span>
          ExamReady AI
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/subjects"
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isSubjects
                ? "bg-primary/10 text-primary font-semibold"
                : "text-text-muted hover:text-text hover:bg-slate-100"
            }`}
          >
            My Subjects
          </Link>
          <Link
            href="/new-session"
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isNewSession
                ? "bg-primary/10 text-primary font-semibold"
                : "text-text-muted hover:text-text hover:bg-slate-100"
            }`}
          >
            + New Session
          </Link>
          <Link
            href="/profile"
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isProfile
                ? "bg-primary/10 text-primary font-semibold"
                : "text-text-muted hover:text-text hover:bg-slate-100"
            }`}
          >
            Profile
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/subjects"
          className="sm:hidden text-xs font-medium text-text-muted hover:text-primary"
        >
          Subjects
        </Link>
        <Link
          href="/profile"
          className="sm:hidden text-xs font-medium text-text-muted hover:text-primary"
        >
          Profile
        </Link>
        <Link
          href="/new-session"
          className="text-xs font-semibold text-slate-900 bg-accent hover:bg-amber-500 px-3 py-1.5 rounded-md transition-colors shadow-2xs"
        >
          + New Session
        </Link>
        <Link
          href="/profile"
          className="hidden sm:inline-flex text-xs font-semibold text-text hover:text-primary border border-slate-300 px-3 py-1.5 rounded-md bg-surface hover:bg-slate-50 transition-colors shadow-2xs"
        >
          Profile
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-xs font-medium text-text-muted hover:text-status-weak border border-slate-300 px-3 py-1.5 rounded-md bg-surface hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
