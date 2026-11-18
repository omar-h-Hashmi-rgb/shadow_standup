"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, GitCommitHorizontal, ScanSearch, Send, KeyRound } from "lucide-react";


const CSS = `.ab{--bg:#050505;--fg:#f4f4f1;--dim:#9a9a94;--line:rgba(190,200,90,.22);--ac:#ff6a1a;--gr:#b6e23a;background:var(--bg);color:var(--fg);font-family:var(--font-geist-sans,Inter,system-ui,sans-serif);overflow-x:hidden;-webkit-font-smoothing:antialiased}.ab *{box-sizing:border-box}.ab a{color:inherit}.ab-sec{max-width:1120px;margin:0 auto;padding:96px 24px 0}.ab-h2{font-size:clamp(2rem,5vw,3.6rem);font-weight:600;letter-spacing:-.04em;line-height:1;margin:0 0 40px}.ab .rv{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}.ab .rv.in{opacity:1;transform:none}.ab-hero{position:relative;min-height:92vh;padding:120px 24px 80px;max-width:1280px;margin:0 auto;display:flex;flex-direction:column;justify-content:center;overflow:hidden}.ab-lines{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(115deg,transparent 0 120px,var(--line) 120px 121px),linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/25% 100%;animation:drift 18s linear infinite;mask-image:linear-gradient(#000 60%,transparent)}@keyframes drift{to{background-position:240px 0,0 0}}.ab-glow{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:.55}.g1{width:420px;height:420px;background:var(--ac);right:4%;top:12%;animation:float1 14s ease-in-out infinite}.g2{width:340px;height:340px;background:var(--gr);right:24%;bottom:6%;opacity:.28;animation:float2 17s ease-in-out infinite}@keyframes float1{50%{transform:translate(-60px,50px) scale(1.15)}}@keyframes float2{50%{transform:translate(70px,-40px) scale(.9)}}.ab-meta{position:relative;display:flex;flex-wrap:wrap;gap:12px 40px;font-size:.78rem;color:var(--dim);margin-bottom:28px}.ab-live{display:inline-flex;align-items:center;gap:8px}.ab-live i{width:8px;height:8px;border-radius:50%;background:var(--gr);box-shadow:0 0 0 0 var(--gr);animation:ping 1.8s infinite}@keyframes ping{to{box-shadow:0 0 0 12px transparent}}.ab-title{position:relative;margin:0;font-weight:600;letter-spacing:-.055em;line-height:.9;font-size:clamp(3.2rem,12vw,9.5rem)}.ab-title span{display:block;opacity:0;transform:translateY(60%);animation:rise .9s cubic-bezier(.2,.8,.2,1) forwards}.ab-title .l2{animation-delay:.12s;padding-left:clamp(0px,8vw,120px)}.ab-title .l3{animation-delay:.24s;color:transparent;-webkit-text-stroke:1.5px var(--fg);font-size:.55em;letter-spacing:-.04em;margin-top:.15em}.ab-title em{font-style:normal;display:inline-block;background:var(--fg);color:var(--bg);padding:0 .08em;transform:skewX(-12deg)}@keyframes rise{to{opacity:1;transform:none}}.ab-lead{position:relative;max-width:520px;color:var(--dim);font-size:1.05rem;line-height:1.6;margin:32px 0}.ab-cta{position:relative;display:flex;gap:12px;flex-wrap:wrap}.ab-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border:1px solid rgba(255,255,255,.3);text-decoration:none;font-size:.95rem;clip-path:polygon(0 0,100% 0,100% 70%,94% 100%,0 100%);transition:background .25s,color .25s,transform .25s}.ab-btn:hover{background:var(--fg);color:var(--bg)!important;transform:translateY(-2px)}.ab-btn.solid{background:var(--fg);color:var(--bg)!important;border-color:var(--fg)}.ab-btn.solid:hover{background:var(--ac);border-color:var(--ac)}.ab-btn:focus-visible,.ab summary:focus-visible{outline:2px solid var(--gr);outline-offset:3px}.ab-badge{position:absolute;right:6%;bottom:12%;width:110px;color:var(--fg);opacity:.8;animation:spin 20s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.ab-tape{border-block:1px solid var(--line);overflow:hidden;white-space:nowrap;padding:18px 0;margin-top:20px}.ab-track{display:inline-flex;animation:tape 28s linear infinite}.ab-tape:hover .ab-track{animation-play-state:paused}.ab-track span{font-size:clamp(1.6rem,4vw,3rem);font-weight:600;letter-spacing:-.03em;padding:0 28px}.ab-track b{margin-left:56px;color:var(--ac);font-weight:400}@keyframes tape{to{transform:translateX(-50%)}}.ab-stats{max-width:1120px;margin:0 auto;padding:80px 24px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px}.ab-stats strong{display:block;font-size:clamp(3.5rem,8vw,6rem);letter-spacing:-.06em;line-height:1;font-weight:600}.ab-stats span{color:var(--dim);font-size:.95rem}.ab-stats>div{border-left:1px solid var(--line);padding-left:20px}.ab-term{border:1px solid rgba(255,255,255,.14);background:#0b0b0b;max-width:680px;box-shadow:0 0 80px rgba(255,106,26,.12)}.ab-term-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);font-size:.75rem;color:var(--dim)}.ab-term-bar i{width:9px;height:9px;border-radius:50%;background:#333}.ab-term-bar span{margin-left:auto}.ab-term pre{margin:0;padding:20px;font:13.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow:hidden}.ab-term .c{color:var(--gr)}.ab-term .d{color:var(--dim)}.ab-term .cur{display:inline-block;width:8px;height:15px;background:var(--fg);vertical-align:-2px;margin-left:4px;animation:blink 1s steps(2) infinite}@keyframes blink{50%{opacity:0}}.ab-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0;border:1px solid var(--line)}.ab-steps li{position:relative;padding:32px 26px 40px;border-right:1px solid var(--line);transition:background .3s}.ab-steps li:last-child{border-right:0}.ab-steps li:hover{background:rgba(255,106,26,.07)}.ab-steps svg{color:var(--ac);margin-bottom:56px;transition:transform .4s}.ab-steps li:hover svg{transform:translateX(8px) rotate(-8deg)}.ab-steps h3{margin:0 0 10px;font-size:1.25rem;letter-spacing:-.02em}.ab-steps p{margin:0;color:var(--dim);font-size:.93rem;line-height:1.55}.ab-steps .n{position:absolute;right:18px;top:10px;font-size:3.4rem;font-weight:600;color:rgba(255,255,255,.06)}.ab-bento{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ab-card{position:relative;padding:28px;border:1px solid rgba(255,255,255,.12);overflow:hidden;min-height:180px;transition:border-color .3s,transform .3s}.ab-card::before{content:"";position:absolute;width:220px;height:220px;right:-80px;bottom:-100px;border-radius:50%;background:var(--ac);filter:blur(70px);opacity:0;transition:opacity .4s}.ab-card:hover{border-color:var(--ac)}.ab-card:hover::before{opacity:.45}.ab-card.big{grid-column:span 2}.ab-card h3{margin:0 0 10px;font-size:1.4rem;letter-spacing:-.03em;position:relative}.ab-card p{margin:0;color:var(--dim);line-height:1.55;max-width:44ch;position:relative}.ab-faq{border-top:1px solid var(--line);max-width:760px}.ab details{border-bottom:1px solid var(--line)}.ab summary{cursor:pointer;list-style:none;padding:22px 0;font-size:1.15rem;display:flex;justify-content:space-between;gap:16px}.ab summary::-webkit-details-marker{display:none}.ab summary::after{content:"+";color:var(--ac);font-size:1.5rem;line-height:1;transition:transform .3s}.ab details[open] summary::after{transform:rotate(135deg)}.ab details p{margin:0 0 22px;color:var(--dim);line-height:1.6;max-width:60ch;animation:rise .4s both}.ab-note{color:var(--dim);margin-top:24px}.ab-note a{color:var(--gr);text-underline-offset:3px}.ab-final{position:relative;overflow:hidden;margin:120px auto 0;max-width:1280px;padding:120px 24px;text-align:center;border-top:1px solid var(--line)}.ab-final .g1{left:50%;right:auto;top:20%;transform:translateX(-50%);opacity:.4}.ab-final h2{position:relative;font-size:clamp(2.4rem,8vw,6rem);letter-spacing:-.05em;line-height:.95;margin:0 0 32px;font-weight:600}.ab-final .ab-btn{position:relative}@media(max-width:760px){.ab-bento{grid-template-columns:1fr}.ab-card.big{grid-column:auto}.ab-badge{display:none}.ab-steps li{border-right:0;border-bottom:1px solid var(--line)}}@media(prefers-reduced-motion:reduce){.ab *,.ab *::before{animation:none!important;transition:none!important}.ab .rv,.ab-title span{opacity:1;transform:none}}`;

