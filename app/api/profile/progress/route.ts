import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user's subjects
    const { data: subjects, error: subjectsErr } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", user.id);

    if (subjectsErr || !subjects || subjects.length === 0) {
      return NextResponse.json({ progress: [] });
    }

    const subjectIds = subjects.map((s) => s.id);

    // 2. Fetch exam sessions for user's subjects
    const { data: sessions, error: sessionsErr } = await supabase
      .from("exam_sessions")
      .select("id")
      .in("subject_id", subjectIds);

    if (sessionsErr || !sessions || sessions.length === 0) {
      return NextResponse.json({ progress: [] });
    }

    const sessionIds = sessions.map((s) => s.id);

    // 3. Fetch all strong topics for user's sessions
    const { data: strongTopics, error: topicsErr } = await supabase
      .from("topics")
      .select("id, updated_at, created_at")
      .in("exam_session_id", sessionIds)
      .eq("status", "strong");

    if (topicsErr || !strongTopics || strongTopics.length === 0) {
      return NextResponse.json({ progress: [] });
    }

    // 4. Group counts per date (YYYY-MM-DD)
    const countsByDate: Record<string, number> = {};

    for (const t of strongTopics) {
      const rawTimestamp = t.updated_at || t.created_at || new Date().toISOString();
      const dateStr = new Date(rawTimestamp).toISOString().slice(0, 10);
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }

    // 5. Sort dates chronologically and compute running cumulative total
    const sortedDates = Object.keys(countsByDate).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    let cumulativeTotal = 0;
    const progress = sortedDates.map((date) => {
      cumulativeTotal += countsByDate[date];
      return {
        date,
        cumulativeTopicsMastered: cumulativeTotal,
      };
    });

    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error("GET /api/profile/progress error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch progress time-series" },
      { status: 500 }
    );
  }
}
