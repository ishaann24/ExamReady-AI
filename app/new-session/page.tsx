"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  chunks?: { pageNumber: number; text: string }[];
  sessionId?: string;
}

interface Topic {
  name: string;
  description: string;
}

interface SubjectOption {
  id: string;
  name: string;
  latest_session?: {
    exam_date?: string | null;
    available_study_time_minutes?: number | null;
  } | null;
}

export default function NewSessionPage() {
  const [step, setStep] = useState<SessionStep>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);

  // Subject selection state
  const [existingSubjects, setExistingSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("new");
  const [subjectName, setSubjectName] = useState<string>("");

  // Exam details
  const [examDate, setExamDate] = useState<string>("");
  const [studyTimeMinutes, setStudyTimeMinutes] = useState<string>("");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pyqStatus, setPyqStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [pyqResult, setPyqResult] = useState<{ text: string; fileCount: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pyqInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  // Load user's existing subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/subjects");
        if (res.ok) {
          const data = await res.json();
          const list: SubjectOption[] = data.subjects || [];
          setExistingSubjects(list);
          if (list.length > 0) {
            setSelectedSubjectId(list[0].id);
            setSubjectName(list[0].name);
            if (list[0].latest_session?.exam_date) {
              setExamDate(list[0].latest_session.exam_date.slice(0, 10));
            }
            if (list[0].latest_session?.available_study_time_minutes) {
              setStudyTimeMinutes(list[0].latest_session.available_study_time_minutes.toString());
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch existing subjects:", err);
      }
    };

    fetchSubjects();
  }, []);

  const handleSubjectChange = (val: string) => {
    setSelectedSubjectId(val);
    if (val === "new") {
      setSubjectName("");
    } else {
      const found = existingSubjects.find((s) => s.id === val);
      if (found) {
        setSubjectName(found.name);
        if (found.latest_session?.exam_date) {
          setExamDate(found.latest_session.exam_date.slice(0, 10));
        }
        if (found.latest_session?.available_study_time_minutes) {
          setStudyTimeMinutes(found.latest_session.available_study_time_minutes.toString());
        }
      }
    }
  };

  const handleBeginAssessment = () => {
    if (extractResult?.text && topics.length > 0 && extractResult.sessionId) {
      sessionStorage.setItem(
        "examready_session_data",
        JSON.stringify({
          text: extractResult.text,
          topics,
          sessionId: extractResult.sessionId,
        })
      );
      router.push(`/dashboard/${extractResult.sessionId}`);
    }
  };

  const handleFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isDocx = file.name.endsWith(".docx") || file.type.includes("wordprocessingml");

    if (!isPdf && !isDocx) {
      setStep("error");
      setErrorMessage("Please upload a valid PDF or Word document (.docx).");
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
        throw new Error(errorData.error || "Failed to extract text from document.");
      }

      const data: { pages: number; text: string; chunks?: { pageNumber: number; text: string }[] } = await res.json();

      // If user is creating a new subject and hasn't typed a name yet, prefill from filename
      if (selectedSubjectId === "new" && !subjectName.trim()) {
        const defaultSubject = file.name.replace(/\.(pdf|docx)$/i, "").replace(/[-_]/g, " ");
        setSubjectName(defaultSubject);
      }

      setExtractResult({
        pages: data.pages,
        text: data.text,
        chunks: data.chunks,
        fileName: file.name,
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
      // 1. Verify user authentication
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirectTo=/new-session");
        return;
      }

      // 2. Create DB exam session via POST /api/session/create
      const createRes = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selectedSubjectId !== "new" ? selectedSubjectId : undefined,
          subjectName: selectedSubjectId === "new" ? (subjectName || extractResult.fileName) : undefined,
          examDate: examDate || null,
          studyTimeMinutes: studyTimeMinutes ? parseInt(studyTimeMinutes, 10) : null,
          extractedText: extractResult.text,
          chunks: extractResult.chunks,
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to initialize exam session.");
      }

      const { sessionId } = await createRes.json();

      setExtractResult((prev) => (prev ? { ...prev, sessionId } : null));

      // 3. Extract topics from material
      const res = await fetch("/api/extract-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractResult.text,
          sessionId,
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
      setErrorMessage(err.message || "An error occurred while setting up session topics.");
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
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const onPYQFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !extractResult?.sessionId) return;

    setPyqStatus("uploading");
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append("files", e.target.files[i]);
    }
    formData.append("sessionId", extractResult.sessionId);

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
      {/* Main Content */}
      <div className="my-auto py-12 max-w-xl mx-auto w-full">
        {step === "idle" && (
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
              New Exam Session
            </h1>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Select or create a subject, set your target exam date, and upload course materials.
            </p>

            {/* Step 1 & 2: Subject & Exam Configuration */}
            <div className="bg-surface p-6 rounded-md border border-slate-200 space-y-4 mb-8 shadow-xs">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Subject / Course
                </label>
                {existingSubjects.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text font-medium"
                    >
                      {existingSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="new">+ Create New Subject...</option>
                    </select>

                    {selectedSubjectId === "new" && (
                      <input
                        type="text"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Enter new subject name (e.g. Organic Chemistry)"
                        className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. Organic Chemistry, Computer Networks"
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                    Exam Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                    Daily Study Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    value={studyTimeMinutes}
                    onChange={(e) => setStudyTimeMinutes(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Material PDF Upload Dropzone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-md p-10 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center shadow-xs ${
                isDragging
                  ? "border-primary bg-blue-50/60 scale-[1.01]"
                  : "border-slate-300 hover:border-primary/60 bg-surface hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                Drop course material PDF or Word document here, or click to browse
              </p>
              <p className="text-xs text-text-muted">
                PDF or Word documents (.docx) up to 50MB
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
              Confirm Session Details
            </h1>
            <p className="text-text-muted text-base mb-8 leading-relaxed font-normal">
              Review your subject and exam schedule before extracting topics.
            </p>

            <div className="border border-slate-200 rounded-md p-6 bg-surface shadow-xs mb-6">
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

            <div className="bg-surface p-6 rounded-md border border-slate-200 space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Subject / Course Name
                </label>
                {existingSubjects.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text font-medium"
                    >
                      {existingSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="new">+ Create New Subject...</option>
                    </select>

                    {selectedSubjectId === "new" && (
                      <input
                        type="text"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="e.g. Organic Chemistry, Computer Networks"
                        className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. Organic Chemistry, Computer Networks"
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                    Exam Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                    Daily Study Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    value={studyTimeMinutes}
                    onChange={(e) => setStudyTimeMinutes(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={handleExtractTopics}
                className="bg-accent hover:bg-amber-500 text-slate-950 font-semibold px-6 py-3.5 rounded-md transition-all duration-150 text-base cursor-pointer shadow-sm w-full sm:w-auto"
              >
                Extract Topics &amp; Initialize
              </button>
            </div>
          </div>
        )}

        {step === "extracting-topics" && (
          <div className="py-16 text-center">
            <p className="text-xl font-medium text-primary tracking-tight animate-pulse">
              Initializing session &amp; analyzing key topics...
            </p>
            <p className="text-xs text-text-muted mt-3">
              Parsing concepts for structured active recall
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
              Key topics identified for <span className="font-semibold text-text">{subjectName}</span>.
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
            <div className="mt-6 mb-8 border border-slate-200 rounded-md p-5 bg-surface">
              <p className="text-sm font-semibold text-text mb-1">
                Upload previous-year exam papers (optional)
              </p>
              <p className="text-xs text-text-muted mb-4">
                Helps identify high-yield topics and frequency of past questions.
              </p>

              <input
                ref={pyqInputRef}
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={onPYQFileSelect}
                className="hidden"
                id="pyq-upload"
              />
              <label
                htmlFor="pyq-upload"
                className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors block ${
                  pyqStatus === "uploading"
                    ? "border-primary bg-blue-50/60"
                    : "border-slate-300 hover:border-primary/60 bg-surface-muted hover:bg-slate-100"
                }`}
              >
                <span className="text-sm font-medium text-text">
                  {pyqStatus === "uploading" ? "Uploading..." : "Select PYQ PDF or Word documents"}
                </span>
                {pyqResult && (
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    ✓ {pyqResult.fileCount} paper{pyqResult.fileCount > 1 ? "s" : ""} uploaded and linked
                  </p>
                )}
              </label>
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
                Start new session
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