const STEPS = [
  { icon: KeyRound, title: "Connect GitHub", desc: "Sign in and add a personal access token so Shadow can read the repositories you choose." },
  { icon: GitCommitHorizontal, title: "Pick the work", desc: "Select a repository, then the commits, file, lines or folder to summarise or review." },
  { icon: ScanSearch, title: "Analyse", desc: "A Gemini or Groq-hosted model turns the diff or source into a structured standup or review." },
  { icon: Send, title: "Review and deliver", desc: "Read the result, export a PDF, and post it to Slack, Discord, Teams, Jira or Trello." },
];

const FEATURES = [
  { title: "Standup generation", desc: "Recent commits become progress, today's focus, blockers and a code-health score.", big: true },
  { title: "Code review", desc: "Findings across security, quality, performance and best practices, with line numbers and fixes." },
  { title: "Flexible scope", desc: "Review commits, a file, highlighted code, a line range, or a whole codebase." },
  { title: "Team delivery", desc: "Send results to the tools your team uses. Each destination is optional.", big: true },
  { title: "History and PDFs", desc: "Every standup is saved to your account and downloadable as a PDF." },
  { title: "Security first", desc: "Authenticated APIs, encrypted credentials, input validation and rate limits." },
];

const TOOLS = ["GitHub", "Slack", "Discord", "Microsoft Teams", "Jira", "Trello", "Gemini", "Groq", "Supabase", "Next.js"];

