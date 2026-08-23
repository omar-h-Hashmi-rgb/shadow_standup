import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";
import type { StandupAnalysis } from "./prompts";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#7c6af7",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f1118",
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#7a8099",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    backgroundColor: "#f8f9fb",
    padding: 14,
    borderRadius: 8,
  },
  metaItem: {
    flexDirection: "column",
  },
  metaLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    color: "#374151",
    fontWeight: "bold",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0f1118",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
  },
  text: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 1.6,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 10,
    fontSize: 11,
    color: "#7c6af7",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f1118",
  },
  metricLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginTop: 2,
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  healthHigh: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  healthMedium: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  healthLow: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
});

const healthColor: Record<string, string> = {
  High: "healthHigh",
  Medium: "healthMedium",
  Low: "healthLow",
};

interface StandupPDFProps {
  analysis: StandupAnalysis;
}

export const StandupPDFReport = ({ analysis }: StandupPDFProps) => {
  const cr = analysis.code_review;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shadow Standup Report</Text>
          <Text style={styles.headerSubtitle}>AI-Generated Engineering Summary</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Developer</Text>
            <Text style={styles.metaValue}>{analysis.developer}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Repository</Text>
            <Text style={styles.metaValue}>{analysis.repository}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Branch</Text>
            <Text style={styles.metaValue}>{analysis.branch}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{cr.complexity_score}/10</Text>
            <Text style={styles.metricLabel}>Complexity</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.healthBadge, styles[healthColor[cr.code_health] || "healthMedium"]]}>
              {cr.code_health}
            </Text>
            <Text style={styles.metricLabel}>Health</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{analysis.yesterday_progress.length}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{analysis.blockers_and_risks.length}</Text>
            <Text style={styles.metricLabel}>Risks</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.text}>{analysis.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yesterday's Progress</Text>
          {analysis.yesterday_progress.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Focus</Text>
          {analysis.today_focus.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {analysis.blockers_and_risks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blockers & Risks</Text>
            {analysis.blockers_and_risks.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: "#ef4444" }]}>!</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {cr.highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Code Review Highlights</Text>
            {cr.highlights.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {cr.security_or_debt_flags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security & Debt Flags</Text>
            {cr.security_or_debt_flags.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: "#f59e0b" }]}>⚠</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Shadow Standup AI</Text>
          <Text style={styles.footerText}>{new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
};
