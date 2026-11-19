"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ChevronRight, History as HistoryIcon, Loader2, Trash2, X } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { StandupPDF } from "@/components/StandupPDF";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";
import Auth from "@/components/Auth";

/**
 * Renders a structured `standups` row as the plain-text document the History
 * page already knows how to display (`parseSections` splits on blank lines and
 * treats the first line of each block as the section title).
 */
function buildStandupContent(row: any): string {
  const cr = row?.code_review ?? {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean) : []);
  const section = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((i) => `- ${i}`).join("\n")}` : "";

  const blocks = [
    section("Summary", row?.summary ? [String(row.summary)] : []),
    section("Yesterday's Progress", list(row?.yesterday_progress).map(String)),
    section("Today's Focus", list(row?.today_focus).map(String)),
    section("Blockers & Risks", list(row?.blockers_and_risks).map(String)),
    section("Code Review Highlights", list(cr.highlights).map(String)),
    section(
      "Code Risks",
      [
        ...list(cr.risks).map(String),
        ...list(cr.security_or_debt_flags).map(String),
      ]
    ),
    section("Code Review", [
      `Complexity: ${row?.complexity_score ?? "-"}/10`,
      `Health: ${row?.code_health ?? "Medium"}`,
    ]),
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export default function HistoryPage() {
  const [session, setSession] = useState<any>(null);
  const [standups, setStandups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStandup, setSelectedStandup] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; source: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    setLoading(true);
    const userId = session.user.id;

    // Two sources: the legacy `history` table (older reports) and `standups`
    // (everything generated since). Previously only `history` was read, so new
    // standups never appeared here at all.
    const [legacy, structured] = await Promise.all([
      supabase.from("history").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("standups").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    const rows: any[] = [];

    for (const r of legacy.data ?? []) {
      rows.push({
        id: r.id,
        source: "history" as const,
        owner: r.owner,
        repo: r.repo,
        created_at: r.created_at,
        content: r.content ?? "",
        commits_count: r.commits_count ?? 0,
        sent: Boolean(r.commits_count),
        metaLabel: `${r.commits_count || 0} commits`,
      });
    }

    for (const r of structured.data ?? []) {
      const delivered = Array.isArray(r.platforms_delivered) ? r.platforms_delivered : [];
      const cr = r.code_review ?? {};
      const findings =
        (Array.isArray(cr.risks) ? cr.risks.length : 0) +
        (Array.isArray(cr.security_or_debt_flags) ? cr.security_or_debt_flags.length : 0);
      rows.push({
        id: r.id,
        source: "standup" as const,
        owner: r.owner,
        repo: r.repo,
        created_at: r.created_at,
        content: buildStandupContent(r),
        commits_count: null,
        sent: delivered.length > 0,
        metaLabel: findings > 0 ? `${findings} finding${findings === 1 ? "" : "s"}` : "AI standup",
      });
    }

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setStandups(rows);
    setLoading(false);
  };

  const deleteStandup = async (target: { id: string; source: string }) => {
    // Rows are merged from two tables — delete from the one it came from.
    const table = target.source === "standup" ? "standups" : "history";
    const { error } = await supabase.from(table).delete().eq("id", target.id);

    if (error) {
      toast.error("Failed to delete report");
    } else {
      setStandups((prev) => prev.filter((s) => s.id !== target.id));
      if (selectedStandup?.id === target.id) setSelectedStandup(null);
      toast.success("Report deleted successfully");
    }
  };

  const openDeleteConfirm = (id: string, source: string) => {
    setItemToDelete({ id, source });
    setDeleteConfirmOpen(true);
  };

  const sentCount = standups.filter((s) => s.sent).length;
  const draftCount = standups.length - sentCount;

  const parseSections = (content: string) => {
    const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const title = lines[0] || "Section";
      const items = lines.slice(1).map((line) => line.replace(/^[-\s]+/, "")).filter(Boolean);
      return { title, items: items.length ? items : [block.replace(title, "").trim()].filter(Boolean) };
    });
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="panel-label">
          <Loader2 size={16} className="icon-spin" />
          Syncing history...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="signin-page">
        <div className="signin-copy">
          <h1 className="signin-title">Sign in to view History</h1>
          <p className="signin-desc">
            Your past stand-up summaries and exported reports are tied to your authenticated account.
          </p>
        </div>
        <Auth />
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="history-title">Stand-up History</h1>
          <p className="history-subtitle">All past summaries — click any row to expand</p>
        </div>
        <div className="history-summary-chips">
          <div className="summary-chip">
            <span>{sentCount}</span>
            <span>sent</span>
          </div>
          <div className="summary-chip draft">
            <span>{draftCount}</span>
            <span>draft</span>
          </div>
        </div>
      </div>

      {standups.length > 0 ? (
        <div className="history-list">
          {standups.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className={`history-item ${isExpanded ? "expanded" : ""}`}>
                <button className="history-row" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <div className="history-row-left">
                    <div className="history-date-block">
                      <span className="history-date">{new Date(item.created_at).toLocaleDateString()}</span>
                      <span className="history-ago">{new Date(item.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="history-repo">{item.owner}/{item.repo}</div>
                  </div>
                  <div className="history-row-meta">
                    <span className="meta-commits">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" />
                      </svg>
                      {item.metaLabel}
                    </span>
                    <span className={`status-badge ${item.sent ? "sent" : "draft"}`}>
                      {item.sent ? "Sent" : "Draft"}
                    </span>
                    <ChevronRight className="expand-icon" size={14} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="history-detail">
                    <pre className="history-summary-text">{item.content}</pre>
                    <div className="history-detail-actions">
                      <button className="btn-edit" onClick={() => setSelectedStandup(item)}>
                        View Report
                      </button>
                      <button className="btn-edit" onClick={() => openDeleteConfirm(item.id, item.source)}>
                        <Trash2 size={14} /> Delete
                      </button>
                      {isClient && (
                        <PDFDownloadLink
                          document={
                            <StandupPDF
                              owner={item.owner}
                              repo={item.repo}
                              date={item.created_at}
                              commits={item.commits_count || 0}
                              content={item.content}
                            />
                          }
                          fileName={`standup-${item.repo}-${new Date(item.created_at).toISOString().split("T")[0]}.pdf`}
                        >
                          {({ loading: pdfLoading }) => (
                            <button className="btn-edit" disabled={pdfLoading}>
                              {pdfLoading ? "Preparing PDF..." : "Download PDF"}
                            </button>
                          )}
                        </PDFDownloadLink>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <HistoryIcon size={32} />
          <p>No stand-ups yet. Generate your first one to start tracking history.</p>
          <Link href="/standup" className="btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
            Create Standup
          </Link>
        </div>
      )}

      {selectedStandup && (
        <div className="report-modal">
          <div className="report-backdrop" onClick={() => setSelectedStandup(null)} />
          <div className="report-card">
            <div className="report-header">
              <div>
                <h2 className="report-title">
                  {selectedStandup.owner}/{selectedStandup.repo}
                </h2>
                <p className="report-subtitle">
                  Generated on {new Date(selectedStandup.created_at).toLocaleString()}
                </p>
              </div>
              <button className="report-close" onClick={() => setSelectedStandup(null)} aria-label="Close report">
                <X size={18} className="report-close-icon" />
              </button>
            </div>

            <div className="report-body">
              <div className="report-content">
                {parseSections(selectedStandup.content).map((section) => (
                  <div key={section.title} className="report-section">
                    <h3 className="report-section-title">{section.title}</h3>
                    <ul className="report-list">
                      {section.items.map((item, idx) => (
                        <li key={`${section.title}-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="report-footer">
              <button onClick={() => setSelectedStandup(null)} className="btn-secondary">
                Close
              </button>
              {isClient && selectedStandup && (
                <PDFDownloadLink
                  document={
                    <StandupPDF
                      owner={selectedStandup.owner}
                      repo={selectedStandup.repo}
                      date={selectedStandup.created_at}
                      commits={selectedStandup.commits_count || 0}
                      content={selectedStandup.content}
                    />
                  }
                  fileName={`standup-${selectedStandup.repo}-${new Date(selectedStandup.created_at).toISOString().split("T")[0]}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <button className="btn-primary" disabled={pdfLoading}>
                      {pdfLoading ? "Preparing PDF..." : "Download PDF"}
                    </button>
                  )}
                </PDFDownloadLink>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedStandup.content);
                  toast.success("Copied to clipboard");
                }}
                className="btn-primary"
              >
                Copy Content
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => itemToDelete && deleteStandup(itemToDelete)}
        title="Delete standup report"
        message="This will permanently remove the report from your history."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
