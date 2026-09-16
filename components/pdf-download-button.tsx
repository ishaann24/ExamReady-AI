"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { ReadinessReportPDF } from "@/lib/pdf/readiness-report-pdf";

interface PDFDownloadButtonProps {
  sessionId: string;
  improvedTopics: string[];
  remainingWeakTopics: string[];
  diagnosticCorrect: number;
  diagnosticTotal: number;
  followupCorrect: number;
  followupTotal: number;
}

export default function PDFDownloadButton({
  sessionId,
  improvedTopics,
  remainingWeakTopics,
  diagnosticCorrect,
  diagnosticTotal,
  followupCorrect,
  followupTotal,
}: PDFDownloadButtonProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <span className="inline-flex items-center px-4 py-2 bg-primary/70 text-white font-medium text-sm rounded-md cursor-wait">
        Preparing PDF...
      </span>
    );
  }

  return (
    <PDFDownloadLink
      document={
        <ReadinessReportPDF
          improvedTopics={improvedTopics}
          remainingWeakTopics={remainingWeakTopics}
          diagnosticCorrect={diagnosticCorrect}
          diagnosticTotal={diagnosticTotal}
          followupCorrect={followupCorrect}
          followupTotal={followupTotal}
        />
      }
      fileName={`examready-report-${sessionId}.pdf`}
      className="inline-flex items-center px-4 py-2 bg-primary text-white font-medium text-sm rounded-md hover:opacity-90 transition-opacity"
    >
      {({ loading }) => (loading ? "Generating PDF..." : "Download as PDF")}
    </PDFDownloadLink>
  );
}