const GUIDE = [
  { q: "Which GitHub token do I need?", a: "A classic token with the repo scope, or a fine-grained token with read access to Contents and Metadata for the repositories you want." },
  { q: "Where do I set up Slack, Discord or Teams?", a: "Open Settings, then Integrations. Anything you leave empty is skipped when you post." },
  { q: "Which AI model should I pick?", a: "Smaller models are faster for standups. Larger ones give deeper code reviews on big diffs." },
  { q: "Why is my repo list empty?", a: "Usually the token has expired or lacks access. Save a new one in Settings and reload." },
];

export default function AboutPage() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".ab .rv");
    const io = new IntersectionObserver(
      (en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.15 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  const tape = [...TOOLS, ...TOOLS];
  return (
    <div className="ab">
      <title>Shadow Standup</title>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* HERO */}
      <section className="ab-hero">
        <div className="ab-glow g1" />
        <div className="ab-glow g2" />
        <div className="ab-lines" />
        <div className="ab-meta">
          <span>Shadow Standup</span>
          <span>Reads commits. Writes updates.</span>
          <span className="ab-live"><i /> Live from GitHub</span>
        </div>
        <h1 className="ab-title">
          <span className="l1">Skip the</span>
          <span className="l2">stand-<em>up</em>.</span>
          <span className="l3">Ship the work.</span>
        </h1>
        <p className="ab-lead">
          Shadow reads your commits and source code, writes the update you would otherwise type by hand, and posts it where your team
          works.
        </p>
        <div className="ab-cta">
          <Link href="/review" className="ab-btn solid">Open dashboard <ArrowRight size={15} /></Link>
          <Link href="/code-review" className="ab-btn">Review code</Link>
        </div>
        <svg className="ab-badge" viewBox="0 0 100 90" aria-hidden="true">
          <polygon points="50,6 94,84 6,84" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="50" cy="56" r="14" fill="none" stroke="currentColor" />
          <path d="M36 56h28M50 42v28" stroke="currentColor" />
        </svg>
      </section>

      {/* TICKER */}
      <div className="ab-tape" aria-hidden="true">
        <div className="ab-track">{tape.map((t, i) => <span key={i}>{t}<b>\</b></span>)}</div>
      </div>

      {/* STATS */}
      <section className="ab-stats rv">
        <div><strong>30s</strong><span>from commits to a finished standup</span></div>
        <div><strong>5</strong><span>review scopes, from one line to a codebase</span></div>
        <div><strong>6</strong><span>destinations for your update</span></div>
      </section>

      {/* DEMO */}
      <section className="ab-sec ab-demo rv">
        <h2 className="ab-h2">See what it writes</h2>
        <div className="ab-term">
          <div className="ab-term-bar"><i /><i /><i /><span>standup.md</span></div>
          <pre>
            <span className="c">$ shadow standup --repo api-server --since 24h</span>{"\n"}
            <span className="d">Reading 7 commits…</span>{"\n\n"}
            <b>Progress</b>{"\n"}- Added rate limiting to /api/commits{"\n"}- Fixed token validation on login{"\n\n"}
            <b>Today</b>{"\n"}- Wire up Teams notifications{"\n\n"}
            <b>Blockers</b>{"\n"}- None{"\n"}
            <b>Code health</b> 86/100<span className="cur" />
          </pre>
        </div>
      </section>

      {/* STEPS */}
      <section className="ab-sec">
        <h2 className="ab-h2 rv">How it works</h2>
        <ol className="ab-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rv" style={{ transitionDelay: `${i * 90}ms` }}>
              <s.icon size={22} />
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <span className="n">{i + 1}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURES */}
      <section className="ab-sec">
        <h2 className="ab-h2 rv">What you get</h2>
        <div className="ab-bento">
          {FEATURES.map((f) => (
            <div key={f.title} className={`ab-card rv${f.big ? " big" : ""}`}>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GUIDE */}
      <section className="ab-sec">
        <h2 className="ab-h2 rv">Quick guide</h2>
        <div className="ab-faq rv">
          {GUIDE.map((g) => (
            <details key={g.q}>
              <summary>{g.q}</summary>
              <p>{g.a}</p>
            </details>
          ))}
        </div>
        <p className="ab-note rv">
          Set up destinations in <Link href="/settings#integrations">Settings</Link>.
        </p>
      </section>

      {/* CTA */}
      <section className="ab-final rv">
        <div className="ab-glow g1" />
        <h2>Write your first standup.</h2>
        <Link href="/standup" className="ab-btn solid">Generate standup <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}