"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const ROADMAP = [
  {
    side: "left",
    quarter: "Step 01 · Setup",
    title: "You push code",
    desc: "Connect your GitHub repo once. Shadow Stand-up registers a webhook — every push and PR is now watched automatically.",
  },
  {
    side: "right",
    quarter: "Step 02 · Capture",
    title: "Diff is captured",
    desc: "A Vercel serverless function parses the incoming webhook, extracts the diff, commit messages, and touched files.",
  },
  {
    side: "left",
    quarter: "Step 03 · Intelligence",
    title: "AI reads the diff",
    desc: "Gemini 1.5 Flash receives the raw diff and turns jargon-heavy changes into a human-readable plain-English summary.",
  },
  {
    side: "right",
    quarter: "Step 04 · Review",
    title: "You review & edit",
    desc: "The dashboard shows you the AI-generated draft. Edit anything — tone, detail, scope — before it goes anywhere.",
  },
  {
    side: "left",
    quarter: "Step 05 · Delivery",
    title: "Posted to Slack",
    desc: "Hit the send button. Your team gets a clean, concise stand-up update directly in Slack or Discord. Done.",
  },
];

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    ),
    title: "GitHub Integration",
    desc: "Connects to your repos via webhooks. Every push and PR is captured automatically — no manual input ever.",
    shortLabel: "GITHUB",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "AI-Powered Summaries",
    desc: "Turns raw diffs and commit messages into plain English stand-ups using Gemini 1.5 Flash — zero jargon.",
    shortLabel: "AI",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Review & Edit",
    desc: "AI writes the first draft, you stay in control. Edit anything before it goes out — takes 10 seconds.",
    shortLabel: "REVIEW",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
    title: "One-Click Delivery",
    desc: "Post directly to Slack or Discord with a single button. No copying, no switching tabs, no forgetting.",
    shortLabel: "SEND",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Full History",
    desc: "Every stand-up is stored in Supabase. Browse, search, and revisit any past summary whenever you need to.",
    shortLabel: "HISTORY",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "100% Free Stack",
    desc: "Built on Vercel, Supabase, GitHub Actions, and Gemini free tiers. Zero infrastructure cost to run.",
    shortLabel: "FREE",
  },
];

const NEURAL_NODES = [
  { id: "center", label: "Shadow\nDashboard", x: 0.5, y: 0.5, r: 22, main: true },
  { id: "n1", label: "GitHub", x: 0.25, y: 0.22, r: 11 },
  { id: "n2", label: "Webhook", x: 0.55, y: 0.17, r: 9 },
  { id: "n3", label: "Diff", x: 0.79, y: 0.27, r: 9 },
  { id: "n4", label: "Gemini AI", x: 0.84, y: 0.5, r: 11 },
  { id: "n5", label: "Summary", x: 0.74, y: 0.72, r: 9 },
  { id: "n6", label: "Slack", x: 0.5, y: 0.84, r: 10 },
  { id: "n7", label: "Supabase", x: 0.27, y: 0.76, r: 10 },
  { id: "n8", label: "History", x: 0.14, y: 0.56, r: 8 },
  { id: "n9", label: "Auth", x: 0.17, y: 0.36, r: 8 },
  { id: "n10", label: "Vercel", x: 0.41, y: 0.3, r: 9 },
  { id: "n11", label: "Context", x: 0.66, y: 0.37, r: 8 },
  { id: "n12", label: "Token", x: 0.34, y: 0.63, r: 7 },
  { id: "n13", label: "Review", x: 0.61, y: 0.63, r: 8 },
  { id: "n14", label: "Commit", x: 0.37, y: 0.13, r: 7 },
  { id: "n15", label: "Discord", x: 0.73, y: 0.11, r: 7 },
  { id: "n16", label: "Next.js", x: 0.46, y: 0.7, r: 9 },
  { id: "n17", label: "TypeScript", x: 0.76, y: 0.89, r: 8 },
  { id: "n18", label: "React", x: 0.9, y: 0.35, r: 8 },
  { id: "n19", label: "Postgres", x: 0.12, y: 0.7, r: 8 },
  { id: "n20", label: "Pipeline", x: 0.63, y: 0.07, r: 7 },
  { id: "n21", label: "OAuth", x: 0.06, y: 0.46, r: 7 },
  { id: "n22", label: "API", x: 0.89, y: 0.63, r: 8 },
  { id: "n23", label: "Prompt", x: 0.79, y: 0.41, r: 7 },
  { id: "n24", label: "Cache", x: 0.2, y: 0.6, r: 7 },
  { id: "n25", label: "CI/CD", x: 0.48, y: 0.88, r: 7 },
];

