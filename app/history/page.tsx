"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronRight, History as HistoryIcon, Loader2, Trash2 } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { StandupPDF } from "@/components/StandupPDF";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";

export default function HistoryPage() {
  const [session, setSession] = useState<any>(null);
  const [standups, setStandups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStandup, setSelectedStandup] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("history")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (data) setStandups(data);
    setLoading(false);
  };

  const deleteStandup = async (id: string) => {
    const { error } = await supabase.from("history").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete report");
    } else {
      setStandups((prev) => prev.filter((s) => s.id !== id));
      if (selectedStandup?.id === id) setSelectedStandup(null);
      toast.success("Report deleted successfully");
    }
  };

  const openDeleteConfirm = (id: string) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const sentCount = standups.filter((s) => s.commits_count && s.commits_count > 0).length;
  const draftCount = standups.length - sentCount;

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

      {loading ? (
        <div className="panel-label">
          <Loader2 size={16} className="icon-spin" />
          Syncing history...
        </div>
      ) : standups.length > 0 ? (
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
                  </div>
                  <div className="history-row-meta">
                    <span className="meta-commits">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" />
                      </svg>
                      {item.commits_count || 0} commits
                    </span>
                    <span className={`status-badge ${item.commits_count ? "sent" : "draft"}`}>
                      {item.commits_count ? "Sent" : "Draft"}
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
                      <button className="btn-edit" onClick={() => openDeleteConfirm(item.id)}>
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
          <p>No stand-ups yet. Generate your first one on the Review tab.</p>
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
              <button className="report-close" onClick={() => setSelectedStandup(null)}>
                <ChevronRight size={20} className="report-close-icon" />
              </button>
            </div>

            <div className="report-body">
              <div className="report-content">
                <ReactMarkdown>{selectedStandup.content}</ReactMarkdown>
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
