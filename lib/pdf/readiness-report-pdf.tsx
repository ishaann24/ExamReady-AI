import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
    color: '#000',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  list: {
    marginLeft: 10,
    marginBottom: 10,
  },
  listItem: {
    marginBottom: 4,
  },
});

/**
 * Props for the readiness report PDF.
 */
export interface ReadinessReportPDFProps {
  subjectName?: string;
  examDate?: string;
  improvedTopics: string[];
  remainingWeakTopics: string[];
  diagnosticCorrect: number;
  diagnosticTotal: number;
  followupCorrect: number;
  followupTotal: number;
}

/**
 * ReadinessReportPDF renders a printable PDF version of the readiness report.
 * It uses only dark text on a white background for maximum print compatibility.
 */
export const ReadinessReportPDF: React.FC<ReadinessReportPDFProps> = ({
  subjectName = 'Subject',
  examDate = 'Exam Date',
  improvedTopics,
  remainingWeakTopics,
  diagnosticCorrect,
  diagnosticTotal,
  followupCorrect,
  followupTotal,
}) => (
  <Document>
    <Page style={styles.page} wrap>
      <View style={styles.header}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Readiness Report</Text>
        <Text>{subjectName}</Text>
        <Text>{examDate}</Text>
      </View>

      {/* What Improved Section */}
      <View>
        <Text style={styles.sectionTitle}>What Improved</Text>
        {improvedTopics.length > 0 ? (
          <View style={styles.list}>
            {improvedTopics.map((t, i) => (
              <Text key={i} style={styles.listItem}>• {t}</Text>
            ))}
          </View>
        ) : (
          <Text>No topics improved this session.</Text>
        )}
      </View>

      {/* Remaining Weak Topics */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Remaining Weak / Needs Revision Topics</Text>
        {remainingWeakTopics.length > 0 ? (
          <View style={styles.list}>
            {remainingWeakTopics.map((t, i) => (
              <Text key={i} style={styles.listItem}>• {t}</Text>
            ))}
          </View>
        ) : (
          <Text>All topics are strong!</Text>
        )}
      </View>

      {/* Overall Stats */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Overall Stats</Text>
        <Text>Diagnostic – Correct: {diagnosticCorrect} / {diagnosticTotal}</Text>
        <Text>Follow‑up – Correct: {followupCorrect} / {followupTotal}</Text>
      </View>
    </Page>
  </Document>
);

