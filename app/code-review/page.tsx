"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CodeReviewer from "@/components/CodeReviewer";

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
      <div className="review-page">
        <div className="summary-panel">
          <div className="panel-label">Sign in required</div>
          <p className="panel-subtle">Sign in to use the code review feature.</p>
          <div className="summary-actions">
            <a className="btn-primary" href="/">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  return <CodeReviewer userId={session.user.id} />;
}
