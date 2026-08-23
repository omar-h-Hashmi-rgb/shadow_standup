import React from "react";
import { Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { StandupAnalysis } from "./prompts";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a2e" },
  header: { marginBottom: 20, paddingBottom: 12, borderBottom: "2px solid #6c5ce7" },
  title: { fontSize: 20, fontWeight: "bold", color: "#6c5ce7", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#636e72" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, marginTop: 8 },
  metaItem: { fontSize: 9, color: "#636e72" },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  metricBox: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: "#f8f9fa", border: "1px solid #e9ecef" },
  metricValue: { fontSize: 16, fontWeight: "bold", color: "#6c5ce7" },
  metricLabel: { fontSize: 8, color: "#636e72", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", color: "#2d3436", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #dfe6e9" },
  listItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
  bullet: { width: 12, color: "#6c5ce7" },
  itemText: { flex: 1, color: "#2d3436", lineHeight: 1.4 },
  riskItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
  riskBullet: { width: 12, color: "#d63031" },
  summaryText: { fontSize: 10, color: "#2d3436", lineHeight: 1.5 },
  footer: { marginTop: 20, paddingTop: 8, borderTop: "1px solid #dfe6e9", fontSize: 8, color: "#b2bec3", textAlign: "center" },
});

function BulletItem({ text, color = "#6c5ce7" }: { text: string; color?: string }) {
  return (
    <View style={styles.listItem}>
      <Text style={[styles.bullet, { color }]}>•</Text>
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

function RiskItem({ text }: { text: string }) {
  return (
    <View style={styles.riskItem}>
      <Text style={styles.riskBullet}>!</Text>
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function StandupPDFReport({ analysis }: { analysis: StandupAnalysis }) {
  const cr = analysis.code_review;
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Standup Report</Text>
        <Text style={styles.subtitle}>
          {analysis.developer} — {analysis.repository}/{analysis.branch}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>Date: {date}</Text>
          <Text style={styles.metaItem}>Branch: {analysis.branch}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{cr.code_health}</Text>
          <Text style={styles.metricLabel}>Code Health</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{cr.complexity_score}/10</Text>
          <Text style={styles.metricLabel}>Complexity</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{analysis.yesterday_progress.length}</Text>
          <Text style={styles.metricLabel}>Tasks Done</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{analysis.today_focus.length}</Text>
          <Text style={styles.metricLabel}>Planned</Text>
        </View>
      </View>

      <Section title="Summary">
        <Text style={styles.summaryText}>{analysis.summary}</Text>
      </Section>

      {analysis.yesterday_progress.length > 0 && (
        <Section title="Yesterday's Progress">
          {analysis.yesterday_progress.map((item, i) => (
            <BulletItem key={i} text={item} />
          ))}
        </Section>
      )}

      {analysis.today_focus.length > 0 && (
        <Section title="Today's Focus">
          {analysis.today_focus.map((item, i) => (
            <BulletItem key={i} text={item} />
          ))}
        </Section>
      )}

      {analysis.blockers_and_risks.length > 0 && (
        <Section title="Blockers & Risks">
          {analysis.blockers_and_risks.map((item, i) => (
            <RiskItem key={i} text={item} />
          ))}
        </Section>
      )}

      {cr.highlights.length > 0 && (
        <Section title="Code Review Highlights">
          {cr.highlights.map((item, i) => (
            <BulletItem key={i} text={item} color="#00b894" />
          ))}
        </Section>
      )}

      {cr.security_or_debt_flags.length > 0 && (
        <Section title="Security & Debt Flags">
          {cr.security_or_debt_flags.map((item, i) => (
            <RiskItem key={i} text={item} />
          ))}
        </Section>
      )}

      <Text style={styles.footer}>
        Generated by Shadow Standup — {date}
      </Text>
    </Page>
  );
}
