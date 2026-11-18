<<<<<<< HEAD
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StandupGenerator from "@/components/StandupGenerator";
import Auth from "@/components/Auth";

export default function ReviewPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
          <h1 className="signin-title">Sign in to Shadow Standup</h1>
          <p className="signin-desc">
            Connect your GitHub account to generate standups and code reviews from your real repository activity.
          </p>
        </div>
        <Auth />
      </div>
    );
  }

  return <StandupGenerator userId={session.user.id} />;
}
=======
import ReviewPage from "../page";

export default ReviewPage;
>>>>>>> origin/main
