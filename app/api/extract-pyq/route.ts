import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { savePyqText } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/extract-pyq
 * Accepts multiple PDF or DOCX files (field name "files") and a required "sessionId".
 * Extracts text from each file, concatenates them, and saves the combined text as
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
        { error: "No files provided under 'files' field" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required 'sessionId' field" },
        { status: 400 }
      );
    }

    // Validate all files are PDFs or DOCX
    for (const f of files) {
      if (!(f instanceof Blob)) {
        return NextResponse.json(
          { error: "All uploaded files must be PDF or Word documents" },
          { status: 400 }
        );
      }
      if (f instanceof File) {
        const name = f.name.toLowerCase();
        const type = f.type || "";
        const isValid =
          type === "application/pdf" ||
          name.endsWith(".pdf") ||
          name.endsWith(".docx") ||
          type.includes("wordprocessingml") ||
          type.includes("docx");

        if (!isValid) {
          return NextResponse.json(
            { error: `File '${f.name}' must be a PDF or Word document (.docx)` },
            { status: 400 }
          );
        }
      }
    }

    let combinedText = "";
    for (const f of files) {
      const blob = f as Blob;
      const name = f instanceof File ? f.name.toLowerCase() : "";
      const type = blob.type || "";
      const isDocx =
        name.endsWith(".docx") ||
        type.includes("wordprocessingml") ||
        type.includes("docx");

      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (isDocx) {
        const result = await mammoth.extractRawText({ buffer });
        combinedText += (result.value || "") + "\n";
      } else {
        const pdfData = await pdfParse(buffer);
        combinedText += (pdfData.text || "") + "\n";
      }
    }

    const trimmedPyqText = combinedText.trim();
    await savePyqText(sessionId, trimmedPyqText);

    return NextResponse.json({ text: trimmedPyqText, fileCount: files.length });
  } catch (error: any) {
    console.error("PYQ extraction error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to extract text from PYQ files" },
      { status: 500 }
    );
  }
}
