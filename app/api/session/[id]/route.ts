import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error: any) {
    console.error("Get Session API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while fetching session." },
      { status: 500 }
    );
  }
}
