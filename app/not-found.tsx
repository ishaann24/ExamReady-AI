"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NotFoundPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setIsLoggedIn(true);
        }
      } catch (err) {
        // Fallback to false if auth check fails
      }
    };
    checkAuth();
  }, []);

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <Link href="/" className="font-bold text-sm tracking-wider uppercase text-primary">
          ExamReady AI
        </Link>
        <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface font-mono">
          404 Not Found
        </span>
      </header>

      {/* Main Content */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full text-center">
        <span className="text-xs font-bold uppercase tracking-wider font-mono text-text-muted bg-slate-200/70 px-3 py-1 rounded-xs inline-block mb-4">
          Error 404
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
          Page Not Found
        </h1>

        <p className="text-text-muted text-base mb-8 leading-relaxed font-normal max-w-md mx-auto">
          The page you are looking for doesn't exist, has been moved, or the link may be invalid.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={isLoggedIn ? "/subjects" : "/"}
            className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3 rounded-md transition-all duration-150 text-sm shadow-xs w-full sm:w-auto"
          >
            {isLoggedIn ? "Go to Subjects" : "Return to Home"}
          </Link>
          {isLoggedIn && (
            <Link
              href="/profile"
              className="border border-slate-300 hover:border-slate-400 text-text font-medium px-6 py-3 rounded-md transition-colors duration-150 text-sm bg-surface w-full sm:w-auto"
            >
              View Profile
            </Link>
          )}
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
