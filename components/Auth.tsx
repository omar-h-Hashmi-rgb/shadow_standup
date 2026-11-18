"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { CodeXml } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const handleLogin = async () => {
    // About is the default page, so remember to send the user to the app once
    // they return from GitHub (see PostLoginRedirect). The OAuth redirect URL
    // itself is unchanged, so no Supabase redirect configuration is affected.
    try {
      sessionStorage.setItem("post_login_redirect", "/standup");
    } catch {
      /* storage unavailable: user simply lands on the default page */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo",
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("[auth] GitHub sign-in failed:", error.message);
      toast.error("Unable to start GitHub sign-in", {
        description: error.message,
      });
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">Continue with GitHub</h2>
      <p className="auth-subtitle">Sign in to connect your repositories.</p>

      <button onClick={handleLogin} className="auth-button">
        <CodeXml size={16} />
        Sign in with GitHub
      </button>
    </div>
  );
}
