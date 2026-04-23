"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StandupGenerator from "@/components/StandupGenerator";
import Auth from "@/components/Auth";
import LightPillar from "@/components/LightPillar";
import SpotlightCard from "@/components/SpotlightCard";
import { Brain, CodeXml, FileText, Moon, History, Zap } from "lucide-react";

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
      <div className="landing-wrapper">
        <div className="landing-page">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
          <LightPillar
            topColor="#5227FF"
            bottomColor="#FF9FFC"
            intensity={0.8}
            rotationSpeed={0.2}
            glowAmount={0.003}
            pillarWidth={4.0}
            pillarHeight={0.6}
            noiseIntensity={0.3}
            mixBlendMode="screen"
          />
        </div>
        <div className="landing-hero relative z-10">
          <span className="landing-badge">Shadow Standup</span>
          <h1 className="landing-title">Automated standups from your real GitHub work.</h1>
          <p className="landing-desc">
            Connect your repos and let Shadow summarize your activity into clear, professional updates. Review, edit, and share in seconds.
          </p>
        </div>
        <div className="relative z-50 pointer-events-auto">
          <Auth />
        </div>
      </div>

      <div className="relative z-10 feature-grid">
        <div className="feature-grid-content">
          <SpotlightCard className="feature-card" spotlightColor="rgba(82, 39, 255, 0.2)">
            <Brain className="feature-icon" />
            <h3 className="feature-title">AI Intelligence</h3>
            <p className="feature-desc">Powered by Gemini & Groq for highly accurate, professional summaries.</p>
          </SpotlightCard>

          <SpotlightCard className="feature-card" spotlightColor="rgba(255, 159, 252, 0.2)">
            <CodeXml className="feature-icon" />
            <h3 className="feature-title">Commit Analysis</h3>
            <p className="feature-desc">Deep analysis of your daily GitHub activity to capture every detail.</p>
          </SpotlightCard>

          <SpotlightCard className="feature-card" spotlightColor="rgba(82, 39, 255, 0.2)">
            <FileText className="feature-icon" />
            <h3 className="feature-title">PDF Reports</h3>
            <p className="feature-desc">Download polished, well-formatted PDF reports ready for your team.</p>
          </SpotlightCard>

          <SpotlightCard className="feature-card" spotlightColor="rgba(255, 159, 252, 0.2)">
            <Moon className="feature-icon" />
            <h3 className="feature-title">Dark Mode UI</h3>
            <p className="feature-desc">A sleek, high-contrast dark theme designed specifically for developers.</p>
          </SpotlightCard>

          <SpotlightCard className="feature-card" spotlightColor="rgba(82, 39, 255, 0.2)">
            <History className="feature-icon" />
            <h3 className="feature-title">History Log</h3>
            <p className="feature-desc">Keep a complete, searchable history of all your past standup updates.</p>
          </SpotlightCard>

          <SpotlightCard className="feature-card" spotlightColor="rgba(255, 159, 252, 0.2)">
            <Zap className="feature-icon" />
            <h3 className="feature-title">Instant Sync</h3>
            <p className="feature-desc">Directly connects to your repositories for seamless data fetching.</p>
          </SpotlightCard>
        </div>
      </div>
      </div>
    );
  }

  return <StandupGenerator userId={session.user.id} />;
}
