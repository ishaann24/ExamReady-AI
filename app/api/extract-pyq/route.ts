import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { getSession, saveSession } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/extract-pyq
 * Accepts multiple PDF files (field name "files") and an optional "sessionId".
 * Extracts text from each PDF, concatenates them, and saves the combined text as
 * `pyqText` on the corresponding session record.
 * Returns the concatenated text and the number of processed files.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files");
    const sessionId = formData.get("sessionId") as string | null;

    if (!files.length) {
      return NextResponse.json({ error: "No PDF files provided under 'files' field" }, { status: 400 });
    }

    // Validate all files are PDFs
    for (const f of files) {
      if (!(f instanceof Blob) || (f instanceof File && f.type !== "application/pdf" && !f.name.endsWith(".pdf"))) {
        return NextResponse.json({ error: "All uploaded files must be PDF documents" }, { status: 400 });
      }
    }

    let combinedText = "";
    for (const f of files) {
      const arrayBuffer = await (f as Blob).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(buffer);
      combinedText += pdfData.text + "\n"; // Separate with line break
    }

    // If a sessionId is provided, attach the extracted text to that session.
    if (sessionId) {
      const existing = getSession(sessionId);
      if (!existing) {
        return NextResponse.json({ error: `Session ${sessionId} not found` }, { status: 404 });
      }
      saveSession(sessionId, { pyqText: combinedText.trim() });
    }

    return NextResponse.json({ text: combinedText.trim(), fileCount: files.length });
  } catch (error: any) {
    console.error("PYQ extraction error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to extract text from PDF files" },
      { status: 500 }
    );
  }
}
