import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      console.warn("GET /api/profile unauthorized:", authErr?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user profile safely
    let fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
    const email = user.email || "";
    let createdAt = user.created_at;

    try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error("Error fetching profiles table row:", profileErr.message);
      } else if (profile) {
        if (profile.full_name) fullName = profile.full_name;
        if (profile.created_at) createdAt = profile.created_at;
      }
    } catch (err) {
      console.error("Profiles table fetch exception:", err);
    }

    // 2. Compute aggregate stats safely
    let totalSubjects = 0;
    let totalSessions = 0;
    let totalStrongTopics = 0;
    let totalImprovedTopics = 0;

    try {
      const { data: userSubjects, error: subjectsErr } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", user.id);

      if (subjectsErr) {
        console.error("Error querying subjects:", subjectsErr.message);
      } else if (userSubjects) {
        totalSubjects = userSubjects.length;
        const subjectIds = userSubjects.map((s) => s.id);

        if (subjectIds.length > 0) {
          const { data: sessions, error: sessionsErr } = await supabase
            .from("exam_sessions")
            .select("id")
            .in("subject_id", subjectIds);

          if (sessionsErr) {
            console.error("Error querying exam_sessions:", sessionsErr.message);
          } else if (sessions) {
            totalSessions = sessions.length;
            const sessionIds = sessions.map((s) => s.id);

            if (sessionIds.length > 0) {
              const { data: strongTopicRows, error: topicsErr } = await supabase
                .from("topics")
                .select("id, created_at, updated_at")
                .in("exam_session_id", sessionIds)
                .eq("status", "strong");

              if (topicsErr) {
                console.error("Error querying topics:", topicsErr.message);
              } else if (strongTopicRows) {
                totalStrongTopics = strongTopicRows.length;
                totalImprovedTopics = strongTopicRows.filter((t) => {
                  if (!t.updated_at || !t.created_at) return false;
                  return new Date(t.updated_at).getTime() - new Date(t.created_at).getTime() > 1000;
                }).length;
              }
            }
          }
        }
      }
    } catch (statsErr) {
      console.error("Exception computing aggregate stats:", statsErr);
    }

    return NextResponse.json({
      profile: {
        fullName,
        email,
        createdAt,
      },
      stats: {
        totalSubjects,
        totalSessions,
        totalStrongTopics,
        totalImprovedTopics,
      },
    });
  } catch (error: any) {
    console.error("GET /api/profile unhandled error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName } = body;

    if (typeof fullName !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing 'fullName' parameter." },
        { status: 400 }
      );
    }

    const trimmedName = fullName.trim();

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: trimmedName,
      })
      .select("full_name")
      .single();

    if (error) {
      console.error("PATCH /api/profile error:", error.message);
      return NextResponse.json(
        { error: error.message || "Failed to update profile name" },
        { status: 500 }
      );
    }

    return NextResponse.json({ fullName: data.full_name });
  } catch (error: any) {
    console.error("PATCH /api/profile unhandled error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
