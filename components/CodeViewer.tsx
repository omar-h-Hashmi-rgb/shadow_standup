"use client";

import React, { useCallback, useEffect, useRef } from "react";

export type LineRange = { start: number; end: number } | null;

interface CodeViewerProps {
  lines: string[];
  /** view: read-only · range: click/shift-click line numbers · select: also highlight text with the mouse */
  mode: "view" | "range" | "select";
  range: LineRange;
  onRangeChange?: (range: LineRange) => void;
}

/** Read-only, line-numbered source viewer used by the Code Reviewer. */
export default function CodeViewer({ lines, mode, range, onRangeChange }: CodeViewerProps) {
  const anchor = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const interactive = mode !== "view" && !!onRangeChange;

  const pickLine = (n: number, e: React.MouseEvent) => {
    if (!interactive) return;
    if (e.shiftKey && anchor.current !== null) {
      onRangeChange!({ start: Math.min(anchor.current, n), end: Math.max(anchor.current, n) });
    } else {
      anchor.current = n;
      onRangeChange!({ start: n, end: n });
    }
  };

  // Text selection → whole-line range (Selection mode).
  const readSelection = useCallback(() => {
    if (mode !== "select" || !onRangeChange) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !scroller.current) return;

    const lineOf = (node: Node | null): number | null => {
      const el = node instanceof Element ? node : node?.parentElement;
      const row = el?.closest<HTMLElement>("[data-line]");
      return row && scroller.current!.contains(row) ? Number(row.dataset.line) : null;
    };
    const a = lineOf(sel.anchorNode);
    const b = lineOf(sel.focusNode);
    if (a === null || b === null) return;

    const start = Math.min(a, b);
    let end = Math.max(a, b);
    // A drag that ends at column 0 of the next line did not really select that line.
    const focusAtLineStart = sel.focusOffset === 0 && b > a;
    if (focusAtLineStart && sel.focusNode === sel.getRangeAt(sel.rangeCount - 1).endContainer) end = Math.max(start, end - 1);
    anchor.current = start;
    onRangeChange({ start, end });
  }, [mode, onRangeChange]);

  useEffect(() => {
    // Scroll the selected range into view when it is set from the inputs.
    if (!range || !scroller.current) return;
    const row = scroller.current.querySelector<HTMLElement>(`[data-line="${range.start}"]`);
    if (row && mode !== "select") {
      const box = scroller.current;
      if (row.offsetTop < box.scrollTop || row.offsetTop > box.scrollTop + box.clientHeight - 24) {
        box.scrollTop = Math.max(0, row.offsetTop - 48);
      }
    }
  }, [range?.start, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={scroller}
      className={`code-viewer${mode === "select" ? " is-selectable" : ""}`}
      onMouseUp={readSelection}
      onKeyUp={readSelection}
      role="region"
      aria-label="File contents"
    >
      {lines.map((text, i) => {
        const n = i + 1;
        const inRange = !!range && n >= range.start && n <= range.end;
        return (
          <div key={n} data-line={n} className={`code-row${inRange ? " in-range" : ""}`}>
            <button
              type="button"
              className="code-gutter"
              tabIndex={interactive ? 0 : -1}
              onClick={(e) => pickLine(n, e)}
              aria-label={`Line ${n}`}
              disabled={!interactive}
            >
              {n}
            </button>
            <code className="code-text">{text === "" ? "\u200b" : text}</code>
          </div>
        );
      })}
    </div>
  );
}
