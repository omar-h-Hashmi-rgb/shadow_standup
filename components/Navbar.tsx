"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    await supabase.auth.signOut();
  };

  return (
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
  );
}
