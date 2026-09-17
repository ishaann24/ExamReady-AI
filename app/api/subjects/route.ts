import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch subjects belonging to the user with their exam_sessions and topics
    const { data: subjectsData, error: subjectsErr } = await supabase
      .from("subjects")
      .select(`
        id,
        name,
        created_at,
        exam_sessions (
          id,
          exam_date,
          available_study_time_minutes,
          created_at,
          topics (
            id,
            status
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (subjectsErr) {
      console.error("Error fetching subjects:", subjectsErr);
      return NextResponse.json(
        { error: subjectsErr.message || "Failed to fetch subjects" },
        { status: 500 }
      );
    }

    const today = new Date();

    const subjects = (subjectsData || []).map((subject: any) => {
      // Sort sessions by created_at descending
      const rawSessions = Array.isArray(subject.exam_sessions)
        ? subject.exam_sessions
        : [];

      const sortedSessions = [...rawSessions].sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const processedSessions = sortedSessions.map((session: any) => {
        const topics = Array.isArray(session.topics) ? session.topics : [];

        const topic_counts = {
          strong: 0,
          needs_revision: 0,
          weak: 0,
          not_assessed: 0,
          total: topics.length,
        };

        topics.forEach((t: any) => {
          if (t.status === "strong") topic_counts.strong++;
          else if (t.status === "needs_revision") topic_counts.needs_revision++;
          else if (t.status === "weak") topic_counts.weak++;
          else topic_counts.not_assessed++;
        });

        let days_remaining: number | null = null;
        if (session.exam_date) {
          const examDateObj = new Date(session.exam_date);
          const diffMs = examDateObj.getTime() - today.getTime();
          days_remaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }

        return {
          id: session.id,
          exam_date: session.exam_date || null,
          available_study_time_minutes: session.available_study_time_minutes || null,
          created_at: session.created_at,
          days_remaining,
          topic_counts,
        };
      });

      const latest_session = processedSessions.length > 0 ? processedSessions[0] : null;

      return {
        id: subject.id,
        name: subject.name,
        created_at: subject.created_at,
        sessions: processedSessions,
        latest_session,
      };
    });

    return NextResponse.json({ subjects });
  } catch (error: any) {
    console.error("GET /api/subjects error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
