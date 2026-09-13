"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";


type SessionStep =
  | "idle"
  | "uploading"
  | "pdf-ready"
  | "extracting-topics"
  | "topics-ready"
  | "error";

interface ExtractResult {
  pages: number;
  fileName: string;
  text: string;
  sessionId?: string;
}

interface Topic {
  name: string;
  description: string;
}

export default function NewSessionPage() {
  const [step, setStep] = useState<SessionStep>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pyqStatus, setPyqStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [pyqResult, setPyqResult] = useState<{text:string; fileCount:number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pyqInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const handleBeginAssessment = () => {
    if (extractResult?.text && topics.length > 0) {
      sessionStorage.setItem(
        "examready_session_data",
        JSON.stringify({
          text: extractResult.text,
          topics,
          sessionId: extractResult.sessionId,
        })
      );
      router.push("/assessment");
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setStep("error");
      setErrorMessage("Please upload a valid PDF document.");
      return;
    }

    setStep("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract text from PDF.");
      }

      const data: { pages: number; text: string; sessionId?: string } = await res.json();
      setExtractResult({
        pages: data.pages,
        text: data.text,
        fileName: file.name,
        sessionId: data.sessionId,
      });
      setStep("pdf-ready");
    } catch (err: any) {
      console.error(err);
      setStep("error");
      setErrorMessage(err.message || "An error occurred while reading your file.");
    }
  };

  const handleExtractTopics = async () => {
    if (!extractResult?.text) return;

    setStep("extracting-topics");
    setErrorMessage("");

    try {
      const res = await fetch("/api/extract-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractResult.text,
          sessionId: extractResult.sessionId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract topics from material.");
      }

      const data: { topics: Topic[] } = await res.json();
      setTopics(data.topics || []);
      setStep("topics-ready");
    } catch (err: any) {
      console.error(err);
      setStep("error");
      setErrorMessage(err.message || "An error occurred while extracting topics.");
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const onPYQFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setPyqStatus("uploading");
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append("files", e.target.files[i]);
    }
    if (extractResult?.sessionId) {
      formData.append("sessionId", extractResult.sessionId);
    }
    try {
      const res = await fetch("/api/extract-pyq", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract PYQ PDFs.");
      }
      const data: { text: string; fileCount: number } = await res.json();
      setPyqResult(data);
      setPyqStatus("uploaded");
      if (extractResult?.sessionId) {
        saveSession(extractResult.sessionId, { pyqText: data.text });
      }
    } catch (err: any) {
      console.error(err);
      setPyqStatus("idle");
      setErrorMessage(err.message || "An error occurred while uploading previous-year papers.");
    }
  };

  const resetUpload = () => {
    setStep("idle");
    setExtractResult(null);
    setTopics([]);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted text-text flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <Link href="/" className="font-bold text-sm tracking-wider uppercase text-primary hover:opacity-80 transition-opacity">
          ExamReady AI
        </Link>
        <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface shadow-xs">
          New Session
        </span>
      </header>

      {/* Main Content */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full">
        {step === "idle" && (
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              Upload material
            </h1>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Select or drop your PDF course material to begin.
            </p>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-md p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center shadow-xs ${
                isDragging
                  ? "border-primary bg-blue-50/60 scale-[1.01]"
                  : "border-slate-300 hover:border-primary/60 bg-surface hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileSelect}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full border border-slate-200 bg-surface-muted flex items-center justify-center mb-4 text-primary">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <p className="text-text font-semibold text-base mb-1">
                Drop your PDF file here, or click to browse
              </p>
              <p className="text-xs text-text-muted">
                PDF documents up to 50MB
              </p>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="py-16 text-center">
            <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
              Reading your material...
            </p>
            <p className="text-xs text-text-muted mt-3">
              Parsing pages and preparing content
            </p>
          </div>
        )}

        {step === "pdf-ready" && extractResult && (
          <div className="py-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              Material ready
            </h1>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Your document has been processed and is ready for topic analysis.
            </p>

            <div className="border border-slate-200 rounded-md p-6 bg-surface shadow-xs mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-status-strong"></div>
                  <div>
                    <p className="text-sm font-semibold text-text truncate max-w-xs sm:max-w-md">
                      {extractResult.fileName}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {extractResult.pages} {extractResult.pages === 1 ? "page" : "pages"} processed
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-xs text-text-muted hover:text-text underline underline-offset-4 cursor-pointer transition-colors"
                >
                  Change file
                </button>
              </div>
            </div>

            <div>
              <button
                onClick={handleExtractTopics}
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm w-full sm:w-auto"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "extracting-topics" && (
          <div className="py-16 text-center">
            <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
              Identifying key topics from your material...
            </p>
            <p className="text-xs text-text-muted mt-3">
              Analyzing concepts for structured active recall
            </p>
          </div>
        )}

        {step === "topics-ready" && (
          <div className="py-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
                Course Topics
              </h1>
              <span className="text-xs text-text-muted border border-slate-300 px-2.5 py-1 rounded-md bg-surface">
                {topics.length} {topics.length === 1 ? "Topic" : "Topics"}
              </span>
            </div>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Key topics identified in your material. Review before proceeding to your preparation session.
            </p>

            <div className="border border-slate-200 rounded-md divide-y divide-slate-200 bg-surface shadow-xs mb-8">
              {topics.map((topic, idx) => (
                <div key={idx} className="p-5 flex items-start gap-4">
                  <span className="text-xs text-text-muted font-mono mt-0.5 min-w-[1.5rem] font-semibold">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-text mb-1">
                      {topic.name}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Optional Previous-Year Papers Upload */}
            <div className="mt-6">
              <p className="text-text font-semibold mb-2">Upload previous-year papers (optional)</p>
              <input
                ref={pyqInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={onPYQFileSelect}
                className="hidden"
                id="pyq-upload"
              />
              <label
                htmlFor="pyq-upload"
                className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  pyqStatus === "uploading"
                    ? "border-primary bg-blue-50/60"
                    : "border-slate-300 hover:border-primary/60 bg-surface hover:bg-slate-50"
                }`}
              >
                <span className="text-text">Select PDF files</span>
                {pyqResult && (
                  <p className="text-xs text-text-muted mt-1">
                    {pyqResult.fileCount} file{pyqResult.fileCount > 1 ? "s" : ""} uploaded
                  </p>
                )}
              </label>
              {pyqStatus === "uploading" && (
                <p className="text-xs text-primary mt-1 animate-pulse">Uploading...</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm w-full sm:w-auto"
                onClick={handleBeginAssessment}
              >
                Begin Assessment
              </button>
              <button
                onClick={resetUpload}
                className="text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                Upload different material
              </button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="py-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              An error occurred
            </h1>
            <p className="text-status-weak text-base mb-6 leading-relaxed font-normal">
              {errorMessage}
            </p>
            <div>
              <button
                onClick={resetUpload}
                className="border border-slate-300 hover:border-slate-400 text-text font-medium px-6 py-3 rounded-md transition-colors duration-150 text-sm cursor-pointer bg-surface"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 flex items-center justify-between text-xs text-text-muted">
        <span>Precision study tools for high-stakes preparation.</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-strong"></span>
          System Operational
        </span>
      </footer>
    </main>
  );
}
