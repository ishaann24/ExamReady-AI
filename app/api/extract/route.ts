import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

    return NextResponse.json({
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
