"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CodeReviewer from "@/components/CodeReviewer";
import Auth from "@/components/Auth";

export default function CodeReviewPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      <div className="signin-page">
        <div className="signin-copy">
          <h1 className="signin-title">Sign in to Code Reviewer</h1>
          <p className="signin-desc">
            Connect your GitHub account to inspect files, commits, and line ranges with AI review.
          </p>
        </div>
        <Auth />
      </div>
    );
  }

  return <CodeReviewer userId={session.user.id} />;
}