const NEURAL_EDGES = [
  ["center", "n1"], ["center", "n4"], ["center", "n6"], ["center", "n7"],
  ["center", "n10"], ["center", "n12"], ["center", "n13"], ["center", "n16"],
  ["n1", "n2"], ["n1", "n9"], ["n1", "n14"], ["n1", "n10"],
  ["n2", "n10"], ["n2", "n3"], ["n2", "n20"], ["n2", "n15"],
  ["n3", "n4"], ["n3", "n11"], ["n3", "n23"], ["n3", "n18"],
  ["n4", "n5"], ["n4", "n13"], ["n4", "n22"], ["n4", "n23"],
  ["n5", "n6"], ["n5", "n13"], ["n5", "n17"],
  ["n6", "n7"], ["n6", "n15"], ["n6", "n25"], ["n6", "n17"],
  ["n7", "n8"], ["n7", "n12"], ["n7", "n19"], ["n7", "n25"],
  ["n8", "n9"], ["n8", "n12"], ["n8", "n24"], ["n8", "n19"],
  ["n9", "n14"], ["n9", "n21"], ["n9", "n24"],
  ["n10", "n11"], ["n10", "n12"], ["n10", "n16"],
  ["n11", "n13"], ["n11", "n23"],
  ["n12", "n13"], ["n12", "n16"],
  ["n14", "n15"], ["n14", "n20"],
  ["n16", "n25"],
  ["n18", "n22"], ["n18", "n23"],
  ["n19", "n24"], ["n19", "n21"],
  ["n20", "n15"],
  ["n21", "n24"],
  ["n22", "n5"],
];

function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; pulse: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.floor((canvas.width * canvas.height) / 14000);
      particles = Array.from({ length: Math.max(40, count) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.4,
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const MAX_DIST = 130;

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.015;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 125, 247, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        const pulseR = p.r + Math.sin(p.pulse) * 0.4;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulseR * 4);
        grd.addColorStop(0, "rgba(139, 125, 247, 0.6)");
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseR * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180, 165, 255, 0.85)";
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" />;
}

