"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, Menu, Settings, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

// The five primary destinations. About is the default page ("/").
const primaryNav = [
  { href: "/", label: "About" },
  { href: "/review", label: "Analyze" },
  { href: "/standup", label: "Standup" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

// Secondary tools live behind the menu so the top bar stays focused.
const secondaryNav = [
  { href: "/code-review", label: "Code Reviewer", desc: "Review commits, files, selections or lines", icon: ShieldCheck },
  { href: "/settings#integrations", label: "Integrations", desc: "Slack, Discord, Teams, Jira, Trello", icon: Settings },
  { href: "/settings#github", label: "GitHub access", desc: "Personal access token", icon: KeyRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/about";
  return pathname === href.split("#")[0];
}

export default function Navbar() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  // Menu state is keyed to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setOpenOn((cur) => ((typeof next === "function" ? next(cur === pathname) : next) ? pathname : null));
  }, [pathname]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setHasSession(!!session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setHasSession(!!session));
    return () => subscription.unsubscribe();
  }, []);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, [setOpen]);

  // Close on Escape or an outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const handleSignOut = async () => {
    close();
=======
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/review", label: "Analyze", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ) },
  { href: "/standup", label: "Standup", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ) },
  { href: "/code-review", label: "Code Review", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ) },
  { href: "/history", label: "History", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ) },
  { href: "/about", label: "About", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ) },
  { href: "/settings", label: "Settings", icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ) },
];

export default function Navbar() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
>>>>>>> origin/main
    await supabase.auth.signOut();
  };

  return (
<<<<<<< HEAD
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand" aria-label="Shadow Standup home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-name">Shadow Standup</span>
        </Link>

        <nav className="navbar-links" aria-label="Main">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(pathname, item.href) ? " active" : ""}`}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="navbar-actions">
          <button
            ref={buttonRef}
            type="button"
            className={`menu-button${open ? " open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="app-menu"
            aria-haspopup="true"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="menu-panel" id="app-menu" ref={panelRef}>
          <div className="menu-section menu-mobile-only">
            <div className="menu-heading">Navigate</div>
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={`menu-item${isActive(pathname, item.href) ? " active" : ""}`}>
                <span className="menu-item-label">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="menu-section">
            <div className="menu-heading">Tools</div>
            {secondaryNav.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} className={`menu-item${isActive(pathname, href) ? " active" : ""}`}>
                <Icon size={16} className="menu-item-icon" aria-hidden="true" />
                <span>
                  <span className="menu-item-label">{label}</span>
                  <span className="menu-item-desc">{desc}</span>
                </span>
              </Link>
            ))}
          </div>

          {hasSession && (
            <div className="menu-section">
              <div className="menu-heading">Account</div>
              <button type="button" className="menu-item" onClick={handleSignOut}>
                <LogOut size={16} className="menu-item-icon" aria-hidden="true" />
                <span className="menu-item-label">Sign out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
=======
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-dot" />
          <span className="brand-name">Shadow</span>
          <span className="brand-tag">stand-up</span>
        </div>

        <div className="navbar-links">
          {navItems.map((item) => {
            const isActive = item.href === "/review"
              ? pathname === "/" || pathname === "/review"
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="navbar-status">
          {hasSession ? (
            <button onClick={handleSignOut} className="nav-signout">Sign out</button>
          ) : null}
          <span className="status-dot" />
          <span className="status-text">Live</span>
        </div>
      </div>
    </nav>
>>>>>>> origin/main
  );
}
