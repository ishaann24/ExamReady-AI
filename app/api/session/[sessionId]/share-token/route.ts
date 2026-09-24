import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, regenerateShareToken } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${sessionId}' not found or access forbidden.` },
        { status: 404 }
      );
    }

    const shareToken = await regenerateShareToken(sessionId);

    return NextResponse.json({ shareToken });
  } catch (error: any) {
    console.error("Regenerate share token API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to regenerate share link." },
      { status: 500 }
    );
  }
}
