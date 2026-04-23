"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StandupGenerator from "@/components/StandupGenerator";
import Auth from "@/components/Auth";

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="review-page">
        <div className="panel-label">Checking authentication...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="landing-page">
        <div className="landing-hero">
          <span className="landing-badge">Shadow Standup</span>
          <h1 className="landing-title">Automated standups from your real GitHub work.</h1>
          <p className="landing-desc">
            Connect your repos and let Shadow summarize your activity into clear, professional updates. Review, edit, and share in seconds.
          </p>
        </div>
        <Auth />
      </div>
    );
  }

  return <StandupGenerator userId={session.user.id} />;
}
