"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { CodeXml } from "lucide-react";

export default function Auth() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo',
        redirectTo: window.location.origin
      }
    });
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">Welcome Back</h2>
      <p className="auth-subtitle">Sign in with your GitHub account to continue.</p>

      <button onClick={handleLogin} className="auth-button">
        <CodeXml size={18} />
        Sign in with GitHub
      </button>

      <p className="auth-footnote">Secure authentication via Supabase</p>
    </div>
  );
}