function ProductRoadmap() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [spineProgress, setSpineProgress] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const totalH = rect.height;
      const scrolled = window.innerHeight * 0.55 - rect.top;
      const p = Math.max(0, Math.min(1, scrolled / totalH));
      setSpineProgress(p);

      let best = -1;
      let bestDist = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const dist = Math.abs(mid - window.innerHeight * 0.5);
        if (mid < window.innerHeight * 0.78 && dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      if (best !== -1) setActiveIdx(best);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="roadmap-wrapper" ref={sectionRef}>
      <div className="roadmap-title-block">
        <div className="roadmap-headline">How It Works</div>
        <div className="roadmap-sub">From first commit to team update</div>
      </div>

      <div className="roadmap-spine-track">
        <div className="roadmap-spine-fill" style={{ height: `${spineProgress * 100}%` }} />
        <div className="roadmap-spine-dot" style={{ top: `${spineProgress * 100}%` }} />
      </div>

      <div className="roadmap-list">
        {ROADMAP.map((item, i) => (
          <div
            key={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className={`roadmap-item${item.side === "right" ? " right" : ""}${activeIdx === i ? " active" : ""}${i < activeIdx ? " passed" : ""}`}
          >
            {item.side === "left" ? (
              <>
                <div className="rm-card">
                  <div className="rm-quarter">{item.quarter}</div>
                  <div className="rm-card-title">{item.title}</div>
                  <div className="rm-card-desc">{item.desc}</div>
                </div>
                <div className="rm-center">
                  <div className="rm-dot-outer">
                    <div className="rm-dot-inner" />
                  </div>
                </div>
                <div className="rm-spacer" />
              </>
            ) : (
              <>
                <div className="rm-spacer" />
                <div className="rm-center">
                  <div className="rm-dot-outer">
                    <div className="rm-dot-inner" />
                  </div>
                </div>
                <div className="rm-card">
                  <div className="rm-quarter">{item.quarter}</div>
                  <div className="rm-card-title">{item.title}</div>
                  <div className="rm-card-desc">{item.desc}</div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrbitFeatures() {
  const [active, setActive] = useState(0);

  const innerFeatures = FEATURES.slice(0, 2);
  const outerFeatures = FEATURES.slice(2);
  const feat = FEATURES[active];

  return (
    <div className="orbit-section">
      <div className="orbit-canvas">
        <div className="orbit-ring orbit-ring-inner" />
        <div className="orbit-ring orbit-ring-outer" />

        <div className="orbit-center">
          <span className="orbit-center-text">Shadow<br />Stand-up</span>
        </div>

        <div className="orbit-track orbit-track-inner">
          {innerFeatures.map((f, i) => {
            const angle = (i / innerFeatures.length) * 360;
            const globalIdx = i;
            return (
              <div
                key={i}
                className="orbit-node-slot"
                style={{ transform: `rotate(${angle}deg) translateX(90px)` }}
              >
                <div
                  className={`orbit-node orbit-node-counter orbit-counter-inner${active === globalIdx ? " active" : ""}`}
                  style={{ "--angle": `${angle}deg` } as React.CSSProperties}
                  onClick={() => setActive(globalIdx)}
                >
                  {f.icon}
                </div>
                <span className={`orbit-node-label orbit-label-counter-inner${active === globalIdx ? " label-active" : ""}`}>
                  {f.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div className="orbit-track orbit-track-outer">
          {outerFeatures.map((f, i) => {
            const angle = (i / outerFeatures.length) * 360 + 22;
            const globalIdx = i + 2;
            return (
              <div
                key={i}
                className="orbit-node-slot"
                style={{ transform: `rotate(${angle}deg) translateX(172px)` }}
              >
                <div
                  className={`orbit-node orbit-node-counter orbit-counter-outer${active === globalIdx ? " active" : ""}`}
                  style={{ "--angle": `${angle}deg` } as React.CSSProperties}
                  onClick={() => setActive(globalIdx)}
                >
                  {f.icon}
                </div>
                <span className={`orbit-node-label orbit-label-counter-outer${active === globalIdx ? " label-active" : ""}`}>
                  {f.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        <svg className="orbit-lines-svg" viewBox="0 0 420 420" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="lineGrad">
              <stop offset="0%" stopColor="rgba(139,125,247,0.5)" />
              <stop offset="100%" stopColor="rgba(139,125,247,0)" />
            </radialGradient>
          </defs>
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const r = 210;
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={210}
                y1={210}
                x2={210 + r * Math.cos(rad)}
                y2={210 + r * Math.sin(rad)}
                stroke="rgba(139,125,247,0.06)"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>

      <div className="orbit-detail visible">
        <div className="detail-header">
          <span className="detail-icon">{feat.icon}</span>
          <span className="detail-title">{feat.title}</span>
          <span className="detail-index">{String(active + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}</span>
        </div>
        <p className="detail-desc">{feat.desc}</p>
        <div className="detail-dots">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              className={`detail-dot${active === i ? " active" : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NeuralNetwork() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    offset: { x: 0, y: 0 },
    zoom: 1,
    dragging: false,
    lastMouse: null as { x: number; y: number } | null,
    selected: null as string | null,
    nodes: [] as any[],
    edges: NEURAL_EDGES as [string, string][],
    animFrame: null as number | null,
    pulseT: 0,
  });

  const buildNodes = useCallback((W: number, H: number) => {
    return NEURAL_NODES.map((n) => ({
      ...n,
      px: n.x * W,
      py: n.y * H,
    }));
  }, []);

  const draw = useCallback((ts = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    s.pulseT = ts;
    const { offset, zoom, selected, nodes, edges } = s;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const step = 36;
    const startX = Math.floor(-offset.x / zoom / step) * step - step;
    const startY = Math.floor(-offset.y / zoom / step) * step - step;
    const endX = startX + W / zoom + step * 2;
    const endY = startY + H / zoom + step * 2;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let gx = startX; gx < endX; gx += step) {
      for (let gy = startY; gy < endY; gy += step) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const connectedIds = new Set<string>();
    if (selected) {
      edges.forEach(([a, b]) => {
        if (a === selected) connectedIds.add(b);
        if (b === selected) connectedIds.add(a);
      });
    }

    edges.forEach(([a, b]) => {
      const na = nodes.find((n) => n.id === a);
      const nb = nodes.find((n) => n.id === b);
      if (!na || !nb) return;
      const isHighlighted = selected && (a === selected || b === selected);
      ctx.beginPath();
      ctx.moveTo(na.px, na.py);
      ctx.lineTo(nb.px, nb.py);
      ctx.strokeStyle = isHighlighted
        ? "rgba(229,69,69,0.75)"
        : selected
        ? "rgba(255,255,255,0.05)"
        : "rgba(139,125,247,0.2)";
      ctx.lineWidth = isHighlighted ? 2 : 0.9;
      ctx.stroke();
    });

    nodes.forEach((n) => {
      const highlight = selected && (n.id === selected || connectedIds.has(n.id));
      const pulse = (Math.sin(ts / 500 + n.x * 10) + 1) / 2;
      const r = n.r + (highlight ? 2 : 0) + pulse * 0.8;
      const fill = n.main ? "rgba(139,125,247,0.35)" : "rgba(139,125,247,0.2)";
      ctx.beginPath();
      ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
      ctx.fillStyle = highlight ? "rgba(229,69,69,0.35)" : fill;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.px, n.py, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = highlight ? "rgba(229,69,69,0.5)" : "rgba(139,125,247,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `${n.main ? 12 : 10}px ${n.main ? "Syne" : "JetBrains Mono"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = String(n.label).split("\n");
      lines.forEach((line: string, i: number) => {
        ctx.fillText(line, n.px, n.py + (i - (lines.length - 1) / 2) * 12);
      });
    });

    ctx.restore();
    s.animFrame = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      s.nodes = buildNodes(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);
    s.animFrame = requestAnimationFrame(draw);

    const getMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => {
      s.dragging = true;
      s.lastMouse = getMouse(e);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!s.dragging || !s.lastMouse) return;
      const m = getMouse(e);
      s.offset.x += m.x - s.lastMouse.x;
      s.offset.y += m.y - s.lastMouse.y;
      s.lastMouse = m;
    };

    const onMouseUp = () => {
      s.dragging = false;
      s.lastMouse = null;
    };

    const onClick = (e: MouseEvent) => {
      const m = getMouse(e);
      const cx = (m.x - s.offset.x) / s.zoom;
      const cy = (m.y - s.offset.y) / s.zoom;
      let hit: string | null = null;
      s.nodes.forEach((n) => {
        const dx = cx - n.px;
        const dy = cy - n.py;
        if (Math.sqrt(dx * dx + dy * dy) < n.r + 6) {
          hit = n.id;
        }
      });
      s.selected = hit;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      s.zoom = Math.max(0.6, Math.min(1.6, s.zoom * delta));
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      if (s.animFrame) cancelAnimationFrame(s.animFrame);
    };
  }, [buildNodes, draw]);

  return (
    <div className="neural-wrapper">
      <div className="neural-header">
        <span className="neural-header-label left">Interactive stack</span>
        <span className="neural-header-label right">Tap nodes</span>
      </div>
      <canvas ref={canvasRef} className="neural-canvas" />
      <div className="neural-footer">
        <span className="neural-hint">Drag to pan</span>
        <span className="neural-tagline">Everything connected.</span>
      </div>
      <div className="neural-controls">
        <button className="neural-btn" onClick={() => {
          stateRef.current.zoom = 1;
          stateRef.current.offset = { x: 0, y: 0 };
        }}>Reset</button>
        <button className="neural-btn" onClick={() => (stateRef.current.zoom = Math.min(1.6, stateRef.current.zoom + 0.1))}>Zoom in</button>
        <button className="neural-btn" onClick={() => (stateRef.current.zoom = Math.max(0.6, stateRef.current.zoom - 0.1))}>Zoom out</button>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-section about-hero">
        <HeroParticles />
        <div className="hero-content">
          <div className="hero-badge">Shadow Stand-up</div>
          <h1 className="hero-title">
            Turn your <span className="hero-accent">daily commits</span> into a stand-up in seconds.
          </h1>
          <p className="hero-desc">
            Shadow watches your GitHub activity, extracts the important diffs, and drafts the perfect stand-up report.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="section-label">Product roadmap</div>
        <ProductRoadmap />
      </section>

      <section className="about-section">
        <div className="section-label">Feature orbit</div>
        <OrbitFeatures />
      </section>

      <section className="about-section">
        <div className="section-label">Tech stack</div>
        <NeuralNetwork />
      </section>

      <section className="about-section">
        <div className="about-note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          Shadow Standup is designed to feel invisible: no extra tabs, no copy-paste, just a clean summary of your day.
        </div>
      </section>
    </div>
  );
}
