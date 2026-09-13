import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { saveSession } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No PDF file provided under 'file' field" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfData = await pdfParse(buffer);
    const fileName = (file as File).name || "document.pdf";
    const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    saveSession(sessionId, {
      id: sessionId,
      fileName,
      pages: pdfData.numpages,
      extractedText: pdfData.text,
      topics: [],
      questions: [],
      knowledgeGaps: {},
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      sessionId,
      pages: pdfData.numpages,
      text: pdfData.text,
    });
  } catch (error: any) {
    console.error("PDF Extraction error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to extract text from PDF file" },
      { status: 500 }
    );
  }
}
