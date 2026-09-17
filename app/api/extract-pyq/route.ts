import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { createClient } from "@/lib/supabase/server";
import { savePyqText } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/extract-pyq
 * Accepts multiple PDF files (field name "files") and a required "sessionId".
 * Extracts text from each PDF, concatenates them, and saves the combined text as
 * `pyqText` on the corresponding session record using savePyqText.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files");
    const sessionId = formData.get("sessionId") as string | null;

    if (!files.length) {
      return NextResponse.json(
        { error: "No PDF files provided under 'files' field" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required 'sessionId' field" },
        { status: 400 }
      );
    }

    // Validate all files are PDFs
    for (const f of files) {
      if (
        !(f instanceof Blob) ||
        (f instanceof File &&
          f.type !== "application/pdf" &&
          !f.name.endsWith(".pdf"))
      ) {
        return NextResponse.json(
          { error: "All uploaded files must be PDF documents" },
          { status: 400 }
        );
      }
    }

    let combinedText = "";
    for (const f of files) {
      const arrayBuffer = await (f as Blob).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(buffer);
      combinedText += pdfData.text + "\n";
    }

    const trimmedPyqText = combinedText.trim();
    await savePyqText(sessionId, trimmedPyqText);

    return NextResponse.json({ text: trimmedPyqText, fileCount: files.length });
  } catch (error: any) {
    console.error("PYQ extraction error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to extract text from PDF files" },
      { status: 500 }
    );
  }
}
